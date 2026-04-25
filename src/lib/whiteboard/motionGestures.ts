/**
 * Motion-based gesture detector — runs on a rolling buffer of cursor samples.
 * Detects swipes (L/R/U/D), circles (CW/CCW), and dwell (hold-still).
 *
 * Emits a virtual `Pose` exactly once per detection. Caller must clear the
 * buffer via `reset()` after consuming the event so the same swing isn't
 * re-detected.
 */
import type { Pose } from "./types";

export interface MotionSample { x: number; y: number; t: number }

export interface MotionConfig {
  /** Minimum px traveled along axis to count as swipe. */
  swipeMinDistance: number;
  /** Maximum ms a swipe may take. */
  swipeMaxDuration: number;
  /** Dwell radius (px) the cursor must stay within. */
  dwellRadius: number;
  /** Dwell hold time (ms) before firing DWELL. */
  dwellMs: number;
  /** Enable circle detection. */
  circleEnabled: boolean;
  /** Minimum total angular travel for a circle (rad). */
  circleMinAngle: number;
  enabled: boolean;
}

export const DEFAULT_MOTION: MotionConfig = {
  swipeMinDistance: 220,
  swipeMaxDuration: 500,
  dwellRadius: 18,
  dwellMs: 800,
  // Circle detection is OFF by default — it triggered false positives on
  // ordinary hand movement and (when mapped to zoom) caused runaway redraws
  // that froze low-end devices.
  circleEnabled: false,
  circleMinAngle: Math.PI * 1.8,
  enabled: true,
};

const MAX_BUFFER_MS = 1500;

export class MotionDetector {
  private buf: MotionSample[] = [];
  private lastFire = 0;
  private cfg: MotionConfig;

  constructor(cfg: Partial<MotionConfig> = {}) {
    this.cfg = { ...DEFAULT_MOTION, ...cfg };
  }

  setConfig(cfg: Partial<MotionConfig>) { this.cfg = { ...this.cfg, ...cfg }; }
  reset() { this.buf = []; }

  push(x: number, y: number, t: number): Pose | null {
    if (!this.cfg.enabled) return null;
    this.buf.push({ x, y, t });
    while (this.buf.length && t - this.buf[0].t > MAX_BUFFER_MS) this.buf.shift();
    // 250ms cooldown between motion fires.
    if (t - this.lastFire < 250) return null;

    const dwell = this.detectDwell(t);
    if (dwell) { this.lastFire = t; this.reset(); return dwell; }

    const swipe = this.detectSwipe(t);
    if (swipe) { this.lastFire = t; this.reset(); return swipe; }

    if (this.cfg.circleEnabled) {
      const circle = this.detectCircle();
      if (circle) { this.lastFire = t; this.reset(); return circle; }
    }
    return null;
  }

  private detectDwell(now: number): Pose | null {
    if (this.buf.length < 8) return null;
    const window = this.buf.filter((p) => now - p.t <= this.cfg.dwellMs);
    if (window.length < 8) return null;
    if (now - window[0].t < this.cfg.dwellMs * 0.9) return null;
    const cx = window.reduce((s, p) => s + p.x, 0) / window.length;
    const cy = window.reduce((s, p) => s + p.y, 0) / window.length;
    const maxR = Math.max(...window.map((p) => Math.hypot(p.x - cx, p.y - cy)));
    return maxR <= this.cfg.dwellRadius ? "DWELL" : null;
  }

  private detectSwipe(now: number): Pose | null {
    if (this.buf.length < 4) return null;
    const recent = this.buf.filter((p) => now - p.t <= this.cfg.swipeMaxDuration);
    if (recent.length < 4) return null;
    const a = recent[0], b = recent[recent.length - 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) < this.cfg.swipeMinDistance) return null;
    if (adx > ady * 1.5) return dx > 0 ? "SWIPE_RIGHT" : "SWIPE_LEFT";
    if (ady > adx * 1.5) return dy > 0 ? "SWIPE_DOWN" : "SWIPE_UP";
    return null;
  }

  private detectCircle(): Pose | null {
    if (this.buf.length < 16) return null;
    const cx = this.buf.reduce((s, p) => s + p.x, 0) / this.buf.length;
    const cy = this.buf.reduce((s, p) => s + p.y, 0) / this.buf.length;
    let total = 0;
    for (let i = 1; i < this.buf.length; i++) {
      const a = Math.atan2(this.buf[i - 1].y - cy, this.buf[i - 1].x - cx);
      const b = Math.atan2(this.buf[i].y - cy, this.buf[i].x - cx);
      let d = b - a;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      total += d;
    }
    if (Math.abs(total) < this.cfg.circleMinAngle) return null;
    return total > 0 ? "CIRCLE_CW" : "CIRCLE_CCW";
  }
}
