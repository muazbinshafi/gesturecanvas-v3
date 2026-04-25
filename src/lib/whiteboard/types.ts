// Shared types for the whiteboard app.

export type Tool =
  | "pen"
  | "eraser"
  | "rect"
  | "circle"
  | "arrow"
  | "text"
  | "select"
  | "pan"
  | "sticky"
  | "image";

export type Pose =
  | "DRAW" | "HOVER" | "PAN" | "ERASE" | "PINCH"
  | "ZOOM" | "ROTATE"
  | "PEACE" | "THREE" | "FOUR" | "FIVE_SPREAD"
  | "OK" | "ROCK" | "CALL" | "GUN" | "L_SHAPE"
  | "THUMBS_UP" | "THUMBS_DOWN"
  | "PINKY_UP" | "MIDDLE_UP" | "INDEX_DOWN"
  | "FIST_THUMB" | "PALM_SIDE" | "HEART"
  | "SWIPE_LEFT" | "SWIPE_RIGHT" | "SWIPE_UP" | "SWIPE_DOWN"
  | "CIRCLE_CW" | "CIRCLE_CCW" | "DWELL"
  | "NONE";

export type Layer = "ink" | "shapes" | "text" | "objects";

export interface Point { x: number; y: number; p?: number }

export interface BaseObject {
  id: string;
  type: string;
  color: string;
  createdAt: number;
  layer?: Layer;
}

export interface StrokeObject extends BaseObject {
  type: "stroke";
  points: Point[];
  size: number;
}

export interface ShapeObject extends BaseObject {
  type: "rect" | "circle" | "arrow";
  x: number; y: number; w: number; h: number;
  size: number;
  // For arrows: optional endpoint linking to other objects (auto-layout)
  fromId?: string;
  toId?: string;
}

export interface TextObject extends BaseObject {
  type: "text";
  x: number; y: number;
  text: string;
  size: number;
  // When set, render via KaTeX as math
  latex?: boolean;
}

export interface StickyObject extends BaseObject {
  type: "sticky";
  x: number; y: number; w: number; h: number;
  text: string;
  bg: string;
  size: number;
}

export interface ImageObject extends BaseObject {
  type: "image";
  x: number; y: number; w: number; h: number;
  src: string; // data URL or remote URL
}

export type BoardObject = StrokeObject | ShapeObject | TextObject | StickyObject | ImageObject;

export interface BoardData {
  version: 1;
  objects: BoardObject[];
  width: number;
  height: number;
  exportedAt?: string;
}

export interface BrushSettings {
  size: number;
  color: string;
  smoothing: number;
}

export interface SmoothingSettings {
  minCutoff: number;
  beta: number;
  preset?: SmoothingPreset;
}

export type SmoothingPreset = "calm" | "responsive" | "studio" | "custom";

export const SMOOTHING_PRESETS: Record<Exclude<SmoothingPreset, "custom">, { minCutoff: number; beta: number }> = {
  calm: { minCutoff: 0.6, beta: 0.005 },
  responsive: { minCutoff: 1.5, beta: 0.02 },
  studio: { minCutoff: 1.0, beta: 0.012 },
};

/**
 * Actions that gestures can trigger (in addition to selecting a Tool).
 * Used for the extended pose set so users can map e.g. THUMBS_UP → undo.
 */
export type GestureAction =
  | "none"
  | "click"
  | "undo" | "redo" | "clear" | "save" | "screenshot"
  | "color_next" | "color_prev"
  | "size_up" | "size_down" | "size_min" | "size_max"
  | "layer_next" | "layer_prev"
  | "toggle_camera" | "toggle_grid" | "toggle_snap" | "toggle_mirror" | "toggle_palm"
  | "toggle_fullscreen" | "duplicate" | "delete_selected"
  | "theme_next" | "lock_canvas"
  | "add_sticky" | "add_text"
  | "copy" | "paste" | "select_all"
  | "voice_toggle" | "smart_ink_cycle"
  | "pen" | "eraser" | "highlighter_toggle";

export interface GestureMappings {
  DRAW: Tool;
  HOVER: Tool;
  PAN: Tool;
  ERASE: Tool;
  PINCH: Tool | GestureAction;
  /** Optional extended pose → tool or action mapping. */
  PEACE?: Tool | GestureAction;
  THREE?: Tool | GestureAction;
  FOUR?: Tool | GestureAction;
  FIVE_SPREAD?: Tool | GestureAction;
  OK?: Tool | GestureAction;
  ROCK?: Tool | GestureAction;
  CALL?: Tool | GestureAction;
  GUN?: Tool | GestureAction;
  L_SHAPE?: Tool | GestureAction;
  THUMBS_UP?: Tool | GestureAction;
  THUMBS_DOWN?: Tool | GestureAction;
  PINKY_UP?: Tool | GestureAction;
  MIDDLE_UP?: Tool | GestureAction;
  INDEX_DOWN?: Tool | GestureAction;
  FIST_THUMB?: Tool | GestureAction;
  PALM_SIDE?: Tool | GestureAction;
  HEART?: Tool | GestureAction;
  SWIPE_LEFT?: Tool | GestureAction;
  SWIPE_RIGHT?: Tool | GestureAction;
  SWIPE_UP?: Tool | GestureAction;
  SWIPE_DOWN?: Tool | GestureAction;
  CIRCLE_CW?: Tool | GestureAction;
  CIRCLE_CCW?: Tool | GestureAction;
  DWELL?: Tool | GestureAction;
}

export type CameraResolution = "320x240" | "640x480" | "1280x720" | "1920x1080";
export type CameraFacing = "user" | "environment";

export interface CameraSettings {
  enabled: boolean;
  resolution: CameraResolution;
  facingMode: CameraFacing;
  numHands: 1 | 2;
}

export type BoardTheme = "dark" | "light" | "sepia" | "chalkboard" | "blueprint";

export const BOARD_THEMES: Record<BoardTheme, { bg: string; ink: string[]; accent: string }> = {
  dark: { bg: "#0d0f1a", ink: ["#a78bfa", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#f87171", "#f8fafc", "#94a3b8"], accent: "#a78bfa" },
  light: { bg: "#ffffff", ink: ["#7c3aed", "#0891b2", "#db2777", "#ca8a04", "#16a34a", "#dc2626", "#0f172a", "#475569"], accent: "#7c3aed" },
  sepia: { bg: "#f4ecd8", ink: ["#5b4636", "#7c3f00", "#a0522d", "#8b0000", "#2f4f4f", "#0f4c5c", "#1a1a1a", "#6b5d4f"], accent: "#7c3f00" },
  chalkboard: { bg: "#1f2a24", ink: ["#ffffff", "#fef9c3", "#fca5a5", "#a7f3d0", "#bae6fd", "#ddd6fe", "#fbcfe8", "#fde68a"], accent: "#a7f3d0" },
  blueprint: { bg: "#0b3a82", ink: ["#ffffff", "#cbe1ff", "#fef3c7", "#a7f3d0", "#fbcfe8", "#fde68a", "#fca5a5", "#e9d5ff"], accent: "#cbe1ff" },
};

export interface VoiceSettings {
  enabled: boolean;
  lang: string;
}

export interface PalmRejectionSettings {
  enabled: boolean;
  // Pointer types accepted when enabled. Touch is rejected unless explicitly allowed.
  acceptedPointerTypes: ("pen" | "mouse" | "touch")[];
}

export interface CustomGestureTemplate {
  name: string;
  // 21 normalized landmarks (mean-removed, scale-normalized)
  landmarks: { x: number; y: number; z: number }[];
  tool?: Tool;
  createdAt: number;
}

/**
 * User-authored mapping override: pose → action/tool. Custom mappings are
 * checked BEFORE the base GestureMappings so they take precedence. They can
 * be reordered (lower order index = higher precedence among customs).
 */
export interface CustomMapping {
  id: string;
  name: string;
  /** Pose key — must be one of the keys in GestureMappings. */
  pose: keyof GestureMappings;
  /** Either a Tool name or a GestureAction name. */
  action: Tool | GestureAction;
  /** Lower number = higher precedence. */
  order: number;
  enabled: boolean;
  createdAt: number;
}

export const DEFAULT_BRUSH: BrushSettings = { size: 4, color: "#a78bfa", smoothing: 0.5 };
export const DEFAULT_SMOOTHING: SmoothingSettings = { minCutoff: 1.2, beta: 0.015, preset: "studio" };
export const DEFAULT_CAMERA: CameraSettings = { enabled: false, resolution: "640x480", facingMode: "user", numHands: 2 };
export const DEFAULT_MAPPINGS: GestureMappings = {
  // ── Continuous tools (held while pose is active) ─────────────────────
  DRAW: "pen",          // index up → draw
  HOVER: "select",      // index up (relaxed) → cursor moves
  PAN: "pan",           // open palm → pan canvas
  ERASE: "eraser",      // closed fist → erase
  PINCH: "click",       // pinch thumb+index → click at cursor
  // ── One-shot static poses (NEVER map to tools — would hijack the active tool) ─
  PEACE: "undo",
  THREE: "color_next",
  FOUR: "color_prev",
  FIVE_SPREAD: "save",
  OK: "save",
  ROCK: "size_up",
  CALL: "screenshot",
  GUN: "delete_selected",
  L_SHAPE: "layer_next",
  THUMBS_UP: "redo",
  THUMBS_DOWN: "clear",
  PINKY_UP: "size_down",
  MIDDLE_UP: "size_up",
  INDEX_DOWN: "add_sticky",
  FIST_THUMB: "lock_canvas",
  PALM_SIDE: "toggle_grid",
  HEART: "theme_next",
  // ── Motion gestures ─────────────────────────────────────────────────
  SWIPE_LEFT: "undo",
  SWIPE_RIGHT: "redo",
  SWIPE_UP: "size_up",
  SWIPE_DOWN: "size_down",
  // Circle gestures kept in the type system but unmapped by default
  // (circle motion detection is also disabled by default to avoid freezes).
  CIRCLE_CW: "none",
  CIRCLE_CCW: "none",
  DWELL: "add_text",
};
export const DEFAULT_VOICE: VoiceSettings = { enabled: false, lang: "en-US" };
export const DEFAULT_PALM: PalmRejectionSettings = { enabled: false, acceptedPointerTypes: ["pen", "mouse", "touch"] };

export function parseResolution(r: CameraResolution): { width: number; height: number } {
  const [w, h] = r.split("x").map(Number);
  return { width: w, height: h };
}

// Viewport — pan & zoom transform applied to canvas world coords.
export interface Viewport { x: number; y: number; scale: number }
export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

export const STICKY_COLORS = ["#fde68a", "#fecaca", "#bbf7d0", "#bae6fd", "#ddd6fe", "#fbcfe8"];
