/**
 * Hand-landmark math.
 * MediaPipe returns 21 landmarks per hand in normalized [0,1] image coords.
 *
 * Precision notes:
 *  - Raw distances depend on hand size & camera distance, so we normalize
 *    pinch / spread by palm size (wrist → middle MCP). This makes thresholds
 *    invariant to hand size and zoom level.
 *  - Finger extension is judged via joint angle (PIP) rather than a loose
 *    tip-vs-pip distance ratio — gives sub-cm discrimination.
 */

export interface LM { x: number; y: number; z: number }

export interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

const dist2 = (a: LM, b: LM) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const dist = (a: LM, b: LM) => Math.hypot(a.x - b.x, a.y - b.y);

/** Palm size = wrist → middle-finger MCP. Used as a hand-size unit. */
export function palmSize(lm: LM[]): number {
  return dist(lm[0], lm[9]) || 1e-6;
}

/**
 * Joint angle at a 3-point chain (radians, 0 = straight, π = fully bent backward).
 * For finger curl: angle near π means straight; near π/2 or less means curled.
 */
function jointAngle(a: LM, b: LM, c: LM): number {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1e-6;
  return Math.acos(Math.max(-1, Math.min(1, dot / m)));
}

/**
 * A finger is "extended" when its PIP joint is nearly straight.
 * Threshold ~2.2 rad (≈126°) — tighter than the old 1.15× distance ratio,
 * so a slightly bent index reads as "not extended".
 */
function fingerExtended(mcp: LM, pip: LM, dip: LM, tip: LM): boolean {
  const a1 = jointAngle(mcp, pip, dip);
  const a2 = jointAngle(pip, dip, tip);
  // Both joints nearly straight.
  return a1 > 2.2 && a2 > 2.0;
}

function thumbExtended(lm: LM[]): boolean {
  // Thumb has different topology — use IP joint angle + tip-to-wrist distance.
  const a = jointAngle(lm[2], lm[3], lm[4]);
  return a > 2.4 && dist2(lm[0], lm[4]) > dist2(lm[0], lm[3]) * 1.05;
}

export function fingerStates(lm: LM[]): FingerStates {
  return {
    thumb: thumbExtended(lm),
    index:  fingerExtended(lm[5],  lm[6],  lm[7],  lm[8]),
    middle: fingerExtended(lm[9],  lm[10], lm[11], lm[12]),
    ring:   fingerExtended(lm[13], lm[14], lm[15], lm[16]),
    pinky:  fingerExtended(lm[17], lm[18], lm[19], lm[20]),
  };
}

/** Raw pinch distance between thumb tip and index tip (normalized image units). */
export function pinchDistance(lm: LM[]): number {
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
}

/**
 * Pinch distance expressed as a fraction of palm size.
 * < ~0.35 ≈ a few-cm gap on a typical adult hand at 60cm from camera.
 * < ~0.15 ≈ tips touching.
 */
export function pinchRatio(lm: LM[]): number {
  return pinchDistance(lm) / palmSize(lm);
}

export function toCanvas(lm: LM, w: number, h: number, mirror = true): { x: number; y: number } {
  return { x: (mirror ? 1 - lm.x : lm.x) * w, y: lm.y * h };
}
