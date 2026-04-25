import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Hand, Pointer, Wifi, WifiOff, Maximize2, Camera,
  Pencil, Brain, Share2, Download, ShieldCheck,
  Smartphone, Monitor, Cpu, Heart, ArrowRight, Check,
  Layers, Languages, Lock, RefreshCw, Zap, Lightbulb,
  Terminal, Chrome, AppWindow,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gesture Whiteboard — Draw with your hands, online or offline" },
      { name: "description", content: "An AI-powered gesture-controlled whiteboard. Draw with your hand via webcam, or with mouse / touch. Recognises shapes and handwriting. Works fully offline on Linux, Windows, macOS, Android & iOS." },
      { property: "og:title", content: "Gesture Whiteboard — Draw with your hands" },
      { property: "og:description", content: "Webcam hand-tracking whiteboard with shape & handwriting recognition. Works offline on every modern browser." },
    ],
  }),
  component: HomePage,
});

const FEATURES = [
  { icon: Hand, title: "Hand-gesture drawing", desc: "Real-time MediaPipe hand-tracking turns your fingertip into a pen — no stylus required." },
  { icon: Pointer, title: "Touch & mouse fallback", desc: "No camera? Just draw with your finger or mouse. The board works exactly like a normal whiteboard." },
  { icon: Brain, title: "AI shape recognition", desc: "Sketch a circle, square, arrow or line — Smart Ink snaps it to a clean vector shape." },
  { icon: Languages, title: "Handwriting → text", desc: "Convert messy handwriting into typed text via the optional Smart Ink AI." },
  { icon: Maximize2, title: "Fullscreen camera mode", desc: "Verify framing with a live, edge-to-edge webcam preview before you start tracking." },
  { icon: Layers, title: "Multi-tool toolbar", desc: "Pen, marker, eraser, color picker and stroke-size slider — all keyboard accessible." },
  { icon: WifiOff, title: "Works fully offline", desc: "IndexedDB caching means you can draw on a plane, in a tunnel or on a Linux laptop with no Wi-Fi." },
  { icon: RefreshCw, title: "Cross-device sync", desc: "Sign in and your boards, settings and gesture mappings sync seamlessly across devices." },
  { icon: Share2, title: "Share read-only links", desc: "Publish a board with one click and share a public viewer URL with anyone." },
  { icon: Download, title: "PNG & JSON export", desc: "Export your art as a PNG image or portable JSON you can re-import later." },
  { icon: ShieldCheck, title: "Privacy-first", desc: "Webcam frames are processed locally in your browser — nothing is uploaded." },
  { icon: Cpu, title: "GPU-accelerated", desc: "MediaPipe runs on WebGL/WebGPU for buttery-smooth 30–60 fps tracking." },
];

const GESTURES: { name: string; pose: string; tool: string; desc: string; emoji: string }[] = [
  { name: "Draw",   pose: "DRAW",   tool: "Pen",      emoji: "☝️", desc: "Index finger up, all others curled. Move to draw a stroke." },
  { name: "Hover",  pose: "HOVER",  tool: "Cursor",   emoji: "✌️", desc: "Index + middle up. Move the cursor without drawing." },
  { name: "Erase",  pose: "ERASE",  tool: "Eraser",   emoji: "🖐️", desc: "All four fingers up. Wipe strokes with your palm." },
  { name: "Pinch",  pose: "PINCH",  tool: "Select",   emoji: "🤏", desc: "Touch thumb to index. Grab and move objects." },
  { name: "Pan",    pose: "PAN",    tool: "Pan",      emoji: "✊", desc: "Closed fist. Pan the canvas around." },
  { name: "None",   pose: "NONE",   tool: "Idle",     emoji: "🫥", desc: "Hand out of frame. Tracking pauses to save power." },
];

const RUNS_ON = [
  { icon: Monitor, name: "Linux" }, { icon: Monitor, name: "Windows" }, { icon: Monitor, name: "macOS" },
  { icon: Smartphone, name: "Android" }, { icon: Smartphone, name: "iOS" }, { icon: Monitor, name: "ChromeOS" },
];

const INSTALL_STEPS: { icon: typeof Chrome; os: string; steps: string[] }[] = [
  {
    icon: Chrome, os: "Any browser (recommended)",
    steps: [
      "Open the live URL in Chrome, Edge, Firefox or Safari 16+.",
      "Click 'Launch whiteboard' — no install required.",
      "Optional: click the install icon in the address bar to add it as a PWA.",
    ],
  },
  {
    icon: Terminal, os: "Linux (self-host)",
    steps: [
      "Install Bun: curl -fsSL https://bun.sh/install | bash",
      "git clone <repo> && cd gesture-whiteboard && bun install",
      "Run dev: bun run dev — then visit http://localhost:5173",
    ],
  },
  {
    icon: AppWindow, os: "Windows / macOS",
    steps: [
      "Install Node 20+ or Bun, then clone the repo.",
      "Run bun install && bun run build && bun run start.",
      "Open the printed URL — works fully offline once cached.",
    ],
  },
  {
    icon: Smartphone, os: "Android / iOS",
    steps: [
      "Open the site in Chrome (Android) or Safari (iOS).",
      "Tap the share / menu icon → 'Add to Home Screen'.",
      "Launch from the home-screen icon for fullscreen mode.",
    ],
  },
];


function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-30 glass">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-accent)" }}>
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Gesture Whiteboard</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#gestures" className="hover:text-foreground transition">Gestures</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
            <a href="#offline" className="hover:text-foreground transition">Offline</a>
            <a href="#install" className="hover:text-foreground transition">Install</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
            <Button asChild size="sm" className="gap-1.5"><Link to="/app">Open whiteboard <ArrowRight className="w-3.5 h-3.5" /></Link></Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30" style={{ background: "var(--gradient-accent)" }} />
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full glass mb-6">
            <Zap className="w-3 h-3" /> v1.0 · Works online &amp; offline
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            Draw with your <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-accent)" }}>hands</span>.
            <br /> Or your mouse. Or your finger.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            A privacy-first AI whiteboard that turns your webcam into a stylus. Sketch shapes, take notes
            and brainstorm with hand gestures — and fall back to touch or mouse whenever the camera isn't available.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Button asChild size="lg" className="gap-1.5"><Link to="/app"><Hand className="w-4 h-4" /> Launch the whiteboard</Link></Button>
            <Button asChild size="lg" variant="outline" className="gap-1.5"><a href="#gestures"><Lightbulb className="w-4 h-4" /> See gestures</a></Button>
          </div>
          <div className="mt-10 flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1"><Check className="w-3 h-3 text-success" /> No installs</span>
            <span className="inline-flex items-center gap-1"><Check className="w-3 h-3 text-success" /> No webcam? No problem</span>
            <span className="inline-flex items-center gap-1"><Check className="w-3 h-3 text-success" /> Free &amp; open</span>
            <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3 text-success" /> Frames stay on-device</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need on one canvas</h2>
          <p className="mt-3 text-muted-foreground">A full feature set verified to work end-to-end on Linux, Windows, macOS, Android &amp; iOS.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rounded-xl p-5 hover:translate-y-[-2px] transition-transform">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "var(--gradient-accent)" }}>
                <f.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* GESTURE TUTORIAL */}
      <section id="gestures" className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Visual gesture cheat-sheet</h2>
            <p className="mt-3 text-muted-foreground">Show these poses to your camera — the board responds in real time.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GESTURES.map((g) => (
              <div key={g.name} className="glass rounded-xl p-6 text-center">
                <div className="text-6xl mb-3 select-none" aria-hidden>{g.emoji}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{g.pose}</div>
                <div className="text-lg font-semibold mt-1">{g.name} → {g.tool}</div>
                <p className="text-sm text-muted-foreground mt-2">{g.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center text-sm text-muted-foreground">
            Tip: gestures are remappable in <strong className="text-foreground">Settings → Gesture mappings</strong>.
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">How it works</h2>
          <p className="mt-3 text-muted-foreground">Three steps from zero to drawing.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Camera, title: "1. Allow camera (optional)", desc: "Click 'Test Camera' on the whiteboard. The readiness checklist verifies HTTPS, getUserMedia and the hand-tracking model." },
            { icon: Hand,   title: "2. Show your hand", desc: "Hold your hand 30–60 cm from the camera. The on-screen overlay shows the detected pose live." },
            { icon: Pencil, title: "3. Draw, erase, share", desc: "Point with one finger to draw, four fingers to erase, then export PNG or share a read-only link." },
          ].map((s) => (
            <div key={s.title} className="glass rounded-xl p-6">
              <s.icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ONLINE / OFFLINE & PLATFORMS */}
      <section id="offline" className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">Online or offline. Always working.</h2>
            <p className="mt-4 text-muted-foreground">
              Hand-tracking and rendering run 100% in your browser. The board is cached in IndexedDB so you can keep
              drawing on a plane, in a Linux Wi-Fi-less laptop, or on a tablet without a SIM. When you reconnect,
              changes sync to your account in the background.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              <li className="flex items-start gap-2"><Wifi className="w-4 h-4 text-success mt-0.5" /> Online: sync, share links, AI shape &amp; handwriting recognition.</li>
              <li className="flex items-start gap-2"><WifiOff className="w-4 h-4 text-warning mt-0.5" /> Offline: full drawing, gestures, undo, export PNG / JSON.</li>
              <li className="flex items-start gap-2"><Lock className="w-4 h-4 text-primary mt-0.5" /> Webcam frames never leave your device.</li>
            </ul>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="text-sm font-medium mb-3">Tested &amp; verified on</div>
            <div className="grid grid-cols-3 gap-3">
              {RUNS_ON.map((p) => (
                <div key={p.name} className="rounded-lg border border-border p-3 text-center">
                  <p.icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-xs font-medium">{p.name}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 text-xs text-muted-foreground">
              Browsers: Chrome, Edge, Firefox, Safari 16+ &amp; all Chromium variants on Linux.
            </div>
          </div>
        </div>
      </section>

      {/* CHARACTERISTICS / SPECS */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Specs &amp; characteristics</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { k: "Latency", v: "≈ 30–60 fps GPU tracking" },
            { k: "Model", v: "MediaPipe HandLandmarker (float16)" },
            { k: "Storage", v: "IndexedDB + cloud sync" },
            { k: "Auth", v: "Email + Google OAuth" },
            { k: "Export", v: "PNG · JSON" },
            { k: "Resolutions", v: "320p · 480p · 720p · 1080p" },
            { k: "Smoothing", v: "1-Euro filter" },
            { k: "Bundle", v: "≤ 350 KB gzip (excl. model)" },
          ].map((s) => (
            <div key={s.k} className="glass rounded-xl p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.k}</div>
              <div className="font-semibold mt-1">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="glass rounded-2xl p-10">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to draw with your hands?</h2>
          <p className="mt-3 text-muted-foreground">Open the whiteboard — no signup needed to start sketching.</p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            <Button asChild size="lg" className="gap-1.5"><Link to="/app"><Hand className="w-4 h-4" /> Launch whiteboard</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Create account</Link></Button>
          </div>
        </div>
      </section>

      {/* INSTALL & USE GUIDE */}
      <section id="install" className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Install &amp; use it anywhere</h2>
            <p className="mt-3 text-muted-foreground">No mandatory installs — but if you want it on your machine, here's how.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {INSTALL_STEPS.map((g) => (
              <div key={g.os} className="glass rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-accent)" }}>
                    <g.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold">{g.os}</h3>
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  {g.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center text-xs text-muted-foreground">
            Tip: every gesture is remappable, every theme is swappable, and every pose can be enabled or disabled in <strong className="text-foreground">Settings</strong>.
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-1">
          Made with <Heart className="w-4 h-4 inline" style={{ color: "#ec4899", fill: "#ec4899" }} /> by
          <strong className="text-foreground ml-1">MuazBinShafi</strong>
        </div>
      </footer>
    </div>
  );
}
