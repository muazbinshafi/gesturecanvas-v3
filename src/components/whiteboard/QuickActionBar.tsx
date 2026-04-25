/**
 * QuickActionBar — small floating on-screen toolbar that mirrors the user's
 * gesture mappings. Provides a tap-able fallback for the common actions:
 * undo, redo, save, screenshot, and toggle grid.
 *
 * The bar reads the current gesture_mappings so the icon set always reflects
 * what the user has configured (e.g. if THUMBS_UP is mapped to redo, the
 * Redo button shows the 👍 emoji as a hint).
 */
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Undo2, Redo2, Save, Camera as CameraIcon, Grid3x3 } from "lucide-react";
import type { AppSettings } from "@/hooks/useSyncEngine";
import type { GestureAction } from "@/lib/whiteboard/types";

interface Props {
  settings: AppSettings;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onScreenshot: () => void;
  onToggleGrid: () => void;
}

const POSE_EMOJI: Record<string, string> = {
  PEACE: "✌️", THREE: "🤟", OK: "👌", ROCK: "🤘", CALL: "🤙",
  GUN: "🔫", L_SHAPE: "🔠", THUMBS_UP: "👍", THUMBS_DOWN: "👎",
};

function findPoseFor(settings: AppSettings, action: GestureAction): string | null {
  for (const [pose, mapped] of Object.entries(settings.gesture_mappings)) {
    if (mapped === action && !settings.disabled_poses.includes(pose)) return pose;
  }
  return null;
}

export function QuickActionBar({ settings, onUndo, onRedo, onSave, onScreenshot, onToggleGrid }: Props) {
  const items = [
    { key: "undo",       label: "Undo",       icon: Undo2,      onClick: onUndo,       action: "undo" as const },
    { key: "redo",       label: "Redo",       icon: Redo2,      onClick: onRedo,       action: "redo" as const },
    { key: "save",       label: "Save",       icon: Save,       onClick: onSave,       action: "save" as const },
    { key: "screenshot", label: "Screenshot", icon: CameraIcon, onClick: onScreenshot, action: "screenshot" as const },
    {
      key: "grid", label: settings.show_grid ? "Hide grid" : "Show grid",
      icon: Grid3x3, onClick: onToggleGrid, action: "toggle_grid" as const,
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 glass rounded-full px-1.5 py-1 shadow-toolbar flex items-center gap-0.5"
        role="toolbar"
        aria-label="Quick actions"
      >
        {items.map(({ key, label, icon: Icon, onClick, action }) => {
          const pose = findPoseFor(settings, action);
          const emoji = pose ? POSE_EMOJI[pose] : null;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 relative"
                  onClick={onClick}
                  aria-label={label}
                >
                  <Icon className="w-4 h-4" />
                  {emoji && (
                    <span
                      className="absolute -top-0.5 -right-0.5 text-[9px] leading-none"
                      aria-hidden
                      title={`Gesture: ${pose}`}
                    >
                      {emoji}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {label}
                {pose && <span className="ml-1 text-muted-foreground">· {pose}</span>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
