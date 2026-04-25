/**
 * Sync engine: settings live in IndexedDB locally and sync to the cloud
 * when the user is online + signed in. Last-write-wins by updated_at.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet } from "@/lib/whiteboard/idb";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_BRUSH, DEFAULT_CAMERA, DEFAULT_MAPPINGS, DEFAULT_PALM, DEFAULT_SMOOTHING, DEFAULT_VOICE,
  type BoardTheme, type BrushSettings, type CameraSettings, type GestureMappings,
  type PalmRejectionSettings, type SmoothingSettings, type VoiceSettings,
  type CustomGestureTemplate, type CustomMapping, type Layer,
} from "@/lib/whiteboard/types";
import { DEFAULT_MOTION, type MotionConfig } from "@/lib/whiteboard/motionGestures";
import { BUILTIN_PROFILES, type GestureProfile } from "@/lib/whiteboard/profiles";

export interface AppSettings {
  theme: BoardTheme;
  gesture_config_version: number;
  gesture_mappings: GestureMappings;
  brush_settings: BrushSettings;
  smoothing: SmoothingSettings;
  smart_ink_mode: "off" | "heuristics" | "auto" | "latex";
  mirror_camera: boolean;
  camera: CameraSettings;
  voice: VoiceSettings;
  palm: PalmRejectionSettings;
  layers_visible: Record<Layer, boolean>;
  active_layer: Layer;
  custom_gestures: CustomGestureTemplate[];
  /** Poses the user has explicitly disabled. Keys are pose names. */
  disabled_poses: string[];
  /** UI accent color override (CSS color string). Empty = theme default. */
  accent_color: string;
  /** Reduce motion / animations. */
  reduce_motion: boolean;
  /** Show on-screen pose label badge while drawing. */
  show_pose_badge: boolean;
  /** Show grid background overlay. */
  show_grid: boolean;
  /** Snap drawn shapes/strokes to grid. */
  snap_to_grid: boolean;
  /** Grid cell size in pixels. */
  grid_size: number;
  /** Play subtle sound effects on tool actions. */
  sound_effects: boolean;
  /** Color of the on-canvas hand cursor. */
  hand_cursor_color: string;
  /** Auto-save board to local storage every N seconds (0 = off). */
  autosave_interval: number;
  /** How sensitive pose detection is — number of consecutive frames to confirm. */
  pose_stability: number;
  /** When true, pose_stability is auto-tuned from recent false-trigger rate. */
  adaptive_stability: boolean;
  /** Pinch sensitivity in [0,1]. Higher = wider gap counts as a pinch. */
  pinch_sensitivity: number;
  /** Cursor sensitivity multiplier in [0.5, 3]. Higher = small hand moves cover more screen. */
  cursor_gain: number;
  /** Saved gesture profiles (built-in + user-created). */
  gesture_profiles: GestureProfile[];
  /** Currently active profile id. Empty = "manual" mode using top-level mappings. */
  active_profile_id: string;
  /** User-authored gesture-to-action overrides. Checked before gesture_mappings. */
  custom_mappings: CustomMapping[];
  /** Motion gesture config (swipes, circles, dwell). */
  motion: MotionConfig;
  /** Highlighter mode toggles brush opacity / blend. */
  highlighter: boolean;
  /** Canvas locked from edits. */
  canvas_locked: boolean;
  updated_at: string;
}

const CURRENT_GESTURE_CONFIG_VERSION = 4;

export const STRICT_MOTION_DEFAULTS: MotionConfig = {
  ...DEFAULT_MOTION,
  enabled: false,
  circleEnabled: false,
  swipeMinDistance: 280,
  swipeMaxDuration: 420,
  dwellRadius: 12,
  dwellMs: 1000,
  circleMinAngle: Math.PI * 2.2,
};

function cloneProfiles(profiles: GestureProfile[]): GestureProfile[] {
  return profiles.map((profile) => ({
    ...profile,
    gesture_mappings: { ...profile.gesture_mappings },
    disabled_poses: [...profile.disabled_poses],
  }));
}

export function applyStrictGestureReset(settings: AppSettings): AppSettings {
  return {
    ...settings,
    gesture_config_version: CURRENT_GESTURE_CONFIG_VERSION,
    gesture_mappings: { ...DEFAULT_MAPPINGS },
    custom_gestures: [],
    disabled_poses: [],
    pose_stability: 4,
    adaptive_stability: false,
    pinch_sensitivity: 0.55,
    cursor_gain: 1.6,
    smoothing: { ...DEFAULT_SMOOTHING },
    gesture_profiles: cloneProfiles(BUILTIN_PROFILES),
    active_profile_id: "",
    custom_mappings: [],
    motion: { ...STRICT_MOTION_DEFAULTS },
  };
}

function normalizeLoadedSettings(settings: AppSettings): AppSettings {
  if ((settings.gesture_config_version ?? 0) >= CURRENT_GESTURE_CONFIG_VERSION) return settings;
  return applyStrictGestureReset(settings);
}

const DEFAULTS: AppSettings = {
  theme: "dark",
  gesture_config_version: CURRENT_GESTURE_CONFIG_VERSION,
  gesture_mappings: DEFAULT_MAPPINGS,
  brush_settings: DEFAULT_BRUSH,
  smoothing: DEFAULT_SMOOTHING,
  smart_ink_mode: "auto",
  mirror_camera: true,
  camera: DEFAULT_CAMERA,
  voice: DEFAULT_VOICE,
  palm: DEFAULT_PALM,
  layers_visible: { ink: true, shapes: true, text: true, objects: true },
  active_layer: "ink",
  custom_gestures: [],
  disabled_poses: [],
  accent_color: "",
  reduce_motion: false,
  show_pose_badge: true,
  show_grid: false,
  snap_to_grid: false,
  grid_size: 24,
  sound_effects: false,
  hand_cursor_color: "#a78bfa",
  autosave_interval: 30,
  pose_stability: 7,
  adaptive_stability: false,
  pinch_sensitivity: 0.65,
  cursor_gain: 1.75,
  gesture_profiles: cloneProfiles(BUILTIN_PROFILES),
  active_profile_id: "",
  custom_mappings: [],
  motion: STRICT_MOTION_DEFAULTS,
  highlighter: false,
  canvas_locked: false,
  updated_at: new Date(0).toISOString(),
};

const LOCAL_KEY = "app_settings";

export function useSyncEngine() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [online, setOnline] = useState<boolean>(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    idbGet<AppSettings>("settings", LOCAL_KEY).then((s) => {
      if (!s) return;
      const next = normalizeLoadedSettings({ ...DEFAULTS, ...s });
      setSettings(next);
      if (next !== s) idbSet("settings", LOCAL_KEY, next);
    });
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setSyncing(true);
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        const ui = (data.ui_layout as {
          gesture_config_version?: number;
          mirror_camera?: boolean;
          camera?: Partial<CameraSettings>;
          theme?: BoardTheme;
          voice?: Partial<VoiceSettings>;
          palm?: Partial<PalmRejectionSettings>;
          layers_visible?: AppSettings["layers_visible"];
          active_layer?: Layer;
          custom_gestures?: CustomGestureTemplate[];
          disabled_poses?: string[];
          accent_color?: string;
          reduce_motion?: boolean;
          show_pose_badge?: boolean;
          show_grid?: boolean;
          snap_to_grid?: boolean;
          grid_size?: number;
          sound_effects?: boolean;
          hand_cursor_color?: string;
          autosave_interval?: number;
          pose_stability?: number;
          adaptive_stability?: boolean;
          pinch_sensitivity?: number;
          cursor_gain?: number;
          gesture_profiles?: GestureProfile[];
          active_profile_id?: string;
          custom_mappings?: CustomMapping[];
          motion?: Partial<MotionConfig>;
          highlighter?: boolean;
          canvas_locked?: boolean;
        }) ?? {};
        const remote: AppSettings = {
          theme: (ui.theme ?? (data.theme as BoardTheme) ?? "dark"),
          gesture_config_version: ui.gesture_config_version ?? 0,
          gesture_mappings: { ...DEFAULT_MAPPINGS, ...(data.gesture_mappings as object) } as GestureMappings,
          brush_settings: { ...DEFAULT_BRUSH, ...(data.brush_settings as object) } as BrushSettings,
          smoothing: { ...DEFAULT_SMOOTHING, ...(data.smoothing as object) } as SmoothingSettings,
          smart_ink_mode: ((data.smart_ink_mode as AppSettings["smart_ink_mode"]) ?? "auto"),
          mirror_camera: ui.mirror_camera ?? true,
          camera: { ...DEFAULT_CAMERA, ...(ui.camera ?? {}) } as CameraSettings,
          voice: { ...DEFAULT_VOICE, ...(ui.voice ?? {}) } as VoiceSettings,
          palm: { ...DEFAULT_PALM, ...(ui.palm ?? {}) } as PalmRejectionSettings,
          layers_visible: ui.layers_visible ?? DEFAULTS.layers_visible,
          active_layer: ui.active_layer ?? "ink",
          custom_gestures: ui.custom_gestures ?? [],
          disabled_poses: ui.disabled_poses ?? [],
          accent_color: ui.accent_color ?? "",
          reduce_motion: ui.reduce_motion ?? false,
          show_pose_badge: ui.show_pose_badge ?? true,
          show_grid: ui.show_grid ?? false,
          snap_to_grid: ui.snap_to_grid ?? false,
          grid_size: ui.grid_size ?? 24,
          sound_effects: ui.sound_effects ?? false,
          hand_cursor_color: ui.hand_cursor_color ?? "#a78bfa",
          autosave_interval: ui.autosave_interval ?? 30,
          pose_stability: ui.pose_stability ?? DEFAULTS.pose_stability,
          adaptive_stability: ui.adaptive_stability ?? DEFAULTS.adaptive_stability,
          pinch_sensitivity: ui.pinch_sensitivity ?? DEFAULTS.pinch_sensitivity,
          cursor_gain: ui.cursor_gain ?? DEFAULTS.cursor_gain,
          gesture_profiles: ui.gesture_profiles ? cloneProfiles(ui.gesture_profiles) : cloneProfiles(BUILTIN_PROFILES),
          active_profile_id: ui.active_profile_id ?? "",
          custom_mappings: ui.custom_mappings ?? [],
          motion: { ...STRICT_MOTION_DEFAULTS, ...(ui.motion ?? {}) },
          highlighter: ui.highlighter ?? false,
          canvas_locked: ui.canvas_locked ?? false,
          updated_at: data.updated_at,
        };
        const local = await idbGet<AppSettings>("settings", LOCAL_KEY);
        const winner = !local || new Date(remote.updated_at) >= new Date(local.updated_at) ? remote : local;
        const normalizedWinner = normalizeLoadedSettings(winner);
        setSettings(normalizedWinner);
        await idbSet("settings", LOCAL_KEY, normalizedWinner);
        if (normalizedWinner !== winner || winner === local) await pushRemote(user.id, normalizedWinner);
      } else {
        const local = await idbGet<AppSettings>("settings", LOCAL_KEY);
        if (local) await pushRemote(user.id, normalizeLoadedSettings(local));
      }
      setSyncing(false);
    })();
  }, [user]);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch, updated_at: new Date().toISOString() };
      idbSet("settings", LOCAL_KEY, next);
      if (user && online) pushRemote(user.id, next);
      return next;
    });
  }, [user, online]);

  return { settings, update, online, syncing };
}

async function pushRemote(userId: string, s: AppSettings) {
  const row = {
    user_id: userId,
    theme: s.theme === "light" ? "light" : "dark",
    gesture_mappings: s.gesture_mappings as unknown,
    brush_settings: s.brush_settings as unknown,
    smoothing: s.smoothing as unknown,
    smart_ink_mode: s.smart_ink_mode,
    ui_layout: {
      theme: s.theme,
      gesture_config_version: s.gesture_config_version,
      mirror_camera: s.mirror_camera,
      camera: s.camera,
      voice: s.voice,
      palm: s.palm,
      layers_visible: s.layers_visible,
      active_layer: s.active_layer,
      custom_gestures: s.custom_gestures,
      disabled_poses: s.disabled_poses,
      accent_color: s.accent_color,
      reduce_motion: s.reduce_motion,
      show_pose_badge: s.show_pose_badge,
      show_grid: s.show_grid,
      snap_to_grid: s.snap_to_grid,
      grid_size: s.grid_size,
      sound_effects: s.sound_effects,
      hand_cursor_color: s.hand_cursor_color,
      autosave_interval: s.autosave_interval,
      pose_stability: s.pose_stability,
      adaptive_stability: s.adaptive_stability,
      pinch_sensitivity: s.pinch_sensitivity,
      cursor_gain: s.cursor_gain,
      gesture_profiles: s.gesture_profiles,
      active_profile_id: s.active_profile_id,
      custom_mappings: s.custom_mappings,
      motion: s.motion,
      highlighter: s.highlighter,
      canvas_locked: s.canvas_locked,
    } as unknown,
    updated_at: s.updated_at,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from("user_settings").upsert([row as any]);
}
