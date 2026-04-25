/**
 * Adaptive gesture stability controller.
 *
 * Tracks "false trigger" rate over a rolling window and nudges the
 * PoseStabilizer threshold up or down to balance responsiveness vs accuracy.
 *
 * Heuristic for a false trigger: an UNDO action issued shortly after a
 * gesture-driven action (within UNDO_WINDOW_MS). The user effectively said
 * "no, that wasn't what I meant".
 */

const UNDO_WINDOW_MS = 2500;          // undo within this window after an action = false trigger
const SAMPLE_WINDOW_MS = 60_000;      // 1 minute rolling window
const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 10;
const HIGH_FALSE_RATE = 0.35;         // > 35% of recent actions were undone
const LOW_FALSE_RATE = 0.05;

interface Event {
  t: number;
  type: "action" | "undo";
}

export class AdaptiveStability {
  private events: Event[] = [];
  private lastActionAt = 0;
  /** Current effective threshold the stabilizer should use. */
  private threshold: number;
  private base: number;

  constructor(baseThreshold: number) {
    this.base = baseThreshold;
    this.threshold = baseThreshold;
  }

  setBase(base: number) {
    this.base = base;
    // Clamp the live threshold near the new base.
    this.threshold = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, base));
  }

  noteAction() {
    const now = performance.now();
    this.lastActionAt = now;
    this.events.push({ t: now, type: "action" });
    this.prune(now);
    this.recompute();
  }

  noteUndo() {
    const now = performance.now();
    if (now - this.lastActionAt < UNDO_WINDOW_MS) {
      this.events.push({ t: now, type: "undo" });
    }
    this.prune(now);
    this.recompute();
  }

  /** Current effective threshold (1..10). */
  current(): number {
    return this.threshold;
  }

  /** Recent false-trigger rate in [0,1]. */
  rate(): number {
    this.prune(performance.now());
    const actions = this.events.filter((e) => e.type === "action").length;
    if (actions === 0) return 0;
    const undos = this.events.filter((e) => e.type === "undo").length;
    return Math.min(1, undos / actions);
  }

  private prune(now: number) {
    const cutoff = now - SAMPLE_WINDOW_MS;
    while (this.events.length && this.events[0].t < cutoff) this.events.shift();
  }

  private recompute() {
    const r = this.rate();
    let next = this.threshold;
    if (r > HIGH_FALSE_RATE) next = Math.min(MAX_THRESHOLD, this.threshold + 1);
    else if (r < LOW_FALSE_RATE) next = Math.max(MIN_THRESHOLD, this.base);
    // Never stray more than +4 above the base.
    next = Math.min(this.base + 4, next);
    this.threshold = Math.max(MIN_THRESHOLD, next);
  }
}
