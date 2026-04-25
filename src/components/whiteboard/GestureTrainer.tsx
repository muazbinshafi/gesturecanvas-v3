/**
 * GestureTrainer — full-screen training mode dialog.
 *
 * Improvements:
 *  - Live preview of the currently-mapped action / tool (icon + description).
 *  - Keyboard shortcuts: ←/→ cycle gestures, R reset current, Shift+R reset all,
 *    T toggle tutorial, Esc close.
 *  - Reset-to-default button per gesture and a "reset all" button.
 *  - Step-by-step tutorial overlay explaining how to test poses, read
 *    confidence and remap gestures.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap, RotateCcw, Undo2, Redo2, Save, Camera, Trash2, Grid3x3,
  Palette, Maximize2, Layers, Copy, Plus, Minus, ChevronLeft, ChevronRight,
  Pencil, Eraser, Square, Circle as CircleIcon, ArrowRight, Type, MousePointer2,
  Hand, StickyNote, Image as ImageIcon, Sparkles, HelpCircle, X, Check,
} from "lucide-react";
import type { AppSettings } from "@/hooks/useSyncEngine";
import { applyStrictGestureReset } from "@/hooks/useSyncEngine";
import type { GestureMappings, GestureAction, Tool, Pose } from "@/lib/whiteboard/types";
import { DEFAULT_MAPPINGS } from "@/lib/whiteboard/types";
import { ACTION_NAMES, TOOL_NAMES, isAction, isTool } from "@/lib/whiteboard/actions";
import { GestureController, type GestureFrame } from "./GestureController";

const TRAINABLE: { key: keyof GestureMappings; label: string; emoji: string }[] = [
  { key: "DRAW",        label: "Index up",        emoji: "☝️" },
  { key: "HOVER",       label: "Two fingers",     emoji: "✌️" },
  { key: "PAN",         label: "Closed fist",     emoji: "✊" },
  { key: "ERASE",       label: "Open hand",       emoji: "🖐️" },
  { key: "PINCH",       label: "Pinch",           emoji: "🤏" },
  { key: "PEACE",       label: "Peace",           emoji: "✌️" },
  { key: "THREE",       label: "Three fingers",   emoji: "🤟" },
  { key: "FOUR",        label: "Four fingers",    emoji: "✋" },
  { key: "FIVE_SPREAD", label: "Five spread",     emoji: "🖐" },
  { key: "OK",          label: "OK sign",         emoji: "👌" },
  { key: "ROCK",        label: "Rock",            emoji: "🤘" },
  { key: "CALL",        label: "Call me",         emoji: "🤙" },
  { key: "GUN",         label: "Gun",             emoji: "🔫" },
  { key: "L_SHAPE",     label: "L shape",         emoji: "🔠" },
  { key: "THUMBS_UP",   label: "Thumbs up",       emoji: "👍" },
  { key: "THUMBS_DOWN", label: "Thumbs down",     emoji: "👎" },
  { key: "PINKY_UP",    label: "Pinky up",        emoji: "🤙" },
  { key: "MIDDLE_UP",   label: "Middle up",       emoji: "🖕" },
  { key: "INDEX_DOWN",  label: "Index down",      emoji: "👇" },
  { key: "FIST_THUMB",  label: "Fist + thumb in", emoji: "👊" },
  { key: "PALM_SIDE",   label: "Palm sideways",   emoji: "✋" },
  { key: "HEART",       label: "Heart shape",     emoji: "🫶" },
  { key: "SWIPE_LEFT",  label: "Swipe ←",         emoji: "⬅️" },
  { key: "SWIPE_RIGHT", label: "Swipe →",         emoji: "➡️" },
  { key: "SWIPE_UP",    label: "Swipe ↑",         emoji: "⬆️" },
  { key: "SWIPE_DOWN",  label: "Swipe ↓",         emoji: "⬇️" },
  { key: "CIRCLE_CW",   label: "Circle CW",       emoji: "🔃" },
  { key: "CIRCLE_CCW",  label: "Circle CCW",      emoji: "🔄" },
  { key: "DWELL",       label: "Hold still",      emoji: "⏳" },
];

const WINDOW_MS = 10_000;

const TOOL_META: Record<Tool, { icon: typeof Pencil; desc: string }> = {
  pen:    { icon: Pencil,        desc: "Free-hand drawing tool" },
  eraser: { icon: Eraser,        desc: "Erase strokes & shapes" },
  rect:   { icon: Square,        desc: "Draw rectangles" },
  circle: { icon: CircleIcon,    desc: "Draw circles" },
  arrow:  { icon: ArrowRight,    desc: "Draw arrows / connectors" },
  text:   { icon: Type,          desc: "Insert text label" },
  select: { icon: MousePointer2, desc: "Select & move objects" },
  pan:    { icon: Hand,          desc: "Pan around the canvas" },
  sticky: { icon: StickyNote,    desc: "Drop a sticky note" },
  image:  { icon: ImageIcon,     desc: "Insert an image" },
};

const ACTION_META: Record<GestureAction, { icon: typeof Pencil; desc: string }> = {
  none:              { icon: X,         desc: "Do nothing — gesture ignored" },
  click:             { icon: MousePointer2, desc: "Tap / click on hovered target" },
  undo:              { icon: Undo2,     desc: "Undo last action" },
  redo:              { icon: Redo2,     desc: "Redo last undone action" },
  clear:             { icon: Trash2,    desc: "Clear the entire board" },
  save:              { icon: Save,      desc: "Save current board state" },
  screenshot:        { icon: Camera,    desc: "Export board as PNG image" },
  color_next:        { icon: Palette,   desc: "Switch to next color in palette" },
  color_prev:        { icon: Palette,   desc: "Switch to previous color" },
  size_up:           { icon: Plus,      desc: "Increase brush size" },
  size_down:         { icon: Minus,     desc: "Decrease brush size" },
  size_min:          { icon: Minus,     desc: "Set brush to thinnest" },
  size_max:          { icon: Plus,      desc: "Set brush to thickest" },
  layer_next:        { icon: Layers,    desc: "Cycle to next layer" },
  layer_prev:        { icon: Layers,    desc: "Cycle to previous layer" },
  toggle_camera:     { icon: Camera,    desc: "Show / hide camera preview" },
  toggle_grid:       { icon: Grid3x3,   desc: "Toggle background grid" },
  toggle_snap:       { icon: Grid3x3,   desc: "Toggle snap-to-grid" },
  toggle_mirror:     { icon: Camera,    desc: "Mirror the camera image" },
  toggle_palm:       { icon: Hand,      desc: "Toggle palm rejection" },
  toggle_fullscreen: { icon: Maximize2, desc: "Toggle fullscreen mode" },
  duplicate:         { icon: Copy,      desc: "Duplicate selected object" },
  delete_selected:   { icon: Trash2,    desc: "Delete selected object" },
  // (zoom actions removed — were causing freezes via runaway redraws)
  theme_next:        { icon: Sparkles,  desc: "Cycle through board themes" },
  lock_canvas:       { icon: X,         desc: "Lock / unlock canvas editing" },
  add_sticky:        { icon: StickyNote,desc: "Drop a new sticky note" },
  add_text:          { icon: Type,      desc: "Insert a new text label" },
  copy:              { icon: Copy,      desc: "Copy selected objects" },
  paste:             { icon: Copy,      desc: "Paste copied objects" },
  select_all:        { icon: MousePointer2, desc: "Select everything" },
  voice_toggle:      { icon: Sparkles,  desc: "Toggle voice command listening" },
  smart_ink_cycle:   { icon: Sparkles,  desc: "Cycle Smart Ink modes" },
  pen:               { icon: Pencil,    desc: "Switch to pen tool" },
  eraser:            { icon: Eraser,    desc: "Switch to eraser tool" },
  highlighter_toggle:{ icon: Pencil,    desc: "Toggle highlighter mode" },
};

const TUTORIAL_STEPS = [
  {
    title: "Welcome to gesture training",
    body: "This trainer lets you safely practice each gesture, see how confidently it’s being detected, and remap it — all without touching the live canvas.",
  },
  {
    title: "1 · Pick a gesture to test",
    body: "Use the list on the left (or ← / → keys) to choose a gesture. The label shows the hand pose to make in front of your camera.",
  },
  {
    title: "2 · Hold the pose",
    body: "Make and hold the pose. Watch the “Detected pose” panel — when it matches your target, you’ll see a ✓.",
  },
  {
    title: "3 · Read the confidence meter",
    body: "Confidence shows how many consecutive frames matched the pose vs. your stability threshold. 100% means it’s rock-solid; under 40% means you should hold longer or improve lighting.",
  },
  {
    title: "4 · Check the 10-second hit-rate",
    body: "Hit-rate is the % of frames in the last 10s where this gesture was correctly detected. Aim for 70%+ for reliable real-world use.",
  },
  {
    title: "5 · Remap the gesture",
    body: "Use the dropdown to bind the gesture to any tool or action. Press R to reset just this gesture, or Shift+R to reset all. Press T anytime to reopen this tutorial.",
  },
];

interface Props {
  settings: AppSettings;
  update: (p: Partial<AppSettings>) => void;
}

export function GestureTrainer({ settings, update }: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<keyof GestureMappings>("DRAW");
  const [frame, setFrame] = useState<GestureFrame>({ pose: "NONE", cursor: null, visible: false, confidence: 0, candidate: "NONE" });
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [recentlyTriggered, setRecentlyTriggered] = useState(false);
  const samplesRef = useRef<{ t: number; pose: Pose }[]>([]);
  const triggerTimeoutRef = useRef<number | null>(null);

  // Show tutorial automatically on first open of trainer (per session).
  useEffect(() => {
    if (open && !sessionStorage.getItem("gesture-trainer-tutorial-seen")) {
      setShowTutorial(true);
      setTutorialStep(0);
      sessionStorage.setItem("gesture-trainer-tutorial-seen", "1");
    }
  }, [open]);

  // Push current pose into rolling window.
  useEffect(() => {
    if (!open) return;
    const now = performance.now();
    samplesRef.current.push({ t: now, pose: frame.pose });
    const cutoff = now - WINDOW_MS;
    while (samplesRef.current.length && samplesRef.current[0].t < cutoff) samplesRef.current.shift();
  }, [frame, open]);

  // Visual flash when target is hit (live preview "fires").
  useEffect(() => {
    if (frame.pose === target && frame.confidence >= 1) {
      setRecentlyTriggered(true);
      if (triggerTimeoutRef.current) window.clearTimeout(triggerTimeoutRef.current);
      triggerTimeoutRef.current = window.setTimeout(() => setRecentlyTriggered(false), 600);
    }
  }, [frame, target]);

  const cycleTarget = useCallback((dir: 1 | -1) => {
    const idx = TRAINABLE.findIndex((t) => t.key === target);
    const next = TRAINABLE[(idx + dir + TRAINABLE.length) % TRAINABLE.length];
    setTarget(next.key);
    samplesRef.current = [];
  }, [target]);

  const resetCurrent = useCallback(() => {
    const def = (DEFAULT_MAPPINGS as unknown as Record<string, string | undefined>)[target] ?? "none";
    update({ gesture_mappings: { ...settings.gesture_mappings, [target]: def } as GestureMappings });
  }, [target, settings.gesture_mappings, update]);

  const resetAll = useCallback(() => {
    update(applyStrictGestureReset(settings));
  }, [settings, update]);

  // Keyboard shortcuts inside dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (showTutorial) {
        if (e.key === "ArrowRight") setTutorialStep((s) => Math.min(s + 1, TUTORIAL_STEPS.length - 1));
        else if (e.key === "ArrowLeft") setTutorialStep((s) => Math.max(s - 1, 0));
        else if (e.key === "Escape") { e.preventDefault(); setShowTutorial(false); }
        return;
      }
      if ((e.target as HTMLElement)?.tagName === "SELECT" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") { e.preventDefault(); cycleTarget(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); cycleTarget(-1); }
      else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        if (e.shiftKey) resetAll(); else resetCurrent();
      }
      else if (e.key === "t" || e.key === "T") { e.preventDefault(); setShowTutorial(true); setTutorialStep(0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, showTutorial, cycleTarget, resetCurrent, resetAll]);

  // Target hit rate over the window.
  const hitRate = useMemo(() => {
    const samples = samplesRef.current;
    if (!samples.length) return 0;
    const hits = samples.filter((s) => s.pose === target).length;
    return Math.round((hits / samples.length) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, target]);

  const isHit = frame.pose === target;
  const confPct = Math.round(frame.confidence * 100);
  const mapping = (settings.gesture_mappings[target] ?? "none") as string;
  const defaultMapping = (DEFAULT_MAPPINGS as unknown as Record<string, string | undefined>)[target] ?? "none";
  const isCustomized = mapping !== defaultMapping;

  // Build live preview from current mapping value.
  const preview = useMemo(() => {
    if (isTool(mapping)) {
      const meta = TOOL_META[mapping];
      return { kind: "Tool" as const, label: mapping, Icon: meta.icon, desc: meta.desc };
    }
    if (isAction(mapping)) {
      const meta = ACTION_META[mapping];
      return { kind: "Action" as const, label: mapping.replace(/_/g, " "), Icon: meta.icon, desc: meta.desc };
    }
    return { kind: "None" as const, label: "Unmapped", Icon: X, desc: "No tool or action bound" };
  }, [mapping]);

  const setMapping = (value: string) => {
    update({ gesture_mappings: { ...settings.gesture_mappings, [target]: value } as GestureMappings });
  };

  const currentEmoji = TRAINABLE.find((t) => t.key === target)?.emoji ?? "✋";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <GraduationCap className="w-3.5 h-3.5" /> Training mode
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2">
                Gesture training
                {isCustomized && <Badge variant="secondary" className="text-[10px]">customized</Badge>}
              </DialogTitle>
              <DialogDescription>
                Pick a gesture, hold it in front of the camera, and watch the confidence meter.
                Adjust the mapping inline — your changes save automatically.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowTutorial(true); setTutorialStep(0); }}
              className="gap-1 shrink-0"
              title="Open tutorial (T)"
            >
              <HelpCircle className="w-4 h-4" /> Tutorial
            </Button>
          </div>
        </DialogHeader>

        {/* Keyboard shortcut hints */}
        <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground -mt-1">
          <Kbd>←</Kbd><Kbd>→</Kbd> <span>cycle gesture</span>
          <span className="mx-1">·</span>
          <Kbd>R</Kbd> <span>reset current</span>
          <span className="mx-1">·</span>
          <Kbd>⇧</Kbd>+<Kbd>R</Kbd> <span>reset all</span>
          <span className="mx-1">·</span>
          <Kbd>T</Kbd> <span>tutorial</span>
          <span className="mx-1">·</span>
          <Kbd>Esc</Kbd> <span>close</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {/* LEFT — pose picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Choose a gesture
              </h4>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => cycleTarget(-1)} title="Previous (←)">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => cycleTarget(1)} title="Next (→)">
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
              {TRAINABLE.map((t) => {
                const on = target === t.key;
                const isCustom = (settings.gesture_mappings[t.key] ?? "none") !== ((DEFAULT_MAPPINGS as unknown as Record<string, string | undefined>)[t.key] ?? "none");
                return (
                  <button
                    key={t.key}
                    onClick={() => { setTarget(t.key); samplesRef.current = []; }}
                    className={`flex items-center gap-2 rounded-md border p-2 text-left text-sm transition ${on ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                  >
                    <span className="text-lg" aria-hidden>{t.emoji}</span>
                    <span className="truncate flex-1">{t.label}</span>
                    {isCustom && <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Customized" />}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 gap-1"
              onClick={resetAll}
              title="Reset all gestures (Shift+R)"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset all to defaults
            </Button>
          </div>

          {/* RIGHT — live readouts + mapping */}
          <div className="space-y-3">
            <div className={`rounded-lg border p-3 transition-colors ${recentlyTriggered ? "border-success bg-success/10" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Detected pose</div>
                  <div className={`text-2xl font-semibold ${isHit ? "text-success" : ""}`}>
                    {frame.pose} {isHit && <Check className="w-5 h-5 inline" />}
                  </div>
                  {frame.candidate !== frame.pose && frame.candidate !== "NONE" && (
                    <div className="text-[11px] text-muted-foreground">
                      Building: {frame.candidate}
                    </div>
                  )}
                </div>
                <div className="text-4xl" aria-hidden>{currentEmoji}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Confidence (vs stability threshold)</span>
                <span className="font-mono">{confPct}%</span>
              </div>
              <Progress value={confPct} />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Hit-rate for {target} (last 10s)</span>
                <span className="font-mono">{hitRate}%</span>
              </div>
              <Progress value={hitRate} />
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Map this gesture to</label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 gap-1 text-[10px]"
                  onClick={resetCurrent}
                  disabled={!isCustomized}
                  title="Reset this gesture (R)"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </Button>
              </div>
              <select
                value={mapping}
                onChange={(e) => setMapping(e.target.value)}
                className="w-full bg-input text-foreground rounded-md px-2 py-1.5 text-sm border border-border"
              >
                <optgroup label="Tools">
                  {TOOL_NAMES.map((t: Tool) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
                <optgroup label="Actions">
                  {ACTION_NAMES.map((a: GestureAction) => <option key={a} value={a}>{a}</option>)}
                </optgroup>
              </select>

              {/* Live preview of the bound action / tool */}
              <div className={`flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2 ${recentlyTriggered ? "ring-2 ring-success/60" : ""}`}>
                <div className="rounded-md bg-background p-2 border border-border">
                  <preview.Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium capitalize truncate">{preview.label}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{preview.kind}</Badge>
                    {recentlyTriggered && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> fired
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{preview.desc}</p>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Tip: increase Gesture stability in Settings if a pose triggers too easily.
              </p>
            </div>
          </div>
        </div>

        {/* Hidden gesture controller drives the live preview frames. */}
        {open && !showTutorial && (
          <div className="relative h-0">
            <GestureController
              width={400}
              height={300}
              enabled
              mirror={settings.mirror_camera}
              resolution={settings.camera.resolution}
              facingMode={settings.camera.facingMode}
              smoothing={settings.smoothing}
              stabilityThreshold={settings.pose_stability}
              pinchSensitivity={settings.pinch_sensitivity}
              onFrame={setFrame}
              onToggle={() => { /* trainer doesn't toggle the main session */ }}
            />
          </div>
        )}

        {/* Tutorial overlay */}
        {showTutorial && (
          <div className="absolute inset-0 z-10 bg-background/95 backdrop-blur-sm rounded-lg flex items-center justify-center p-6">
            <div className="max-w-md w-full space-y-4">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Step {tutorialStep + 1} / {TUTORIAL_STEPS.length}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowTutorial(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{TUTORIAL_STEPS[tutorialStep].title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{TUTORIAL_STEPS[tutorialStep].body}</p>
              </div>

              <div className="flex items-center gap-1 justify-center">
                {TUTORIAL_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === tutorialStep ? "bg-primary" : "bg-muted-foreground/30"}`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTutorialStep((s) => Math.max(s - 1, 0))}
                  disabled={tutorialStep === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowTutorial(false)}>
                  Skip
                </Button>
                {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setTutorialStep((s) => Math.min(s + 1, TUTORIAL_STEPS.length - 1))}
                    className="gap-1"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setShowTutorial(false)} className="gap-1">
                    <Check className="w-4 h-4" /> Got it
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded border border-border bg-muted font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  );
}
