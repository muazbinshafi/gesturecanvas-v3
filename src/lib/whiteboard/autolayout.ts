/**
 * Diagram auto-layout: when an arrow's endpoints land near existing shapes,
 * snap them to the shape's nearest edge midpoint and remember the link.
 */
import type { BoardObject, ShapeObject } from "./types";

interface BBox { id: string; cx: number; cy: number; w: number; h: number; x: number; y: number }

function shapeBBox(o: ShapeObject): BBox {
  const x = Math.min(o.x, o.x + o.w);
  const y = Math.min(o.y, o.y + o.h);
  const w = Math.abs(o.w);
  const h = Math.abs(o.h);
  return { id: o.id, cx: x + w / 2, cy: y + h / 2, w, h, x, y };
}

function nearestEdgePoint(b: BBox, fromX: number, fromY: number) {
  const cx = b.cx, cy = b.cy;
  const dx = fromX - cx;
  const dy = fromY - cy;
  if (Math.abs(dx) * b.h > Math.abs(dy) * b.w) {
    // hits left/right
    return { x: dx > 0 ? b.x + b.w : b.x, y: cy };
  }
  return { x: cx, y: dy > 0 ? b.y + b.h : b.y };
}

function findShapeAt(objects: BoardObject[], x: number, y: number, threshold: number): BBox | null {
  let best: { b: BBox; d: number } | null = null;
  for (const o of objects) {
    if (o.type !== "rect" && o.type !== "circle") continue;
    const b = shapeBBox(o as ShapeObject);
    const padX = b.w / 2 + threshold;
    const padY = b.h / 2 + threshold;
    if (Math.abs(x - b.cx) <= padX && Math.abs(y - b.cy) <= padY) {
      const d = Math.hypot(x - b.cx, y - b.cy);
      if (!best || d < best.d) best = { b, d };
    }
  }
  return best ? best.b : null;
}

export function autoLayoutArrow(arrow: ShapeObject, allObjects: BoardObject[], threshold = 24): ShapeObject {
  const x1 = arrow.x;
  const y1 = arrow.y;
  const x2 = arrow.x + arrow.w;
  const y2 = arrow.y + arrow.h;
  const from = findShapeAt(allObjects.filter((o) => o.id !== arrow.id), x1, y1, threshold);
  const to = findShapeAt(allObjects.filter((o) => o.id !== arrow.id), x2, y2, threshold);
  let nx1 = x1, ny1 = y1, nx2 = x2, ny2 = y2;
  let fromId: string | undefined; let toId: string | undefined;
  if (from) {
    const p = nearestEdgePoint(from, x2, y2);
    nx1 = p.x; ny1 = p.y; fromId = from.id;
  }
  if (to) {
    const p = nearestEdgePoint(to, nx1, ny1);
    nx2 = p.x; ny2 = p.y; toId = to.id;
  }
  if (!from && !to) return arrow;
  return { ...arrow, x: nx1, y: ny1, w: nx2 - nx1, h: ny2 - ny1, fromId, toId };
}
