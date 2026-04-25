// Smart Ink AI — calls the /api/smart-ink server route for handwriting/shape recognition.

export interface AIRecognition {
  kind: "text" | "shape" | "equation" | "unknown";
  value: string;
  confidence: number;
}

export async function recognizeInkAI(pngDataUrl: string, mode: "general" | "math" = "general"): Promise<AIRecognition | null> {
  try {
    const r = await fetch("/api/smart-ink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: pngDataUrl, mode }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as AIRecognition | { error: string };
    if ("error" in data) return null;
    return data;
  } catch (e) {
    console.warn("Smart Ink AI failed", e);
    return null;
  }
}
