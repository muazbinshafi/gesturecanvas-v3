/**
 * Gesture mapping profiles — named bundles of gesture_mappings + disabled_poses
 * + pose_stability that the user can switch between (e.g. sketching, note-taking,
 * presentation). Profiles are stored alongside other AppSettings and synced.
 */
import type { GestureMappings } from "./types";
import { DEFAULT_MAPPINGS } from "./types";

export interface GestureProfile {
  id: string;
  name: string;
  /** Mappings for this profile. Falls back to DEFAULT_MAPPINGS for missing keys. */
  gesture_mappings: GestureMappings;
  /** Pose names disabled in this profile. */
  disabled_poses: string[];
  /** Per-profile stability threshold (frames). */
  pose_stability: number;
  /** Whether adaptive stability is active for this profile. */
  adaptive_stability: boolean;
  builtIn?: boolean;
}

export const BUILTIN_PROFILES: GestureProfile[] = [
  {
    id: "sketching",
    name: "Sketching",
    gesture_mappings: {
      ...DEFAULT_MAPPINGS,
    },
    disabled_poses: [],
    pose_stability: 5,
    adaptive_stability: false,
    builtIn: true,
  },
  {
    id: "note-taking",
    name: "Note-taking",
    gesture_mappings: {
      ...DEFAULT_MAPPINGS,
    },
    disabled_poses: [],
    pose_stability: 5,
    adaptive_stability: false,
    builtIn: true,
  },
  {
    id: "presentation",
    name: "Presentation",
    gesture_mappings: {
      ...DEFAULT_MAPPINGS,
    },
    disabled_poses: [],
    pose_stability: 5,
    adaptive_stability: false,
    builtIn: true,
  },
];

export function getProfile(profiles: GestureProfile[], id: string): GestureProfile | undefined {
  return profiles.find((p) => p.id === id);
}

export function makeBlankProfile(name: string): GestureProfile {
  return {
    id: `custom-${Date.now()}`,
    name,
    gesture_mappings: { ...DEFAULT_MAPPINGS },
    disabled_poses: [],
    pose_stability: 3,
    adaptive_stability: true,
  };
}
