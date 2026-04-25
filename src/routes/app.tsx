import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { SmartCanvas, type SmartCanvasHandle } from "@/components/whiteboard/SmartCanvas";
import { Toolbar } from "@/components/whiteboard/Toolbar";
import { GestureController, type GestureFrame } from "@/components/whiteboard/GestureController";
import { ExportShareMenu } from "@/components/whiteboard/ExportShareMenu";
import { SettingsPanel } from "@/components/whiteboard/SettingsPanel";
import { OnboardingTour } from "@/components/whiteboard/OnboardingTour";
import { QuickActionBar } from "@/components/whiteboard/QuickActionBar";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useSyncEngine, type AppSettings } from "@/hooks/useSyncEngine";
import { LogOut, Sparkles, Wifi, WifiOff, User, Users } from "lucide-react";
import type { Tool } from "@/lib/whiteboard/types";
import { BOARD_THEMES } from "@/lib/whiteboard/types";
import { runMapping } from "@/lib/whiteboard/actions";
import { resolveCustom } from "@/components/whiteboard/CustomMappingsEditor";
import { AdaptiveStability } from "@/lib/whiteboard/adaptiveStability";
import { idbGet, saveLocalBoard } from "@/lib/whiteboard/idb";

const LOCAL_BOARD_ID = "current";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Whiteboard — Gesture Whiteboard" },
      { name: "description", content: "Open the gesture-controlled whiteboard. Draw with your hand, mouse, or touch — works online and offline." },
      { property: "og:title", content: "Whiteboard — Gesture Whiteboard" },
      { property: "og:description", content: "Draw with your hand, mouse, or touch. Works online and offline." },
    ],
  }),
  component: () => (
    <AuthProvider>
      <WhiteboardPage />
    </AuthProvider>
  ),
});

function WhiteboardPage() {
  const { user, signOut } = useAuth();
  const { settings, update, online } = useSyncEngine();
  const canvasRef = useRef<SmartCanvasHandle>(null);
  const fsVideoRef = useRef<HTMLVideoElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(settings.brush_settings.color);
  const [size, setSize] = useState(settings.brush_settings.size);
  const [cameraOn, setCameraOn] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const cameraInitRef = useRef(false);
  const [pose, setPose] = useState<string>("NONE");
  const [boardSize, setBoardSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = document.getElementById("canvas-wrap");
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBoardSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setColor(settings.brush_settings.color); setSize(settings.brush_settings.size); }, [settings.brush_settings.color, settings.brush_settings.size]);

  // Restore persisted camera-enabled state once after settings hydrate.
  useEffect(() => {
    if (cameraInitRef.current) return;
    if (settings.camera.enabled) { setCameraOn(true); cameraInitRef.current = true; }
    else if (settings.updated_at !== new Date(0).toISOString()) { cameraInitRef.current = true; }
  }, [settings.camera.enabled, settings.updated_at]);

  // Persist enabled state when user toggles.
  const handleCameraToggle = (on: boolean) => {
    setCameraOn(on);
    if (on !== settings.camera.enabled) update({ camera: { ...settings.camera, enabled: on } });
  };

  useEffect(() => {
    idbGet<{ objects: unknown[] }>("boards", LOCAL_BOARD_ID).then((d) => {
      if (d && canvasRef.current) canvasRef.current.loadData(d as never);
    });
  }, []);

  // Adaptive stability — single instance per session.
  const adaptRef = useRef(new AdaptiveStability(settings.pose_stability));
  useEffect(() => { adaptRef.current.setBase(settings.pose_stability); }, [settings.pose_stability]);
  const [effectiveStability, setEffectiveStability] = useState(settings.pose_stability);

  // Re-read the adaptive threshold periodically when adaptive mode is on.
  useEffect(() => {
    if (!settings.adaptive_stability) {
      setEffectiveStability(settings.pose_stability);
      return;
    }
    const id = setInterval(() => setEffectiveStability(adaptRef.current.current()), 1000);
    return () => clearInterval(id);
  }, [settings.adaptive_stability, settings.pose_stability]);

  // Shared action helpers (used by gesture handler AND QuickActionBar).
  const doUndo = () => { adaptRef.current.noteUndo(); canvasRef.current?.undo(); };
  const doRedo = () => canvasRef.current?.redo();
  const doSave = () => {
    const d = canvasRef.current?.exportData();
    if (d) saveLocalBoard(LOCAL_BOARD_ID, d);
  };
  const doScreenshot = async () => {
    const blob = await canvasRef.current?.exportPNG(BOARD_THEMES[settings.theme].bg);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `board-${Date.now()}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const doToggleGrid = () => update({ show_grid: !settings.show_grid });
  const doToggleSnap = () => update({ snap_to_grid: !settings.snap_to_grid });
  const doToggleMirror = () => update({ mirror_camera: !settings.mirror_camera });
  const doTogglePalm = () => update({ palm: { ...settings.palm, enabled: !settings.palm.enabled } });
  const doZoomIn = () => canvasRef.current?.zoomBy(1.2);
  const doZoomOut = () => canvasRef.current?.zoomBy(1 / 1.2);
  const doZoomReset = () => canvasRef.current?.resetViewport();
  const doFitScreen = () => canvasRef.current?.resetViewport();
  const doThemeNext = () => {
    const order: AppSettings["theme"][] = ["dark", "light", "sepia", "chalkboard", "blueprint"];
    const i = order.indexOf(settings.theme);
    update({ theme: order[(i + 1) % order.length] });
  };
  const doLockCanvas = () => update({ canvas_locked: !settings.canvas_locked });
  const doAddSticky = () => canvasRef.current?.addSticky();
  const doVoiceToggle = () => update({ voice: { ...settings.voice, enabled: !settings.voice.enabled } });
  const doSmartInkCycle = () => {
    const order: AppSettings["smart_ink_mode"][] = ["off", "heuristics", "auto", "latex"];
    const i = order.indexOf(settings.smart_ink_mode);
    update({ smart_ink_mode: order[(i + 1) % order.length] });
  };
  const doHighlighterToggle = () => update({ highlighter: !settings.highlighter });

  function onFrame(f: GestureFrame) {
    setPose(f.pose);
    if (settings.disabled_poses.includes(f.pose)) {
      canvasRef.current?.applyGestureCursor(f.pose, f.cursor);
      return;
    }
    // Custom user-authored mappings take precedence over the base map.
    const customWinner = resolveCustom(f.pose, settings.custom_mappings);
    const mapped = customWinner
      ? customWinner.action
      : settings.gesture_mappings[f.pose as keyof typeof settings.gesture_mappings];
    if (mapped && f.pose !== "NONE") {
      // Record this as an "action" candidate for adaptive tuning. If the user
      // undoes within 2.5s we'll count it as a false trigger.
      if (mapped !== "none" && mapped !== "undo") adaptRef.current.noteAction();

      runMapping(mapped, {
        setTool: (t) => { if (t !== tool) setTool(t); },
        undo: doUndo,
        redo: doRedo,
        clear: () => canvasRef.current?.clear(),
        save: doSave,
        screenshot: doScreenshot,
        cycleColor: (dir) => {
          const palette = BOARD_THEMES[settings.theme].ink;
          const i = palette.indexOf(color);
          const n = palette[(i + dir + palette.length) % palette.length];
          setColor(n);
        },
        changeSize: (delta) => setSize((s) => Math.min(32, Math.max(1, s + delta))),
        setSize: (n) => setSize(Math.min(32, Math.max(1, n))),
        cycleLayer: (dir = 1) => {
          const order: Array<"ink" | "shapes" | "text" | "objects"> = ["ink", "shapes", "text", "objects"];
          const i = order.indexOf(settings.active_layer);
          update({ active_layer: order[(i + dir + order.length) % order.length] });
        },
        toggleCamera: () => handleCameraToggle(!cameraOn),
        toggleGrid: doToggleGrid,
        toggleSnap: doToggleSnap,
        toggleMirror: doToggleMirror,
        togglePalm: doTogglePalm,
        toggleFullscreen: () => setFullscreen((f) => !f),
        duplicate: () => { /* requires selection support */ },
        deleteSelected: () => { /* requires selection support */ },
        zoomIn: doZoomIn,
        zoomOut: doZoomOut,
        zoomReset: doZoomReset,
        fitToScreen: doFitScreen,
        themeNext: doThemeNext,
        lockCanvas: doLockCanvas,
        addSticky: doAddSticky,
        addText: () => setTool("text"),
        copy: () => { /* selection-dependent */ },
        paste: () => { /* selection-dependent */ },
        selectAll: () => { /* selection-dependent */ },
        voiceToggle: doVoiceToggle,
        smartInkCycle: doSmartInkCycle,
        highlighterToggle: doHighlighterToggle,
      });
    }
    canvasRef.current?.applyGestureCursor(f.pose, f.cursor);
  }

  // Wire the live MediaStream into the fullscreen <video> overlay.
  function handleStream(stream: MediaStream | null) {
    const v = fsVideoRef.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) { v.play().catch(() => { /* autoplay may need user gesture */ }); }
  }

  // Auto-exit fullscreen if the camera turns off.
  useEffect(() => { if (!cameraOn && fullscreen) setFullscreen(false); }, [cameraOn, fullscreen]);

  // Keep fullscreen video element in sync with mirror toggle.
  const videoMirrorStyle = { transform: settings.mirror_camera ? "scaleX(-1)" : undefined };

  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <OnboardingTour />

      <header className="flex items-center justify-between gap-2 px-3 py-2 glass z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--gradient-accent)" }}>
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="hidden sm:block min-w-0">
            <h1 className="text-sm font-semibold truncate">Gesture Whiteboard</h1>
            <p className="text-[10px] text-muted-foreground truncate">{pose !== "NONE" ? `Gesture: ${pose}` : "Draw with your hand or mouse"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground" title={online ? "Online" : "Offline"}>
            {online ? <Wifi className="w-3.5 h-3.5 text-success" /> : <WifiOff className="w-3.5 h-3.5 text-warning" />}
            {online ? "Online" : "Offline"}
          </span>
          <ExportShareMenu
            exportPNG={() => canvasRef.current!.exportPNG(settings.theme === "light" ? "#ffffff" : "#0d0f1a")}
            exportData={() => canvasRef.current!.exportData()}
            loadData={(d) => canvasRef.current?.loadData(d)}
          />
          {user && (
            <Button asChild variant="ghost" size="icon" title="Rooms"><Link to="/rooms"><Users className="w-4 h-4" /></Link></Button>
          )}
          <SettingsPanel settings={settings} update={update} livePose={pose} />
          {user ? (
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out"><LogOut className="w-4 h-4" /></Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="gap-1"><Link to="/auth"><User className="w-3.5 h-3.5" />Sign in</Link></Button>
          )}
        </div>
      </header>

      <div className="flex-1 relative flex">
        <aside className={`absolute left-2 top-1/2 -translate-y-1/2 ${fullscreen ? "z-50" : "z-10"}`}>
          <Toolbar
            tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
            onUndo={() => canvasRef.current?.undo()}
            onClear={() => { if (confirm("Clear the entire board?")) canvasRef.current?.clear(); }}
          />
        </aside>

        {/* Canvas wrapper — switches between in-flow and fullscreen overlay.
            SmartCanvas stays mounted so undo history & strokes survive the toggle. */}
        <div
          id="canvas-wrap"
          className={
            fullscreen
              ? "fixed inset-0 z-40 bg-black overflow-hidden"
              : "flex-1 m-2 ml-16 sm:ml-20 rounded-xl overflow-hidden"
          }
        >
          {fullscreen && (
            <video
              ref={fsVideoRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={videoMirrorStyle}
              playsInline
              muted
              autoPlay
            />
          )}
          {fullscreen && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 glass rounded-full px-3 py-1.5 text-xs flex items-center gap-2 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Live preview · Gesture: <strong>{pose}</strong>
            </div>
          )}
          <div className={fullscreen ? "absolute inset-0" : "w-full h-full"}>
            <SmartCanvas
              ref={canvasRef}
              tool={tool}
              color={color}
              size={size}
              smartInkMode={settings.smart_ink_mode}
              online={online}
              onChange={(d) => { saveLocalBoard(LOCAL_BOARD_ID, d); }}
            />
          </div>

          <QuickActionBar
            settings={settings}
            onUndo={doUndo}
            onRedo={doRedo}
            onSave={doSave}
            onScreenshot={doScreenshot}
            onToggleGrid={doToggleGrid}
          />
        </div>

        <GestureController
          width={boardSize.w}
          height={boardSize.h}
          enabled={cameraOn}
          mirror={settings.mirror_camera}
          resolution={settings.camera.resolution}
          facingMode={settings.camera.facingMode}
          smoothing={settings.smoothing}
          stabilityThreshold={effectiveStability}
          pinchSensitivity={settings.pinch_sensitivity}
          motion={settings.motion}
          onFrame={onFrame}
          onToggle={handleCameraToggle}
          fullscreen={fullscreen}
          onToggleFullscreen={() => {
            if (!cameraOn) { setCameraOn(true); }
            setFullscreen((f) => !f);
          }}
          onStream={handleStream}
        />
      </div>

      <footer className="shrink-0 text-center py-1.5 text-[11px] text-muted-foreground glass z-20">
        Made with <span aria-label="pink heart">🩷</span> by <strong className="text-foreground">MuazBinShafi</strong>
      </footer>
    </main>
  );
}
