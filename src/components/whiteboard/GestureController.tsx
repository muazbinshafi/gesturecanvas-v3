/**
 * GestureController v2 — webcam → MediaPipe GestureRecognizer → emits events.
 *
 * Engine:
 *  - MediaPipe `GestureRecognizer` (pre-trained ML classifier) for static poses.
 *  - Geometric pinch detector overrides ML when tips touch.
 *  - ConfidenceStabilizer commits poses only after N consecutive frames whose
 *    mean confidence ≥ threshold. Releasing back to NONE uses hysteresis.
 *  - MotionDetector runs on the smoothed cursor for swipes / dwell.
 *
 * Camera persistence (enabled / resolution / facingMode) comes from settings.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";
import { Camera, CameraOff, Loader2, AlertCircle, Check, X, PlayCircle, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Vec2Filter } from "@/lib/whiteboard/oneEuro";
import { toCanvas, type LM } from "@/lib/whiteboard/landmarks";
import type { Pose } from "@/lib/whiteboard/types";
import { parseResolution, type CameraFacing, type CameraResolution } from "@/lib/whiteboard/types";
import { MotionDetector, DEFAULT_MOTION, type MotionConfig } from "@/lib/whiteboard/motionGestures";
import { classifyFrame, ConfidenceStabilizer } from "@/lib/whiteboard/gestureEngineV2";

export interface GestureFrame {
  pose: Pose;
  cursor: { x: number; y: number } | null;
  visible: boolean;
  /** Confidence of the *candidate* pose in [0,1]. */
  confidence: number;
  /** Pose currently accumulating votes (may differ from `pose`). */
  candidate: Pose;
}

interface Props {
  width: number;
  height: number;
  enabled: boolean;
  mirror: boolean;
  resolution: CameraResolution;
  facingMode: CameraFacing;
  smoothing: { minCutoff: number; beta: number };
  /** Frames a candidate must persist before commit. */
  stabilityThreshold?: number;
  /** Pinch sensitivity in [0,1]. */
  pinchSensitivity?: number;
  /** Cursor sensitivity multiplier. */
  cursorGain?: number;
  /** Optional motion config. */
  motion?: Partial<MotionConfig>;
  onFrame: (f: GestureFrame) => void;
  onToggle: (enabled: boolean) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onStream?: (stream: MediaStream | null) => void;
}

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_CDN = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task";

type ReadyState = "idle" | "loading" | "ready" | "error";
type CheckState = "pending" | "ok" | "fail";

interface Checklist {
  https: CheckState;
  api: CheckState;
  permission: CheckState;
  model: CheckState;
}

const INITIAL_CHECKS: Checklist = { https: "pending", api: "pending", permission: "pending", model: "pending" };

export function GestureController({
  width, height, enabled, mirror, resolution, facingMode, smoothing,
  stabilityThreshold = 4, pinchSensitivity = 0.5, cursorGain = 1.6, motion, onFrame, onToggle,
  fullscreen = false, onToggleFullscreen, onStream,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const filterRef = useRef(new Vec2Filter(smoothing.minCutoff, smoothing.beta));
  const stabilizerRef = useRef(new ConfidenceStabilizer(stabilityThreshold, 0.55));
  const motionRef = useRef(new MotionDetector({ ...DEFAULT_MOTION, ...motion }));
  const pinchSensRef = useRef(pinchSensitivity);
  const [status, setStatus] = useState<ReadyState>("idle");
  const [errMsg, setErrMsg] = useState<string>("");
  const [fps, setFps] = useState(0);
  const [checks, setChecks] = useState<Checklist>(INITIAL_CHECKS);

  useEffect(() => { filterRef.current.set(smoothing.minCutoff, smoothing.beta); }, [smoothing.minCutoff, smoothing.beta]);
  useEffect(() => { stabilizerRef.current.setFrames(stabilityThreshold); }, [stabilityThreshold]);
  useEffect(() => { if (motion) motionRef.current.setConfig(motion); }, [motion]);
  useEffect(() => { pinchSensRef.current = pinchSensitivity; }, [pinchSensitivity]);

  // Pre-flight passive checks.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const httpsOk = window.location.protocol === "https:" || window.location.hostname === "localhost";
    const apiOk = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setChecks((c) => ({ ...c, https: httpsOk ? "ok" : "fail", api: apiOk ? "ok" : "fail" }));

    const perms = (navigator as Navigator & { permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions;
    if (perms?.query) {
      perms.query({ name: "camera" as PermissionName })
        .then((s) => {
          setChecks((c) => ({ ...c, permission: s.state === "granted" ? "ok" : s.state === "denied" ? "fail" : "pending" }));
          s.onchange = () => setChecks((c) => ({ ...c, permission: s.state === "granted" ? "ok" : s.state === "denied" ? "fail" : "pending" }));
        })
        .catch(() => { /* not supported */ });
    }
  }, []);

  useEffect(() => {
    if (!enabled) stop();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      onStream?.(null);
    }
    const video = videoRef.current;
    if (video) { try { video.pause(); } catch { /* noop */ } video.srcObject = null; }
    if (recognizerRef.current) { try { recognizerRef.current.close(); } catch { /* noop */ } recognizerRef.current = null; }
    stabilizerRef.current.reset();
    motionRef.current.reset();
    onFrame({ pose: "NONE", cursor: null, visible: false, confidence: 0, candidate: "NONE" });
    setStatus("idle");
    setFps(0);
    setChecks((c) => ({ ...c, model: "pending" }));
  }

  const handleStart = useCallback(async () => {
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
      const m = "Camera API not available. Use a modern browser over HTTPS.";
      setErrMsg(m); setStatus("error"); toast.error(m);
      setChecks((c) => ({ ...c, api: "fail" }));
      return;
    }

    setStatus("loading");
    setErrMsg("");

    const { width: rw, height: rh } = parseResolution(resolution);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: rw }, height: { ideal: rh }, facingMode },
        audio: false,
      });
      setChecks((c) => ({ ...c, permission: "ok" }));
    } catch (e) {
      const err = e as DOMException;
      let msg = "Camera unavailable.";
      if (err?.name === "NotAllowedError") msg = "Camera permission denied. Allow camera access and try again.";
      else if (err?.name === "NotFoundError") msg = "No camera found on this device.";
      else if (err?.name === "NotReadableError") msg = "Camera is in use by another app.";
      else if (err?.name === "SecurityError") msg = "Camera blocked — site must be served over HTTPS.";
      else if (err?.message) msg = err.message;
      console.error("getUserMedia failed:", err);
      setChecks((c) => ({ ...c, permission: "fail" }));
      setErrMsg(msg); setStatus("error"); toast.error(msg);
      onToggle(false);
      return;
    }

    streamRef.current = stream;
    onStream?.(stream);
    const video = videoRef.current;
    if (!video) { stop(); return; }
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    try { await video.play(); } catch (e) { console.warn("video.play() rejected", e); }

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      const rec = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_CDN, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      recognizerRef.current = rec;
      setChecks((c) => ({ ...c, model: "ok" }));
      setStatus("ready");
      toast.success("Camera ready — gesture recognition active.");
      loop();
    } catch (e) {
      console.error("MediaPipe init failed:", e);
      const msg = e instanceof Error ? e.message : "Gesture model failed to load.";
      setChecks((c) => ({ ...c, model: "fail" }));
      setErrMsg(msg); setStatus("error"); toast.error(msg);
      stop();
      onToggle(false);
    }
  }, [resolution, facingMode, onToggle]);

  useEffect(() => {
    if (enabled && status === "idle") handleStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  function loop() {
    let last = performance.now();
    let frames = 0; let acc = 0;
    const step = () => {
      const rec = recognizerRef.current;
      const video = videoRef.current;
      if (!rec || !video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const t = performance.now();
      let result;
      try { result = rec.recognizeForVideo(video, t); }
      catch (e) {
        console.warn("recognizeForVideo error", e);
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const landmarks = (result.landmarks?.[0] as LM[] | undefined) ?? null;
      const top = result.gestures?.[0]?.[0];
      const category = top?.categoryName ?? "";
      const score = top?.score ?? 0;

      const preview = previewRef.current;
      if (preview) drawPreview(preview, video, landmarks ?? undefined);

      if (landmarks) {
        // Classify static pose (ML + geometric pinch override).
        const out = classifyFrame({ category, score, landmarks }, 0.55, pinchSensRef.current);
        const committed = stabilizerRef.current.push(out.pose, out.confidence);

        // Cursor from index tip with gain around canvas center.
        const tip = toCanvas(landmarks[8], width, height, mirror);
        const gx = (tip.x - width / 2) * cursorGain + width / 2;
        const gy = (tip.y - height / 2) * cursorGain + height / 2;
        const cx = Math.max(0, Math.min(width, gx));
        const cy = Math.max(0, Math.min(height, gy));
        const sm = filterRef.current.filter(cx, cy, t);

        // Motion gestures only when index is up (DRAW/PINCH) — avoids spurious
        // swipes from hand entering / leaving frame.
        const motionFeed = committed === "DRAW" || committed === "PINCH";
        const motionPose = motionFeed ? motionRef.current.push(sm.x, sm.y, t) : null;
        if (!motionFeed) motionRef.current.reset();

        const finalPose: Pose = motionPose ?? committed;
        onFrame({
          pose: finalPose,
          cursor: sm,
          visible: true,
          confidence: motionPose ? 1 : stabilizerRef.current.confidence(),
          candidate: motionPose ?? stabilizerRef.current.candidatePose(),
        });
      } else {
        stabilizerRef.current.push("NONE", 0);
        motionRef.current.reset();
        onFrame({ pose: "NONE", cursor: null, visible: false, confidence: 0, candidate: "NONE" });
      }

      frames++; acc += t - last; last = t;
      if (acc >= 500) { setFps(Math.round((frames * 1000) / acc)); frames = 0; acc = 0; }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }

  const onToggleClick = () => {
    if (enabled) onToggle(false);
    else { onToggle(true); handleStart(); }
  };

  const onTestClick = () => {
    if (enabled) stop();
    onToggle(true);
    handleStart();
  };

  const allReady = checks.https === "ok" && checks.api === "ok" && checks.permission === "ok" && checks.model === "ok";

  return (
    <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2">
      <div className="glass rounded-xl p-2 shadow-toolbar w-44 sm:w-56">
        <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={previewRef} width={224} height={168} className="w-full h-full" style={{ transform: mirror ? "scaleX(-1)" : undefined }} />
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px] gap-1 bg-background/60 backdrop-blur-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading model…</span>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] text-destructive p-2 text-center bg-background/80 gap-1">
              <AlertCircle className="w-4 h-4" />
              <span className="leading-tight">{errMsg || "Camera unavailable"}</span>
            </div>
          )}
          {status === "idle" && !enabled && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground p-2 text-center">
              Click "Test Camera" to start
            </div>
          )}
        </div>

        <div className="mt-2 px-1 space-y-0.5">
          <CheckRow label="HTTPS / localhost" state={checks.https} />
          <CheckRow label="getUserMedia API" state={checks.api} />
          <CheckRow label="Camera permission" state={checks.permission} />
          <CheckRow label="Gesture model" state={checks.model} />
          <div className={`text-[10px] font-medium pt-0.5 ${allReady ? "text-success" : "text-muted-foreground"}`}>
            {allReady ? "✓ Camera ready" : "Waiting for checks…"}
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 mt-1.5 px-1">
          <span className="text-[10px] text-muted-foreground">{enabled ? (status === "ready" ? `${fps} fps` : status) : "Off"}</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-1.5 gap-1"
              onClick={onTestClick}
              disabled={status === "loading"}
              title="Test camera now"
            >
              <PlayCircle className="w-3 h-3" /> Test
            </Button>
            {onToggleFullscreen && (
              <Button
                size="icon"
                variant={fullscreen ? "default" : "ghost"}
                className="h-6 w-6"
                onClick={onToggleFullscreen}
                title={fullscreen ? "Exit fullscreen preview" : "Fullscreen camera preview"}
                aria-label="Toggle fullscreen camera preview"
              >
                {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
            )}
            <Button size="icon" variant={enabled ? "default" : "ghost"} className="h-6 w-6" onClick={onToggleClick} aria-label="Toggle camera">
              {enabled ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ label, state }: { label: string; state: CheckState }) {
  const Icon = state === "ok" ? Check : state === "fail" ? X : Loader2;
  const cls = state === "ok" ? "text-success" : state === "fail" ? "text-destructive" : "text-muted-foreground animate-spin";
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <Icon className={`w-3 h-3 ${cls}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function drawPreview(canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks?: LM[]) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  ctx.fillStyle = "#a78bfa";
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(p.x * canvas.width, p.y * canvas.height, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 1.2;
  const links: [number, number][] = [
    [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
    [13,17],[0,17],[17,18],[18,19],[19,20],
  ];
  for (const [a,b] of links) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * canvas.width, landmarks[a].y * canvas.height);
    ctx.lineTo(landmarks[b].x * canvas.width, landmarks[b].y * canvas.height);
    ctx.stroke();
  }
}
