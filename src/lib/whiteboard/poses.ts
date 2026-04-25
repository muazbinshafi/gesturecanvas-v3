/**
 * Pose classifier with simple hysteresis.
 * Expanded with thumbs up/down, peace, OK, rock, gun, L-shape, call-me, point-up.
 */
import type { Pose } from "./types";
import { fingerStates, pinchDistance, type LM } from "./landmarks";

const PINCH_THRESHOLD = 0.06;

function dist(a: LM, b: LM) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function classifyPose(lm: LM[]): Pose {
  const f = fingerStates(lm);
  const pinch = pinchDistance(lm);

  // OK sign: thumb tip touches index tip, other three extended
  if (pinch < 0.05 && f.middle && f.ring && f.pinky) return "OK";

  // Pinch (thumb+index close, others curled)
  if (pinch < PINCH_THRESHOLD && !f.middle && !f.ring && !f.pinky) return "PINCH";

  // Open hand (all five extended)
  if (f.thumb && f.index && f.middle && f.ring && f.pinky) return "ERASE";

  // Rock sign — index + pinky extended, middle/ring curled
  if (f.index && !f.middle && !f.ring && f.pinky) return "ROCK";

  // Call me — thumb + pinky extended, others curled
  if (f.thumb && !f.index && !f.middle && !f.ring && f.pinky) return "CALL";

  // Gun — thumb + index extended, others curled (and not pinching)
  if (f.thumb && f.index && !f.middle && !f.ring && !f.pinky && pinch > PINCH_THRESHOLD) {
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

  // Peace / V — index + middle extended (no ring/pinky)
  if (f.index && f.middle && !f.ring && !f.pinky) {
    const sep = dist(lm[8], lm[12]);
    return sep > 0.06 ? "PEACE" : "HOVER";
  }

  // Three fingers (index+middle+ring) — used for shape mode
  if (f.index && f.middle && f.ring && !f.pinky) return "THREE";

  // Single index finger — draw
  if (f.index && !f.middle && !f.ring && !f.pinky) return "DRAW";

  // Closed fist (all four fingers down)
  if (!f.index && !f.middle && !f.ring && !f.pinky) return "PAN";

  return "NONE";
}

export class PoseStabilizer {
  private current: Pose = "NONE";
  private candidate: Pose = "NONE";
  private count = 0;
  constructor(private threshold = 3) {}
  /** Allow runtime updates (e.g. adaptive stability or settings change). */
  setThreshold(t: number) { this.threshold = Math.max(1, Math.min(20, Math.round(t))); }
  /** Confidence in the *candidate* pose: count / threshold, clipped to [0,1]. */
  confidence(): number {
    return Math.max(0, Math.min(1, this.count / this.threshold));
  }
  candidatePose(): Pose { return this.candidate; }
  push(next: Pose): Pose {
    if (next === this.current) { this.candidate = next; this.count = 0; return this.current; }
    if (next === this.candidate) { this.count++; }
    else { this.candidate = next; this.count = 1; }
    if (this.count >= this.threshold) { this.current = next; this.count = 0; }
    return this.current;
  }
}
