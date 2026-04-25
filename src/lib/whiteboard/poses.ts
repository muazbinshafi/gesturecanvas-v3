/**
 * Pose classifier with simple hysteresis.
 * Uses palm-size-normalized distances for hand-size & camera-distance invariance.
 *
 * Pinch detection: configurable sensitivity (`setPinchSensitivity`) maps to a
 * ratio threshold of pinchDistance/palmSize. Lower sensitivity = need tighter
 * pinch to trigger; higher sensitivity = recognize wider gaps as pinch.
 */
import type { Pose } from "./types";
import { fingerStates, pinchRatio, palmSize, type LM } from "./landmarks";

/** Default ratio = 0.4425 ≈ recognizes a visible 2–3cm pinch gap on a typical hand. */
let PINCH_RATIO_THRESHOLD = 0.4425;
/** OK sign requires tips actually touching: tighter ratio. */
let OK_RATIO_THRESHOLD = 0.18;

/**
 * Set pinch sensitivity in [0,1].
 *  - 0.0 → very strict (must touch, ratio ≈ 0.15)
 *  - 0.5 → default (ratio ≈ 0.35, ≈3-4cm gap recognized)
 *  - 1.0 → very loose (ratio ≈ 0.6, several-cm gap recognized)
 */
export function setPinchSensitivity(s: number) {
  const clamped = Math.max(0, Math.min(1, s));
  PINCH_RATIO_THRESHOLD = 0.22 + clamped * 0.45;
  OK_RATIO_THRESHOLD = 0.08 + clamped * 0.12;
}
export function getPinchRatioThreshold() { return PINCH_RATIO_THRESHOLD; }

function dist(a: LM, b: LM) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function classifyPose(lm: LM[]): Pose {
  const f = fingerStates(lm);
  const ratio = pinchRatio(lm);
  const palm = palmSize(lm);

  // OK sign: thumb tip touches index tip, other three extended
  if (ratio < OK_RATIO_THRESHOLD && f.middle && f.ring && f.pinky && !f.index) return "OK";

  // Pinch (thumb+index close). We accept ANY state of the other three fingers
  // because users naturally pinch with the rest of the hand relaxed/open —
  // requiring all three curled made pinch nearly impossible to trigger.
  if (ratio < PINCH_RATIO_THRESHOLD) return "PINCH";

  // FIVE_SPREAD vs ERASE — all fingers extended; spread normalized by palm size
  if (f.thumb && f.index && f.middle && f.ring && f.pinky) {
    const spread = (dist(lm[8], lm[12]) + dist(lm[12], lm[16]) + dist(lm[16], lm[20])) / palm;
    if (spread > 1.4) return "FIVE_SPREAD";
    return "ERASE";
  }

  // FOUR — index+middle+ring+pinky extended, thumb tucked
  if (!f.thumb && f.index && f.middle && f.ring && f.pinky) return "FOUR";

  // Rock sign — index + pinky extended, middle/ring curled
  if (f.index && !f.middle && !f.ring && f.pinky) return "ROCK";

  // Call me — thumb + pinky extended, others curled
  if (f.thumb && !f.index && !f.middle && !f.ring && f.pinky) return "CALL";

  // PINKY_UP — only pinky extended
  if (!f.thumb && !f.index && !f.middle && !f.ring && f.pinky) return "PINKY_UP";

  // MIDDLE_UP — only middle extended
  if (!f.thumb && !f.index && f.middle && !f.ring && !f.pinky) return "MIDDLE_UP";

  // Gun — thumb + index extended, others curled (and not pinching)
  if (f.thumb && f.index && !f.middle && !f.ring && !f.pinky && ratio > PINCH_RATIO_THRESHOLD) {
    // L-shape vs gun: in L the thumb is roughly perpendicular to index
    const v1x = lm[8].x - lm[5].x, v1y = lm[8].y - lm[5].y;
    const v2x = lm[4].x - lm[2].x, v2y = lm[4].y - lm[2].y;
    const dot = v1x * v2x + v1y * v2y;
    const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1;
    const ang = Math.acos(Math.max(-1, Math.min(1, dot / m)));
    if (ang > 1.0) return "L_SHAPE"; // ~> 57°
    return "GUN";
  }

  // Thumbs up / down — only thumb extended
  if (f.thumb && !f.index && !f.middle && !f.ring && !f.pinky) {
    return lm[4].y < lm[2].y ? "THUMBS_UP" : "THUMBS_DOWN";
  }

  // Peace / V — index + middle extended (no ring/pinky); separation by palm
  if (!f.thumb && f.index && f.middle && !f.ring && !f.pinky) {
    const sep = dist(lm[8], lm[12]) / palm;
    return sep > 0.42 ? "PEACE" : "HOVER";
  }

  // Three fingers (index+middle+ring) — used for shape mode
  if (!f.thumb && f.index && f.middle && f.ring && !f.pinky) return "THREE";

  // INDEX_DOWN — only index, but pointing downward (tip below MCP)
  if (f.index && !f.middle && !f.ring && !f.pinky) {
    if (lm[8].y > lm[5].y + palm * 0.32) return "INDEX_DOWN";
    return "DRAW";
  }

  // PALM_SIDE vs PAN — closed fist; check wrist orientation
  if (!f.index && !f.middle && !f.ring && !f.pinky) {
    const dxThumb = Math.abs(lm[4].x - lm[0].x);
    const dyThumb = Math.abs(lm[4].y - lm[0].y);
    if (f.thumb && dxThumb > dyThumb * 1.6) return "PALM_SIDE";
    if (!f.thumb) return "FIST_THUMB";
    return "PAN";
  }

  return "NONE";
}

/**
 * PoseStabilizer with hysteresis.
 *
 * - To COMMIT a new pose: candidate must persist `threshold` consecutive frames.
 * - To LEAVE the committed pose for "NONE": requires `threshold * 2` frames
 *   (prevents flicker when hand briefly leaves a stable shape mid-motion).
 * - Switching directly between two real poses still uses `threshold` frames.
 */
export class PoseStabilizer {
  private current: Pose = "NONE";
  private candidate: Pose = "NONE";
  private count = 0;
  constructor(private threshold = 6) {}
  setThreshold(t: number) { this.threshold = Math.max(1, Math.min(20, Math.round(t))); }
  confidence(): number {
    const need = this.requiredFor(this.candidate);
    return Math.max(0, Math.min(1, this.count / need));
  }
  candidatePose(): Pose { return this.candidate; }
  private requiredFor(next: Pose): number {
    // Releasing a stable pose to NONE is harder — ride out brief tracking gaps.
    if (this.current !== "NONE" && next === "NONE") return this.threshold * 2;
    return this.threshold;
  }
  push(next: Pose): Pose {
    if (next === this.current) { this.candidate = next; this.count = 0; return this.current; }
    if (next === this.candidate) { this.count++; }
    else { this.candidate = next; this.count = 1; }
    if (this.count >= this.requiredFor(next)) { this.current = next; this.count = 0; }
    return this.current;
  }
}
