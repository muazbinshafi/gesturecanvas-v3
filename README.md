# Gesture Whiteboard

> Draw with your hands. Or your mouse. Or your finger. A privacy‑first AI
> whiteboard that turns your webcam into a stylus, with full touch / mouse
> fallback for any device — online **or** offline.

Made with 🩷 by **MuazBinShafi**

---

## ✨ Features

- 🖐️ **Real‑time hand tracking** powered by MediaPipe HandLandmarker (GPU‑accelerated, 30–60 fps).
- ✌️ **6+ built‑in gestures** — Draw, Hover, Erase, Pinch, Pan, plus optional Zoom / Rotate when two hands are tracked.
- 🎨 **Custom gesture training** — record your own poses and bind them to any tool.
- 🖱️ **Touch & mouse fallback** — when no camera is available, the board behaves like a normal whiteboard.
- 🧠 **Smart Ink** — sketch a circle, square, arrow or line and have it snap to a clean vector shape; convert handwriting to text or LaTeX (online).
- 🎥 **Fullscreen camera preview** to verify framing & quality before tracking.
- 🌓 **5 themes** — Dark, Light, Sepia, Chalkboard, Blueprint — plus a custom accent color.
- 🧩 **Layers** — separate ink, shapes, text and objects.
- 📒 **Sticky notes & images** as first‑class canvas objects.
- 🗣️ **Voice commands** (Web Speech API) — “undo”, “clear”, “save”, “red pen”, “rectangle”, “fullscreen”…
- 🤝 **Collaborative rooms** — share a link, anyone with the link can join (configurable per room).
- 🌀 **Infinite canvas** with smooth pan & zoom.
- ✋ **Palm rejection** for stylus users (Pen / Mouse / Touch toggles).
- 🎚️ **Smoothing presets** — Calm / Responsive / Studio / Custom (1‑Euro filter).
- 🌐 **Works fully offline** — IndexedDB persists boards & settings; everything syncs when you reconnect.
- 🔒 **Privacy‑first** — webcam frames are processed locally, never uploaded.
- 🔑 **Auth** — Email/password **and** Google sign‑in.
- 📤 **Export** — PNG, SVG, PDF, JSON.
- ⌨️ **Keyboard shortcuts** — `P` pen · `E` eraser · `R` rect · `⌘Z` undo · `F` fullscreen.
- 📱 **Installable PWA** — add it to your home screen on Android / iOS / desktop.

## 🖐️ Gesture cheat‑sheet

| Gesture | Pose                | Default tool | Description                              |
| ------- | ------------------- | ------------ | ---------------------------------------- |
| ☝️       | Index up            | Pen          | Move to draw a stroke                    |
| ✌️       | Index + Middle up   | Cursor       | Hover without drawing                    |
| 🖐️       | Open hand           | Eraser       | Wipe strokes with your palm              |
| 🤏       | Pinch (thumb+index) | Select       | Grab and move objects                    |
| ✊       | Closed fist         | Pan          | Pan the canvas                           |
| 🫥       | Hand out of frame   | Idle         | Tracking pauses to save power            |

Every pose can be **remapped, disabled, or extended with a custom gesture** in
**Settings → Gestures**.

## 🚀 Quick start (no install)

1. Open the live URL in Chrome, Edge, Firefox or Safari 16+.
2. Click **Launch whiteboard**.
3. Optional: click **Test Camera** to enable hand tracking.
4. Optional: click the install icon in the address bar to add it as a PWA.

## 🛠️ Local install

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (recommended) **or** Node ≥ 20.

### Linux

```bash
curl -fsSL https://bun.sh/install | bash
git clone <repo-url> gesture-whiteboard
cd gesture-whiteboard
bun install
bun run dev
# → open http://localhost:5173
```

### Windows / macOS

```bash
git clone <repo-url> gesture-whiteboard
cd gesture-whiteboard
bun install
bun run build
bun run start
```

### Android / iOS

1. Open the deployed URL in Chrome (Android) or Safari (iOS).
2. Tap the share / menu icon → **Add to Home Screen**.
3. Launch from the home‑screen icon for fullscreen mode.

## 🔌 Online vs. offline

| Capability                          | Online | Offline |
| ----------------------------------- | :----: | :-----: |
| Hand tracking & drawing             |   ✅   |   ✅    |
| Touch / mouse drawing               |   ✅   |   ✅    |
| PNG / SVG / PDF / JSON export       |   ✅   |   ✅    |
| Cross‑device settings sync          |   ✅   |   —     |
| Collaborative rooms                 |   ✅   |   —     |
| Smart Ink (AI shape & handwriting)  |   ✅   |  ⛔ (heuristics fall back) |
| Share read‑only board links         |   ✅   |   —     |

## ⚙️ Tech stack

- **TanStack Start v1** + React 19 + Vite 7
- **MediaPipe Tasks** HandLandmarker
- **Tailwind CSS v4** + shadcn/ui
- **Lovable Cloud** (Supabase) for auth, settings sync and collaborative rooms
- **Lovable AI Gateway** (Gemini 2.5 / GPT‑5) for Smart Ink
- **IndexedDB** via a tiny custom wrapper for offline persistence

## 🧪 Verified on

Linux · Windows · macOS · ChromeOS · Android · iOS — Chrome, Edge, Firefox,
Safari 16+ and every Chromium variant.

## 🔐 Privacy

- Webcam frames are processed entirely in your browser — they never leave the
  device.
- Cloud sync is opt‑in and only stores board JSON + your settings.
- Smart Ink only sends a low‑resolution PNG of your stroke when you have it
  enabled and you're online.

## 📜 License

MIT — do whatever you want, attribution appreciated.

---

Made with 🩷 by **MuazBinShafi**
