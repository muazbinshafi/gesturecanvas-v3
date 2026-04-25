/**
 * Map a GestureMappings entry to either a Tool selection or an action callback.
 */
import type { GestureAction, Tool } from "./types";

export const TOOL_NAMES: Tool[] = [
  "pen", "eraser", "rect", "circle", "arrow", "text", "select", "pan", "sticky", "image",
];

export const ACTION_NAMES: GestureAction[] = [
  "none",
  "click",
  "undo", "redo", "clear", "save", "screenshot",
  "color_next", "color_prev",
  "size_up", "size_down", "size_min", "size_max",
  "layer_next", "layer_prev",
  "toggle_camera", "toggle_grid", "toggle_snap", "toggle_mirror", "toggle_palm",
  "toggle_fullscreen", "duplicate", "delete_selected",
  "theme_next", "lock_canvas",
  "add_sticky", "add_text",
  "copy", "paste", "select_all",
  "voice_toggle", "smart_ink_cycle",
  "pen", "eraser", "highlighter_toggle",
];

export function isTool(value: string): value is Tool {
  return (TOOL_NAMES as string[]).includes(value);
}

export function isAction(value: string): value is GestureAction {
  return (ACTION_NAMES as string[]).includes(value);
}

export interface ActionContext {
  setTool: (t: Tool) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  save: () => void;
  screenshot: () => void;
  cycleColor: (dir: 1 | -1) => void;
  changeSize: (delta: number) => void;
  setSize?: (n: number) => void;
  cycleLayer: (dir?: 1 | -1) => void;
  toggleCamera: () => void;
  toggleGrid: () => void;
  toggleSnap?: () => void;
  toggleMirror?: () => void;
  togglePalm?: () => void;
  toggleFullscreen: () => void;
  duplicate: () => void;
  deleteSelected: () => void;
  click?: () => void;
  themeNext?: () => void;
  lockCanvas?: () => void;
  addSticky?: () => void;
  addText?: () => void;
  copy?: () => void;
  paste?: () => void;
  selectAll?: () => void;
  voiceToggle?: () => void;
  smartInkCycle?: () => void;
  highlighterToggle?: () => void;
}

/** Run a mapped value (Tool or GestureAction) against the running app. */
export function runMapping(value: string | undefined, ctx: ActionContext) {
  if (!value || value === "none") return;
  if (isTool(value)) {
    ctx.setTool(value);
    return;
  }
  switch (value as GestureAction) {
    case "undo": return ctx.undo();
    case "redo": return ctx.redo();
    case "clear": return ctx.clear();
    case "save": return ctx.save();
    case "screenshot": return ctx.screenshot();
    case "color_next": return ctx.cycleColor(1);
    case "color_prev": return ctx.cycleColor(-1);
    case "size_up": return ctx.changeSize(+1);
    case "size_down": return ctx.changeSize(-1);
    case "size_min": return ctx.setSize?.(1);
    case "size_max": return ctx.setSize?.(32);
    case "layer_next": return ctx.cycleLayer(1);
    case "layer_prev": return ctx.cycleLayer(-1);
    case "toggle_camera": return ctx.toggleCamera();
    case "toggle_grid": return ctx.toggleGrid();
    case "toggle_snap": return ctx.toggleSnap?.();
    case "toggle_mirror": return ctx.toggleMirror?.();
    case "toggle_palm": return ctx.togglePalm?.();
    case "toggle_fullscreen": return ctx.toggleFullscreen();
    case "duplicate": return ctx.duplicate();
    case "delete_selected": return ctx.deleteSelected();
    case "click": return ctx.click?.();
    case "theme_next": return ctx.themeNext?.();
    case "lock_canvas": return ctx.lockCanvas?.();
    case "add_sticky": return ctx.addSticky?.();
    case "add_text": return ctx.addText?.();
    case "copy": return ctx.copy?.();
    case "paste": return ctx.paste?.();
    case "select_all": return ctx.selectAll?.();
    case "voice_toggle": return ctx.voiceToggle?.();
    case "smart_ink_cycle": return ctx.smartInkCycle?.();
    case "pen": return ctx.setTool("pen");
    case "eraser": return ctx.setTool("eraser");
    case "highlighter_toggle": return ctx.highlighterToggle?.();
  }
}
