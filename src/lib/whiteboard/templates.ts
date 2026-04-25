/**
 * Built-in board templates seeded into a new board.
 */
import type { BoardObject, ShapeObject, StickyObject, TextObject } from "./types";

const id = () => Math.random().toString(36).slice(2);
const now = () => Date.now();

export interface BoardTemplate {
  key: string;
  name: string;
  description: string;
  emoji: string;
  build: (w: number, h: number) => BoardObject[];
}

function rect(x: number, y: number, w: number, h: number, color = "#a78bfa"): ShapeObject {
  return { id: id(), type: "rect", x, y, w, h, color, size: 2, createdAt: now(), layer: "shapes" };
}
function text(x: number, y: number, t: string, color = "#f8fafc", size = 18): TextObject {
  return { id: id(), type: "text", x, y, text: t, color, size, createdAt: now(), layer: "text" };
}
function sticky(x: number, y: number, t: string, bg = "#fde68a"): StickyObject {
  return { id: id(), type: "sticky", x, y, w: 160, h: 100, text: t, bg, color: "#1f2937", size: 14, createdAt: now(), layer: "objects" };
}

export const TEMPLATES: BoardTemplate[] = [
  {
    key: "blank", name: "Blank", description: "Empty canvas", emoji: "📄",
    build: () => [],
  },
  {
    key: "kanban", name: "Kanban", description: "To Do · In Progress · Done", emoji: "📋",
    build: (w, h) => {
      const cw = Math.floor((w - 80) / 3);
      const ch = Math.floor(h - 80);
      const cols = ["To Do", "In Progress", "Done"];
      const colors = ["#22d3ee", "#facc15", "#34d399"];
      const objs: BoardObject[] = [];
      cols.forEach((label, i) => {
        const x = 20 + i * (cw + 20);
        objs.push(rect(x, 50, cw, ch, colors[i]));
        objs.push(text(x + 12, 60, label, colors[i], 18));
        objs.push(sticky(x + 16, 110, "First task"));
      });
      objs.push(text(20, 20, "Kanban board", "#f8fafc", 24));
      return objs;
    },
  },
  {
    key: "mindmap", name: "Mind map", description: "Central idea + branches", emoji: "🧠",
    build: (w, h) => {
      const cx = w / 2, cy = h / 2;
      const objs: BoardObject[] = [];
      objs.push(rect(cx - 80, cy - 30, 160, 60, "#a78bfa"));
      objs.push(text(cx - 60, cy - 12, "Central idea", "#a78bfa", 18));
      const branches = [["Idea A", -260, -160], ["Idea B", 260, -160], ["Idea C", -260, 160], ["Idea D", 260, 160]] as const;
      for (const [label, dx, dy] of branches) {
        const x = cx + dx, y = cy + dy;
        objs.push(rect(x - 70, y - 25, 140, 50, "#22d3ee"));
        objs.push(text(x - 50, y - 8, label, "#22d3ee", 16));
        objs.push({ id: id(), type: "arrow", x: cx, y: cy, w: x - cx, h: y - cy, color: "#94a3b8", size: 2, createdAt: now(), layer: "shapes" });
      }
      return objs;
    },
  },
  {
    key: "flowchart", name: "Flowchart", description: "Start → Process → End", emoji: "🔀",
    build: (w) => {
      const cx = w / 2;
      const objs: BoardObject[] = [];
      const blocks = [["Start", 80, "#34d399"], ["Process", 220, "#facc15"], ["Decision", 360, "#22d3ee"], ["End", 500, "#f87171"]] as const;
      let prev: { x: number; y: number } | null = null;
      for (const [label, y, color] of blocks) {
        objs.push(rect(cx - 90, y, 180, 80, color as string));
        objs.push(text(cx - 30, y + 30, label as string, color as string, 18));
        if (prev) objs.push({ id: id(), type: "arrow", x: prev.x, y: prev.y, w: 0, h: y - prev.y, color: "#94a3b8", size: 2, createdAt: now(), layer: "shapes" });
        prev = { x: cx, y: y + 80 };
      }
      return objs;
    },
  },
  {
    key: "storyboard", name: "Storyboard", description: "6-panel grid", emoji: "🎬",
    build: (w, h) => {
      const cols = 3, rows = 2;
      const cw = Math.floor((w - 60) / cols), ch = Math.floor((h - 80) / rows);
      const objs: BoardObject[] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = 20 + c * (cw + 10), y = 50 + r * (ch + 10);
        objs.push(rect(x, y, cw, ch, "#94a3b8"));
        objs.push(text(x + 8, y + 8, `Panel ${r * cols + c + 1}`, "#94a3b8", 14));
      }
      objs.push(text(20, 20, "Storyboard", "#f8fafc", 22));
      return objs;
    },
  },
];
