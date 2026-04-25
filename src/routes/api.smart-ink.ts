import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/smart-ink")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { image?: unknown };
          const image = body?.image;
          if (!image || typeof image !== "string") {
            return Response.json({ error: "image (base64 data URL) is required" }, { status: 400 });
          }

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });
          }

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You inspect a small image of a hand-drawn sketch and decide what the user meant to draw. Respond ONLY by calling the recognize tool." },
                { role: "user", content: [
                  { type: "text", text: "Recognize this sketch." },
                  { type: "image_url", image_url: { url: image } },
                ]},
              ],
              tools: [{
                type: "function",
                function: {
                  name: "recognize",
                  description: "Return the recognized content of the sketch.",
                  parameters: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: ["text", "shape", "equation", "unknown"] },
                      value: { type: "string" },
                      confidence: { type: "number", minimum: 0, maximum: 1 },
                    },
                    required: ["kind", "value", "confidence"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "recognize" } },
            }),
          });

          if (resp.status === 429) return Response.json({ error: "Rate limited." }, { status: 429 });
          if (resp.status === 402) return Response.json({ error: "AI credits exhausted." }, { status: 402 });
          if (!resp.ok) {
            const t = await resp.text();
            console.error("AI gateway error", resp.status, t);
            return Response.json({ error: "AI gateway error" }, { status: 500 });
          }

          const data = await resp.json() as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> };
          const tc = data.choices?.[0]?.message?.tool_calls?.[0];
          const args = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : null;
          if (!args) return Response.json({ kind: "unknown", value: "", confidence: 0 });
          return Response.json(args);
        } catch (e) {
          console.error("smart-ink error", e);
          return Response.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
        }
      },
    },
  },
});
