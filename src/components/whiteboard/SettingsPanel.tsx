import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Trash2, Plus } from "lucide-react";
import type { AppSettings } from "@/hooks/useSyncEngine";
import {
  type CameraFacing, type CameraResolution, type GestureMappings, type Tool, type GestureAction,
  type BoardTheme, type SmoothingPreset, SMOOTHING_PRESETS, BOARD_THEMES,
} from "@/lib/whiteboard/types";
import { TOOL_NAMES, ACTION_NAMES } from "@/lib/whiteboard/actions";
import { BUILTIN_PROFILES, makeBlankProfile, type GestureProfile } from "@/lib/whiteboard/profiles";
import { GestureTrainer } from "./GestureTrainer";
import { CustomMappingsEditor } from "./CustomMappingsEditor";

const RESOLUTIONS: CameraResolution[] = ["320x240", "640x480", "1280x720", "1920x1080"];
const FACINGS: { value: CameraFacing; label: string }[] = [
  { value: "user", label: "Front (selfie)" },
  { value: "environment", label: "Back (rear)" },
];
const THEMES: BoardTheme[] = ["dark", "light", "sepia", "chalkboard", "blueprint"];
const PRESETS: SmoothingPreset[] = ["calm", "responsive", "studio", "custom"];
const VOICE_LANGS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "hi-IN", label: "हिन्दी" },
  { value: "ur-PK", label: "اردو" },
  { value: "ar-SA", label: "العربية" },
  { value: "zh-CN", label: "中文" },
  { value: "ja-JP", label: "日本語" },
];

type GesturePoseKey = keyof GestureMappings;
const TOOL_OPTIONS: Tool[] = TOOL_NAMES;
const ACTION_OPTIONS: GestureAction[] = ACTION_NAMES;
const POSE_LABELS: { key: GesturePoseKey; label: string; hint: string; emoji: string; kind: "tool" | "any" }[] = [
  { key: "DRAW",        label: "Index finger up",       hint: "Primary draw tool",      emoji: "☝️", kind: "tool" },
  { key: "HOVER",       label: "Index + Middle up",     hint: "Cursor / hover",         emoji: "✌️", kind: "tool" },
  { key: "PAN",         label: "Closed fist",           hint: "Pan canvas",             emoji: "✊", kind: "tool" },
  { key: "ERASE",       label: "Open hand (5 fingers)", hint: "Erase",                  emoji: "🖐️", kind: "tool" },
  { key: "PINCH",       label: "Pinch (thumb + index)", hint: "Select / move / zoom",   emoji: "🤏", kind: "tool" },
  { key: "PEACE",       label: "Peace / V (spread)",    hint: "Default: undo",          emoji: "✌️", kind: "any" },
  { key: "THREE",       label: "Three fingers up",      hint: "Default: rectangle",     emoji: "🤟", kind: "any" },
  { key: "FOUR",        label: "Four fingers up",       hint: "Default: circle",        emoji: "✋", kind: "any" },
  { key: "FIVE_SPREAD", label: "Five fingers spread",   hint: "Default: fit screen",    emoji: "🖐", kind: "any" },
  { key: "OK",          label: "OK sign",               hint: "Default: save",          emoji: "👌", kind: "any" },
  { key: "ROCK",        label: "Rock sign",             hint: "Default: next color",    emoji: "🤘", kind: "any" },
  { key: "CALL",        label: "Call me",               hint: "Default: screenshot",    emoji: "🤙", kind: "any" },
  { key: "GUN",         label: "Gun (thumb + index)",   hint: "Default: delete",        emoji: "🔫", kind: "any" },
  { key: "L_SHAPE",     label: "L shape",               hint: "Default: next layer",    emoji: "🔠", kind: "any" },
  { key: "THUMBS_UP",   label: "Thumbs up",             hint: "Default: redo",          emoji: "👍", kind: "any" },
  { key: "THUMBS_DOWN", label: "Thumbs down",           hint: "Default: clear board",   emoji: "👎", kind: "any" },
  { key: "PINKY_UP",    label: "Pinky finger up",       hint: "Default: brush smaller", emoji: "🤙", kind: "any" },
  { key: "MIDDLE_UP",   label: "Middle finger up",      hint: "Default: prev color",    emoji: "🖕", kind: "any" },
  { key: "INDEX_DOWN",  label: "Index pointing down",   hint: "Default: add sticky",    emoji: "👇", kind: "any" },
  { key: "FIST_THUMB",  label: "Fist (thumb tucked)",   hint: "Default: lock canvas",   emoji: "👊", kind: "any" },
  { key: "PALM_SIDE",   label: "Palm sideways",         hint: "Default: toggle grid",   emoji: "✋", kind: "any" },
  { key: "HEART",       label: "Heart shape",           hint: "Default: cycle theme",   emoji: "🫶", kind: "any" },
  { key: "SWIPE_LEFT",  label: "Swipe left ←",          hint: "Default: undo",          emoji: "⬅️", kind: "any" },
  { key: "SWIPE_RIGHT", label: "Swipe right →",         hint: "Default: redo",          emoji: "➡️", kind: "any" },
  { key: "SWIPE_UP",    label: "Swipe up ↑",            hint: "Default: brush larger",  emoji: "⬆️", kind: "any" },
  { key: "SWIPE_DOWN",  label: "Swipe down ↓",          hint: "Default: brush smaller", emoji: "⬇️", kind: "any" },
  { key: "CIRCLE_CW",   label: "Circle clockwise",      hint: "Default: zoom in",       emoji: "🔃", kind: "any" },
  { key: "CIRCLE_CCW",  label: "Circle counter-CW",     hint: "Default: zoom out",      emoji: "🔄", kind: "any" },
  { key: "DWELL",       label: "Hold cursor still",     hint: "Default: add text",      emoji: "⏳", kind: "any" },
];

export function SettingsPanel({ settings, update, livePose = "" }: { settings: AppSettings; update: (p: Partial<AppSettings>) => void; livePose?: string }) {
  const togglePose = (pose: string) => {
    const has = settings.disabled_poses.includes(pose);
    update({ disabled_poses: has ? settings.disabled_poses.filter((p) => p !== pose) : [...settings.disabled_poses, pose] });
  };
  const toggleLayer = (k: keyof AppSettings["layers_visible"]) =>
    update({ layers_visible: { ...settings.layers_visible, [k]: !settings.layers_visible[k] } });

  const setPreset = (p: SmoothingPreset) => {
    if (p === "custom") return update({ smoothing: { ...settings.smoothing, preset: "custom" } });
    const v = SMOOTHING_PRESETS[p];
    update({ smoothing: { ...settings.smoothing, ...v, preset: p } });
  };

  const profiles = settings.gesture_profiles?.length ? settings.gesture_profiles : BUILTIN_PROFILES;

  /** Apply a profile's mappings/poses/stability onto the live settings. */
  const applyProfile = (id: string) => {
    if (!id) { update({ active_profile_id: "" }); return; }
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    update({
      active_profile_id: id,
      gesture_mappings: { ...p.gesture_mappings },
      disabled_poses: [...p.disabled_poses],
      pose_stability: p.pose_stability,
      adaptive_stability: p.adaptive_stability,
    });
  };

  /** Save current live mappings into the active profile (or create new). */
  const saveCurrentToProfile = () => {
    const name = prompt("Profile name:", "My profile");
    if (!name) return;
    const np: GestureProfile = {
      ...makeBlankProfile(name),
      gesture_mappings: { ...settings.gesture_mappings },
      disabled_poses: [...settings.disabled_poses],
      pose_stability: settings.pose_stability,
      adaptive_stability: settings.adaptive_stability,
    };
    update({ gesture_profiles: [...profiles, np], active_profile_id: np.id });
  };

  const deleteProfile = (id: string) => {
    if (!confirm("Delete this profile?")) return;
    const next = profiles.filter((p) => p.id !== id);
    update({ gesture_profiles: next, active_profile_id: settings.active_profile_id === id ? "" : settings.active_profile_id });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings"><SettingsIcon className="w-4 h-4" /></Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Deep customization — tune every gesture, theme, smoothing curve, voice command and layer.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8 px-4 pb-10">

          {/* THEME */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Board theme</h3>
            <div className="grid grid-cols-5 gap-2">
              {THEMES.map((t) => {
                const on = settings.theme === t;
                const c = BOARD_THEMES[t];
                return (
                  <button key={t} onClick={() => update({ theme: t })}
                    className={`rounded-md p-1 border text-[10px] capitalize ${on ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
                    style={{ background: c.bg, color: c.ink[0] }}>
                    {t}
                  </button>
                );
              })}
            </div>
            <label className="text-xs text-muted-foreground mt-3 block">Accent color override</label>
            <div className="flex items-center gap-2">
              <input type="color" value={settings.accent_color || BOARD_THEMES[settings.theme].accent}
                onChange={(e) => update({ accent_color: e.target.value })}
                className="w-12 h-8 rounded border border-border bg-transparent" />
              <Button size="sm" variant="ghost" onClick={() => update({ accent_color: "" })}>Reset</Button>
            </div>
          </section>

          {/* GESTURE PROFILES */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Gesture profiles</h3>
              <GestureTrainer settings={settings} update={update} />
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Switch between context-tuned mapping profiles. Each profile remembers its own gesture map, disabled poses, and stability.
            </p>
            <div className="grid grid-cols-1 gap-1.5 mb-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="profile"
                  checked={!settings.active_profile_id}
                  onChange={() => applyProfile("")}
                />
                <span className="font-medium">Manual</span>
                <span className="text-muted-foreground">— edit mappings directly below</span>
              </label>
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="radio"
                      name="profile"
                      checked={settings.active_profile_id === p.id}
                      onChange={() => applyProfile(p.id)}
                    />
                    <span className="font-medium truncate">{p.name}</span>
                    {p.builtIn && <span className="text-[10px] text-muted-foreground">built-in</span>}
                  </label>
                  <span className="text-[10px] text-muted-foreground">stab: {p.pose_stability}</span>
                  {!p.builtIn && (
                    <Button size="icon" variant="ghost" aria-label="Delete profile" onClick={() => deleteProfile(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="gap-1" onClick={saveCurrentToProfile}>
              <Plus className="w-3.5 h-3.5" /> Save current as profile
            </Button>
          </section>

          {/* GESTURE MAPPINGS + ENABLE */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Gestures — map &amp; enable</h3>
            <p className="text-xs text-muted-foreground mb-3">14 built-in poses. Map any pose to a drawing tool or to an action like undo, save or screenshot.</p>
            <div className="space-y-2">
              {POSE_LABELS.map(({ key, label, hint, emoji, kind }) => {
                const disabled = settings.disabled_poses.includes(key);
                const value = (settings.gesture_mappings[key] ?? "none") as string;
                return (
                  <div key={key} className={`flex items-center justify-between gap-2 text-sm rounded-md border border-border p-2 ${disabled ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xl" aria-hidden>{emoji}</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{label}</div>
                        <div className="text-xs text-muted-foreground">{hint}</div>
                      </div>
                    </div>
                    <select
                      disabled={disabled}
                      value={value}
                      onChange={(e) => update({ gesture_mappings: { ...settings.gesture_mappings, [key]: e.target.value } as GestureMappings })}
                      className="bg-input text-foreground rounded-md px-2 py-1 text-xs border border-border max-w-[8rem]"
                    >
                      <optgroup label="Tools">
                        {TOOL_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </optgroup>
                      {kind === "any" && (
                        <optgroup label="Actions">
                          {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <label className="text-xs flex items-center gap-1">
                      <input type="checkbox" checked={!disabled} onChange={() => togglePose(key)} />
                      on
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          {/* MOTION GESTURES */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Motion gestures</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Detect swipes, circles, and dwell using cursor motion (only while index/peace/pinch is held). Disable to silence those poses.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.motion.enabled}
                onChange={(e) => update({ motion: { ...settings.motion, enabled: e.target.checked } })} />
              Enable motion detection
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.motion.circleEnabled}
                onChange={(e) => update({ motion: { ...settings.motion, circleEnabled: e.target.checked } })} />
              Detect circles (CW / CCW)
            </label>
            <label className="text-xs text-muted-foreground mt-2 block">Swipe min distance: {settings.motion.swipeMinDistance}px</label>
            <input type="range" min={60} max={400} step={10} value={settings.motion.swipeMinDistance}
              onChange={(e) => update({ motion: { ...settings.motion, swipeMinDistance: Number(e.target.value) } })}
              className="w-full accent-primary" />
            <label className="text-xs text-muted-foreground mt-2 block">Swipe max duration: {settings.motion.swipeMaxDuration}ms</label>
            <input type="range" min={200} max={1500} step={50} value={settings.motion.swipeMaxDuration}
              onChange={(e) => update({ motion: { ...settings.motion, swipeMaxDuration: Number(e.target.value) } })}
              className="w-full accent-primary" />
            <label className="text-xs text-muted-foreground mt-2 block">Dwell hold time: {settings.motion.dwellMs}ms</label>
            <input type="range" min={300} max={2000} step={50} value={settings.motion.dwellMs}
              onChange={(e) => update({ motion: { ...settings.motion, dwellMs: Number(e.target.value) } })}
              className="w-full accent-primary" />
            <label className="text-xs text-muted-foreground mt-2 block">Dwell radius: {settings.motion.dwellRadius}px</label>
            <input type="range" min={6} max={60} step={2} value={settings.motion.dwellRadius}
              onChange={(e) => update({ motion: { ...settings.motion, dwellRadius: Number(e.target.value) } })}
              className="w-full accent-primary" />
            <label className="text-xs text-muted-foreground mt-2 block">Circle min angle: {(settings.motion.circleMinAngle / Math.PI).toFixed(2)}π rad</label>
            <input type="range" min={Math.PI} max={Math.PI * 3} step={0.1} value={settings.motion.circleMinAngle}
              onChange={(e) => update({ motion: { ...settings.motion, circleMinAngle: Number(e.target.value) } })}
              className="w-full accent-primary" />
          </section>

          {/* CUSTOM MAPPINGS — gesture-to-action editor with reorder + live preview */}
          <CustomMappingsEditor
            mappings={settings.custom_mappings}
            onChange={(next) => update({ custom_mappings: next })}
            livePose={livePose}
          />

          {/* CUSTOM GESTURES */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Custom gestures</h3>
            {settings.custom_gestures.length === 0 ? (
              <p className="text-xs text-muted-foreground">No custom gestures recorded yet. In the whiteboard, hold a pose and click <strong className="text-foreground">Record gesture</strong> in the camera bar to save it.</p>
            ) : (
              <ul className="space-y-1.5">
                {settings.custom_gestures.map((g, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm rounded-md border border-border p-2">
                    <span className="truncate">{g.name} {g.tool ? <span className="text-muted-foreground">→ {g.tool}</span> : null}</span>
                    <Button size="icon" variant="ghost" aria-label="Delete gesture"
                      onClick={() => update({ custom_gestures: settings.custom_gestures.filter((_, j) => j !== i) })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* BRUSH */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Brush defaults</h3>
            <label className="text-xs text-muted-foreground">Size: {settings.brush_settings.size}px</label>
            <input type="range" min={1} max={32} value={settings.brush_settings.size}
              onChange={(e) => update({ brush_settings: { ...settings.brush_settings, size: Number(e.target.value) } })}
              className="w-full accent-primary" />
            <label className="text-xs text-muted-foreground mt-2 block">Color</label>
            <input type="color" value={settings.brush_settings.color}
              onChange={(e) => update({ brush_settings: { ...settings.brush_settings, color: e.target.value } })}
              className="w-12 h-8 rounded border border-border bg-transparent" />
          </section>

          {/* SMOOTHING */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Cursor smoothing</h3>
            <div className="grid grid-cols-4 gap-1 mb-3">
              {PRESETS.map((p) => {
                const on = (settings.smoothing.preset ?? "custom") === p;
                return (
                  <button key={p} onClick={() => setPreset(p)}
                    className={`rounded-md px-2 py-1 text-xs capitalize border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                    {p}
                  </button>
                );
              })}
            </div>
            <label className="text-xs text-muted-foreground">Min cutoff (Hz): {settings.smoothing.minCutoff.toFixed(2)} — lower = smoother</label>
            <input type="range" min={0.1} max={5} step={0.1} value={settings.smoothing.minCutoff}
              onChange={(e) => update({ smoothing: { ...settings.smoothing, minCutoff: Number(e.target.value), preset: "custom" } })}
              className="w-full accent-primary" />
            <label className="text-xs text-muted-foreground mt-2 block">Beta: {settings.smoothing.beta.toFixed(3)} — higher = more responsive</label>
            <input type="range" min={0.001} max={0.1} step={0.001} value={settings.smoothing.beta}
              onChange={(e) => update({ smoothing: { ...settings.smoothing, beta: Number(e.target.value), preset: "custom" } })}
              className="w-full accent-primary" />
          </section>

          {/* SMART INK */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Smart Ink</h3>
            <select
              value={settings.smart_ink_mode}
              onChange={(e) => update({ smart_ink_mode: e.target.value as AppSettings["smart_ink_mode"] })}
              className="w-full bg-input text-foreground rounded-md px-2 py-1.5 text-sm border border-border"
            >
              <option value="off">Off — keep raw strokes</option>
              <option value="heuristics">Heuristics only (offline)</option>
              <option value="auto">Auto (heuristics + AI when online)</option>
              <option value="latex">LaTeX math (online)</option>
            </select>
          </section>

          {/* CAMERA */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Camera</h3>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" checked={settings.mirror_camera}
                onChange={(e) => update({ mirror_camera: e.target.checked })} />
              Mirror camera (recommended)
            </label>
            <label className="text-xs text-muted-foreground block">Resolution</label>
            <select
              value={settings.camera.resolution}
              onChange={(e) => update({ camera: { ...settings.camera, resolution: e.target.value as CameraResolution } })}
              className="w-full bg-input text-foreground rounded-md px-2 py-1.5 text-sm border border-border mb-2"
            >
              {RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className="text-xs text-muted-foreground block">Facing mode</label>
            <select
              value={settings.camera.facingMode}
              onChange={(e) => update({ camera: { ...settings.camera, facingMode: e.target.value as CameraFacing } })}
              className="w-full bg-input text-foreground rounded-md px-2 py-1.5 text-sm border border-border mb-2"
            >
              {FACINGS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <label className="text-xs text-muted-foreground block">Hands tracked</label>
            <select
              value={settings.camera.numHands}
              onChange={(e) => update({ camera: { ...settings.camera, numHands: Number(e.target.value) as 1 | 2 } })}
              className="w-full bg-input text-foreground rounded-md px-2 py-1.5 text-sm border border-border mb-2"
            >
              <option value={1}>One hand</option>
              <option value={2}>Two hands (zoom / rotate)</option>
            </select>
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={settings.camera.enabled}
                onChange={(e) => update({ camera: { ...settings.camera, enabled: e.target.checked } })} />
              Auto-start camera on load
            </label>
          </section>

          {/* VOICE */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Voice commands</h3>
            <label className="flex items-center gap-2 text-sm mb-2">
              <input type="checkbox" checked={settings.voice.enabled}
                onChange={(e) => update({ voice: { ...settings.voice, enabled: e.target.checked } })} />
              Enable voice control (say "undo", "clear", "red pen", "save")
            </label>
            <label className="text-xs text-muted-foreground block">Recognition language</label>
            <select
              value={settings.voice.lang}
              onChange={(e) => update({ voice: { ...settings.voice, lang: e.target.value } })}
              className="w-full bg-input text-foreground rounded-md px-2 py-1.5 text-sm border border-border"
            >
              {VOICE_LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </section>

          {/* PALM REJECTION */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Touch &amp; stylus</h3>
            <label className="flex items-center gap-2 text-sm mb-2">
              <input type="checkbox" checked={settings.palm.enabled}
                onChange={(e) => update({ palm: { ...settings.palm, enabled: e.target.checked } })} />
              Enable palm rejection (stylus only)
            </label>
            <div className="text-xs text-muted-foreground mb-1">Accept input from:</div>
            {(["pen", "mouse", "touch"] as const).map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.palm.acceptedPointerTypes.includes(p)}
                  onChange={(e) => {
                    const list = settings.palm.acceptedPointerTypes;
                    update({ palm: { ...settings.palm, acceptedPointerTypes: e.target.checked ? Array.from(new Set([...list, p])) : list.filter((x) => x !== p) } });
                  }} />
                {p}
              </label>
            ))}
          </section>

          {/* LAYERS */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Layers</h3>
            {(Object.keys(settings.layers_visible) as (keyof AppSettings["layers_visible"])[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm capitalize">
                <input type="checkbox" checked={settings.layers_visible[k]} onChange={() => toggleLayer(k)} />
                {k}
              </label>
            ))}
            <label className="text-xs text-muted-foreground mt-2 block">Active drawing layer</label>
            <select value={settings.active_layer}
              onChange={(e) => update({ active_layer: e.target.value as AppSettings["active_layer"] })}
              className="w-full bg-input text-foreground rounded-md px-2 py-1.5 text-sm border border-border">
              {(Object.keys(settings.layers_visible) as string[]).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </section>

          {/* DRAWING ASSIST & FEEL */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Drawing assist &amp; feel</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.show_grid}
                onChange={(e) => update({ show_grid: e.target.checked })} />
              Show grid background
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.snap_to_grid}
                onChange={(e) => update({ snap_to_grid: e.target.checked })} />
              Snap shapes to grid
            </label>
            <label className="text-xs text-muted-foreground mt-2 block">Grid cell size: {settings.grid_size}px</label>
            <input type="range" min={8} max={80} step={2} value={settings.grid_size}
              onChange={(e) => update({ grid_size: Number(e.target.value) })}
              className="w-full accent-primary" />
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={settings.sound_effects}
                onChange={(e) => update({ sound_effects: e.target.checked })} />
              Subtle sound effects on actions
            </label>
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={settings.highlighter}
                onChange={(e) => update({ highlighter: e.target.checked })} />
              Highlighter mode (translucent strokes)
            </label>
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={settings.canvas_locked}
                onChange={(e) => update({ canvas_locked: e.target.checked })} />
              Lock canvas (read-only)
            </label>
            <label className="text-xs text-muted-foreground mt-2 block">Hand cursor color</label>
            <input type="color" value={settings.hand_cursor_color}
              onChange={(e) => update({ hand_cursor_color: e.target.value })}
              className="w-12 h-8 rounded border border-border bg-transparent" />
            <label className="text-xs text-muted-foreground mt-2 block">Auto-save every: {settings.autosave_interval === 0 ? "off" : `${settings.autosave_interval}s`}</label>
            <input type="range" min={0} max={120} step={5} value={settings.autosave_interval}
              onChange={(e) => update({ autosave_interval: Number(e.target.value) })}
              className="w-full accent-primary" />
            <label className="text-xs text-muted-foreground mt-2 block">Gesture stability: {settings.pose_stability} frames</label>
            <input type="range" min={1} max={10} value={settings.pose_stability}
              onChange={(e) => update({ pose_stability: Number(e.target.value) })}
              className="w-full accent-primary" />
            <p className="text-[10px] text-muted-foreground">Higher = fewer false triggers, lower = faster response.</p>
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={settings.adaptive_stability}
                onChange={(e) => update({ adaptive_stability: e.target.checked })} />
              Adaptive stability — auto-tune from your false-trigger rate
            </label>
            <p className="text-[10px] text-muted-foreground">When you undo right after a gesture-driven action, the threshold creeps up. Calms down when you stop undoing.</p>
          </section>

          {/* ACCESSIBILITY */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Accessibility &amp; UI</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.reduce_motion}
                onChange={(e) => update({ reduce_motion: e.target.checked })} />
              Reduce motion / disable animations
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.show_pose_badge}
                onChange={(e) => update({ show_pose_badge: e.target.checked })} />
              Show live pose badge on canvas
            </label>
          </section>

          {/* ONBOARDING & RESET */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Onboarding &amp; reset</h3>
            <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem("onboarding_done"); window.location.reload(); }}>
              Replay tour
            </Button>
            <Button variant="outline" size="sm" className="ml-2"
              onClick={() => {
                if (!confirm("Reset all settings to defaults?")) return;
                update({
                  theme: "dark", smart_ink_mode: "auto", mirror_camera: true,
                  disabled_poses: [], accent_color: "", reduce_motion: false, show_pose_badge: true,
                  adaptive_stability: true, active_profile_id: "", gesture_profiles: BUILTIN_PROFILES,
                });
              }}>
              Reset to defaults
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
