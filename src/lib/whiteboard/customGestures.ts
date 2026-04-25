/**
 * Custom gesture template matching.
 * Normalize 21-landmark hand poses (translation + scale invariant) and
 * compare via mean pairwise distance. Lower = more similar.
 */
import type { CustomGestureTemplate } from "./types";

export interface RawLm { x: number; y: number; z: number }

export function normalizeLandmarks(lm: RawLm[]): RawLm[] {
  if (lm.length !== 21) return lm.map((p) => ({ ...p }));
  let cx = 0, cy = 0, cz = 0;
  for (const p of lm) { cx += p.x; cy += p.y; cz += p.z; }
  cx /= lm.length; cy /= lm.length; cz /= lm.length;
  let scale = 0;
  for (const p of lm) scale += Math.hypot(p.x - cx, p.y - cy);
  scale = scale / lm.length || 1;
  return lm.map((p) => ({ x: (p.x - cx) / scale, y: (p.y - cy) / scale, z: (p.z - cz) / scale }));
}

export function distance(a: RawLm[], b: RawLm[]): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return s / n;
}

export function bestMatch(lm: RawLm[], templates: CustomGestureTemplate[], threshold = 0.25): CustomGestureTemplate | null {
  if (!templates.length) return null;
  const norm = normalizeLandmarks(lm);
  let best: { t: CustomGestureTemplate; d: number } | null = null;
  for (const t of templates) {
    const d = distance(norm, t.landmarks);
    if (!best || d < best.d) best = { t, d };
  }
  return best && best.d < threshold ? best.t : null;
}
