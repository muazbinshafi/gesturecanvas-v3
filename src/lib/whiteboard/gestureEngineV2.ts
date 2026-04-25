/**
 * Gesture Engine v2 — hybrid recognition.
 *
 * Static poses → MediaPipe GestureRecognizer (pre-trained ML classifier).
 * Motion gestures (swipes, dwell) → existing geometric MotionDetector on the
 * smoothed cursor stream.
 *
 * MediaPipe's built-in classifier returns one of these category names:
 *   "None", "Closed_Fist", "Open_Palm", "Pointing_Up", "Thumb_Up",
 *   "Thumb_Down", "Victory", "ILoveYou".
 *
 * We map ML categories → our 5-pose minimal vocabulary plus optional extras
 * (so the existing remap UI keeps working). Pinch is detected geometrically
 * because the pre-trained model has no pinch class.
 */
import type { Pose } from "./types";
import { pinchRatio, palmSize, type LM } from "./landmarks";

/** Map an ML category name to one of our internal Pose values. */
export function mapCategoryToPose(category: string): Pose {
  switch (category) {
    case "Pointing_Up":  return "DRAW";       // index up → draw / cursor
    case "Open_Palm":    return "PAN";        // open palm → pan
    case "Closed_Fist":  return "ERASE";      // fist → erase
    case "Victory":      return "PEACE";      // peace sign (optional)
    case "Thumb_Up":     return "THUMBS_UP";
    case "Thumb_Down":   return "THUMBS_DOWN";
    case "ILoveYou":     return "ROCK";       // 🤟 maps to rock
    default:             return "NONE";
  }
}

export interface ClassifierInput {
  /** Top-1 category from MediaPipe GestureRecognizer (or empty if no hand). */
  category: string;
  /** Top-1 score from MediaPipe (0–1). */
  score: number;
  /** Hand landmarks (21 points). Required for geometric pinch detection. */
  landmarks: LM[] | null;
}

export interface ClassifierOutput {
  pose: Pose;
  /** Confidence in [0,1]. For ML poses = ML score; for PINCH = geometric score. */
  confidence: number;
}

/**
 * Geometric pinch detector — independent of ML classifier.
 * Returns a confidence score in [0,1] based on how tight the pinch is.
 *
 * ratio < 0.18  →  confidence 1.0  (tips touching)
 * ratio < 0.40  →  linear ramp
 * ratio ≥ 0.40  →  confidence 0    (no pinch)
 */
function pinchConfidence(landmarks: LM[]): number {
  const ratio = pinchRatio(landmarks);
  if (ratio < 0.18) return 1.0;
  if (ratio < 0.40) return 1 - (ratio - 0.18) / (0.40 - 0.18);
  return 0;
}

/**
 * Classify a single frame.
 *
 * Decision order:
 *   1. Pinch wins if geometric confidence ≥ 0.6 (overrides ML).
 *      Reason: ML often labels a pinching hand as "Pointing_Up" or "None".
 *   2. Otherwise use ML category if its score ≥ minMlScore.
 *   3. Otherwise NONE.
 */
export function classifyFrame(
  input: ClassifierInput,
  minMlScore = 0.55,
  pinchSensitivity = 0.5,
): ClassifierOutput {
  if (!input.landmarks || input.landmarks.length === 0) {
    return { pose: "NONE", confidence: 0 };
  }

  // 1) Geometric pinch (independent of ML).
  const pConf = pinchConfidence(input.landmarks);
  // pinchSensitivity in [0,1] adjusts the trigger threshold.
  // 0 → strict (need 0.85), 1 → loose (need 0.35).
  const pinchTrigger = 0.85 - pinchSensitivity * 0.5;
  if (pConf >= pinchTrigger) {
    return { pose: "PINCH", confidence: pConf };
  }

  // 2) ML category.
  if (input.category && input.score >= minMlScore) {
    const pose = mapCategoryToPose(input.category);
    if (pose !== "NONE") return { pose, confidence: input.score };
  }

  // 3) Index-up fallback when ML is uncertain — purely geometric.
  // Uses landmark[8] (index tip) above landmark[5] (index MCP) by > 30% palm size,
  // and other fingertips below their PIPs.
  const lm = input.landmarks;
  const palm = palmSize(lm);
  const indexUp = lm[5].y - lm[8].y > palm * 0.4;
  const middleDown = lm[12].y > lm[10].y;
  const ringDown = lm[16].y > lm[14].y;
  const pinkyDown = lm[20].y > lm[18].y;
  if (indexUp && middleDown && ringDown && pinkyDown) {
    return { pose: "DRAW", confidence: 0.6 };
  }

  return { pose: "NONE", confidence: 0 };
}

/**
 * Confidence-gated stabilizer.
 *
 * Commits a new pose only after BOTH:
 *   - The same candidate appears for `framesRequired` consecutive frames, AND
 *   - The mean confidence across those frames ≥ `minConfidence`.
 *
 * Releasing back to NONE requires 1.5× the frames (hysteresis) to ride out
 * brief tracking gaps.
 */
export class ConfidenceStabilizer {
  private current: Pose = "NONE";
  private candidate: Pose = "NONE";
  private confSum = 0;
  private count = 0;

  constructor(private framesRequired = 4, private minConfidence = 0.55) {}

  setFrames(n: number) { this.framesRequired = Math.max(1, Math.min(20, Math.round(n))); }
  setMinConfidence(c: number) { this.minConfidence = Math.max(0, Math.min(1, c)); }

  /** Confidence of the *candidate* in [0,1] — useful for UI. */
  confidence(): number {
    const need = this.required(this.candidate);
    return Math.max(0, Math.min(1, this.count / need));
  }
  candidatePose(): Pose { return this.candidate; }
  currentPose(): Pose { return this.current; }

  private required(next: Pose): number {
    // Releasing committed pose to NONE is harder.
    if (this.current !== "NONE" && next === "NONE") {
      return Math.ceil(this.framesRequired * 1.5);
    }
    return this.framesRequired;
  }

  push(next: Pose, conf: number): Pose {
    // Same as committed → reset candidate counters but keep current.
    if (next === this.current) {
      this.candidate = next;
      this.count = 0;
      this.confSum = 0;
      return this.current;
    }
    if (next === this.candidate) {
      this.count++;
      this.confSum += conf;
    } else {
      this.candidate = next;
      this.count = 1;
      this.confSum = conf;
    }
    const need = this.required(next);
    if (this.count >= need) {
      const mean = this.confSum / this.count;
      // For NONE → committed transitions ignore confidence (we already meet frames).
      // For non-NONE candidates require mean confidence.
      if (next === "NONE" || mean >= this.minConfidence) {
        this.current = next;
        this.count = 0;
        this.confSum = 0;
      }
    }
    return this.current;
  }

  reset() {
    this.current = "NONE";
    this.candidate = "NONE";
    this.count = 0;
    this.confSum = 0;
  }
}
