/**
 * Map a GestureMappings entry to either a Tool selection or an action callback.
 */
import type { GestureAction, Tool } from "./types";

export const TOOL_NAMES: Tool[] = [
  "pen", "eraser", "rect", "circle", "arrow", "text", "select", "pan", "sticky", "image",
];

export const ACTION_NAMES: GestureAction[] = [
  "none",
  "undo", "redo", "clear", "save", "screenshot",
  "color_next", "color_prev",
  "size_up", "size_down",
  "layer_next", "toggle_camera", "toggle_grid",
  "toggle_fullscreen", "duplicate", "delete_selected",
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
  cycleLayer: () => void;
  toggleCamera: () => void;
  toggleGrid: () => void;
  toggleFullscreen: () => void;
  duplicate: () => void;
  deleteSelected: () => void;
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
    case "layer_next": return ctx.cycleLayer();
    case "toggle_camera": return ctx.toggleCamera();
    case "toggle_grid": return ctx.toggleGrid();
    case "toggle_fullscreen": return ctx.toggleFullscreen();
    case "duplicate": return ctx.duplicate();
    case "delete_selected": return ctx.deleteSelected();
  }
}
