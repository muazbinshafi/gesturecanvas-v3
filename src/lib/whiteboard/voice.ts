/**
 * Voice command recognition via Web Speech API.
 * Returns a stop function. Calls onCommand with normalized command keywords.
 */
export type VoiceCommand =
  | { kind: "undo" }
  | { kind: "clear" }
  | { kind: "save" }
  | { kind: "tool"; tool: string }
  | { kind: "color"; color: string }
  | { kind: "fullscreen" }
  | { kind: "exit" }
  | { kind: "record_start" }
  | { kind: "record_stop" }
  | { kind: "unknown"; text: string };

const COLOR_MAP: Record<string, string> = {
  red: "#f87171", crimson: "#dc2626", pink: "#f472b6",
  orange: "#fb923c", yellow: "#facc15", amber: "#fbbf24",
  green: "#34d399", lime: "#a3e635", teal: "#14b8a6",
  blue: "#22d3ee", cyan: "#22d3ee", sky: "#38bdf8", indigo: "#818cf8",
  purple: "#a78bfa", violet: "#a78bfa", magenta: "#e879f9",
  white: "#f8fafc", black: "#0d0f1a", gray: "#94a3b8", grey: "#94a3b8",
};

const TOOL_MAP: Record<string, string> = {
  pen: "pen", pencil: "pen", draw: "pen",
  eraser: "eraser", erase: "eraser", rubber: "eraser",
  rectangle: "rect", rect: "rect", square: "rect", box: "rect",
  circle: "circle", ellipse: "circle", oval: "circle",
  arrow: "arrow", line: "arrow",
  text: "text", type: "text",
  select: "select", selector: "select",
  pan: "pan", move: "pan", hand: "pan",
  sticky: "sticky", note: "sticky",
};

export function parseCommand(raw: string): VoiceCommand {
  const t = raw.toLowerCase().trim();
  if (/\b(undo|undue|undoe)\b/.test(t)) return { kind: "undo" };
  if (/\b(clear|wipe|erase all|reset board)\b/.test(t)) return { kind: "clear" };
  if (/\b(save|export|download)\b/.test(t)) return { kind: "save" };
  if (/\bfullscreen|full screen\b/.test(t)) return { kind: "fullscreen" };
  if (/\b(exit|escape|cancel|close)\b/.test(t)) return { kind: "exit" };
  if (/\b(start record|record start|begin record|start recording)\b/.test(t)) return { kind: "record_start" };
  if (/\b(stop record|record stop|end record|stop recording)\b/.test(t)) return { kind: "record_stop" };
  for (const [w, color] of Object.entries(COLOR_MAP)) {
    if (new RegExp(`\\b${w}\\b`).test(t) && /\b(pen|color|colour|ink|draw|brush)\b/.test(t)) return { kind: "color", color };
  }
  for (const [w, tool] of Object.entries(TOOL_MAP)) {
    if (new RegExp(`\\b${w}\\b`).test(t)) return { kind: "tool", tool };
  }
  return { kind: "unknown", text: t };
}

export interface VoiceController { stop: () => void; isActive: () => boolean }

// Minimal typing for the Web Speech API (TS lib doesn't ship these in all configs).
interface SpeechRecognitionResult { 0: { transcript: string }; isFinal: boolean }
interface SpeechRecognitionEvent { resultIndex: number; results: { length: number; [k: number]: SpeechRecognitionResult } }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

export function startVoice(lang: string, onCommand: (c: VoiceCommand) => void): VoiceController | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const r: SpeechRecognitionLike = new SR();
  r.lang = lang;
  r.continuous = true;
  r.interimResults = false;
  let active = true;
  r.onresult = (e: SpeechRecognitionEvent) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) onCommand(parseCommand(res[0].transcript));
    }
  };
  r.onerror = () => { /* ignore transient errors */ };
  r.onend = () => { if (active) { try { r.start(); } catch { /* noop */ } } };
  try { r.start(); } catch { return null; }
  return {
    stop: () => { active = false; try { r.abort(); } catch { /* noop */ } },
    isActive: () => active,
  };
}
