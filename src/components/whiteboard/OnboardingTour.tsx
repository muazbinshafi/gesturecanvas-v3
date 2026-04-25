import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

const STEPS = [
  { title: "Welcome to Gesture Whiteboard ✨", body: "Draw with your mouse, finger, or — best of all — with your hand using your webcam." },
  { title: "Pick your tool on the left", body: "Pen, shapes, text, eraser. Tap a colour, drag the slider for thickness." },
  { title: "Enable hand tracking", body: "Tap the camera icon on the right. Index up = draw, open hand = erase, fist = pan, pinch = select." },
  { title: "Smart Ink", body: "Sloppy circles snap to clean shapes. Handwriting is auto-recognised when online." },
  { title: "You're ready", body: "Export PNG/JSON or generate a public share link from Export. Sign in to sync settings." },
];

export function OnboardingTour() {
  const [run, setRun] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem("onboarding_done");
    if (!done) setTimeout(() => setRun(true), 700);
  }, []);

  if (!run) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  function close() {
    localStorage.setItem("onboarding_done", "1");
    setRun(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <Card className="glass w-full max-w-md p-6 relative shadow-elegant">
        <button onClick={close} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" aria-label="Close tour">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-accent)" }}>
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <h2 className="font-semibold">{s.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">{s.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={close}>Skip</Button>
            <Button size="sm" onClick={() => last ? close() : setStep((s) => s + 1)}>{last ? "Get started" : "Next"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
