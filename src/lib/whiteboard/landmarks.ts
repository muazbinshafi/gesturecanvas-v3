/**
 * Hand-landmark math.
 * MediaPipe returns 21 landmarks per hand.
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

function isExtended(wrist: LM, _mcp: LM, pip: LM, tip: LM): boolean {
  return dist2(wrist, tip) > dist2(wrist, pip) * 1.15;
}

export function fingerStates(lm: LM[]): FingerStates {
  const wrist = lm[0];
  return {
    thumb: dist2(wrist, lm[4]) > dist2(wrist, lm[3]) * 1.05,
    index: isExtended(wrist, lm[5], lm[6], lm[8]),
    middle: isExtended(wrist, lm[9], lm[10], lm[12]),
    ring: isExtended(wrist, lm[13], lm[14], lm[16]),
    pinky: isExtended(wrist, lm[17], lm[18], lm[20]),
  };
}

export function pinchDistance(lm: LM[]): number {
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
}

export function toCanvas(lm: LM, w: number, h: number, mirror = true): { x: number; y: number } {
  return { x: (mirror ? 1 - lm.x : lm.x) * w, y: lm.y * h };
}
