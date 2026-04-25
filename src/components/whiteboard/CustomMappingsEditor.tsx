/**
 * Custom gesture-to-action editor.
 * Lets the user create, rename, reorder, enable/disable, and validate
 * additional pose → tool/action mappings that override the base map.
 *
 * Validation rules:
 *  - Name must be non-empty (≤ 40 chars).
 *  - Pose must be one of the 14 known pose keys.
 *  - Action must be a valid Tool or GestureAction (and not "none").
 *  - No two enabled mappings may use the same pose (the higher-priority one
 *    would always win — we surface this as a warning).
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Plus, Sparkles, Trash2,
} from "lucide-react";
import {
  type GestureMappings, type Tool, type GestureAction, type CustomMapping,
} from "@/lib/whiteboard/types";
import { TOOL_NAMES, ACTION_NAMES, isTool, isAction } from "@/lib/whiteboard/actions";

type PoseKey = keyof GestureMappings;
const POSE_KEYS: PoseKey[] = [
  "DRAW", "HOVER", "PAN", "ERASE", "PINCH",
  "PEACE", "THREE", "OK", "ROCK", "CALL", "GUN", "L_SHAPE", "THUMBS_UP", "THUMBS_DOWN",
];

const POSE_EMOJI: Record<PoseKey, string> = {
  DRAW: "☝️", HOVER: "✌️", PAN: "✊", ERASE: "🖐️", PINCH: "🤏",
  PEACE: "✌️", THREE: "🤟", OK: "👌", ROCK: "🤘", CALL: "🤙",
  GUN: "🔫", L_SHAPE: "🔠", THUMBS_UP: "👍", THUMBS_DOWN: "👎",
};

interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function validateMapping(m: CustomMapping, all: CustomMapping[]): ValidationResult {
  const errs: string[] = [];
  const name = m.name.trim();
  if (!name) errs.push("Name is required");
  if (name.length > 40) errs.push("Name must be ≤ 40 characters");
  if (!POSE_KEYS.includes(m.pose)) errs.push("Invalid pose");
  if (!isTool(m.action) && !isAction(m.action)) errs.push("Invalid action");
  if (m.action === "none") errs.push("Action cannot be 'none'");
  // Duplicate pose among enabled customs (excluding self)
  if (m.enabled) {
    const dup = all.find((x) => x.id !== m.id && x.enabled && x.pose === m.pose);
    if (dup) errs.push(`Pose ${m.pose} also used by "${dup.name}" — only the higher one will fire`);
  }
  return { ok: errs.length === 0, errors: errs };
}

/** Resolve which custom mapping (if any) applies for a pose. */
export function resolveCustom(pose: string, customs: CustomMapping[]): CustomMapping | undefined {
  return [...customs]
    .filter((m) => m.enabled && m.pose === pose)
    .sort((a, b) => a.order - b.order)[0];
}

export function CustomMappingsEditor({
  mappings, onChange, livePose,
}: {
  mappings: CustomMapping[];
  onChange: (next: CustomMapping[]) => void;
  /** Live current pose (for the preview pill). "NONE" or "" when idle. */
  livePose: string;
}) {
  const sorted = useMemo(
    () => [...mappings].sort((a, b) => a.order - b.order),
    [mappings],
  );

  const [draftName, setDraftName] = useState("");
  const [draftPose, setDraftPose] = useState<PoseKey>("PEACE");
  const [draftAction, setDraftAction] = useState<Tool | GestureAction>("undo");

  const reindex = (list: CustomMapping[]): CustomMapping[] =>
    list.map((m, i) => ({ ...m, order: i }));

  const add = () => {
    const m: CustomMapping = {
      id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: draftName.trim() || `${draftPose} → ${draftAction}`,
      pose: draftPose,
      action: draftAction,
      order: sorted.length,
      enabled: true,
      createdAt: Date.now(),
    };
    const v = validateMapping(m, [...mappings, m]);
    if (!v.ok) {
      // still allow adding, but flag — UI shows the error inline
    }
    onChange([...mappings, m]);
    setDraftName("");
  };

  const updateOne = (id: string, patch: Partial<CustomMapping>) => {
    onChange(mappings.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const remove = (id: string) => {
    onChange(reindex(mappings.filter((m) => m.id !== id)));
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((m) => m.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(reindex(next));
  };

  // Live preview: which mapping would currently fire for the live pose?
  const previewWinner = livePose && livePose !== "NONE"
    ? resolveCustom(livePose, mappings)
    : undefined;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Custom gesture → action
        </h3>
        <span className="text-[10px] text-muted-foreground">{mappings.length} mapping(s)</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Override the base mappings for any pose. Higher in the list = higher precedence.
        Live pose: <strong className="text-foreground font-mono">{livePose || "—"}</strong>
        {previewWinner && (
          <span className="ml-1 inline-flex items-center gap-1 text-success">
            → <strong>{previewWinner.action}</strong>
          </span>
        )}
      </p>

      {/* Composer */}
      <div className="rounded-md border border-dashed border-border p-2 mb-3 space-y-2">
        <Input
          placeholder="Mapping name (e.g. Quick screenshot)"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          maxLength={40}
          className="h-8 text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={draftPose}
            onChange={(e) => setDraftPose(e.target.value as PoseKey)}
            className="bg-input text-foreground rounded-md px-2 py-1 text-xs border border-border"
          >
            {POSE_KEYS.map((k) => (
              <option key={k} value={k}>{POSE_EMOJI[k]} {k}</option>
            ))}
          </select>
          <select
            value={draftAction}
            onChange={(e) => setDraftAction(e.target.value as Tool | GestureAction)}
            className="bg-input text-foreground rounded-md px-2 py-1 text-xs border border-border"
          >
            <optgroup label="Tools">
              {TOOL_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </optgroup>
            <optgroup label="Actions">
              {ACTION_NAMES.filter((a) => a !== "none").map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <Button size="sm" onClick={add} className="w-full gap-1.5 h-7 text-xs">
          <Plus className="w-3.5 h-3.5" /> Add custom mapping
        </Button>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">No custom mappings yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((m, i) => {
            const v = validateMapping(m, mappings);
            const isLiveMatch = m.enabled && livePose === m.pose && previewWinner?.id === m.id;
            return (
              <li
                key={m.id}
                className={`rounded-md border p-2 text-xs space-y-1.5 ${
                  isLiveMatch ? "border-success ring-1 ring-success/40" :
                  v.ok ? "border-border" : "border-warning/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-base shrink-0" aria-hidden>{POSE_EMOJI[m.pose]}</span>
                  <Input
                    value={m.name}
                    onChange={(e) => updateOne(m.id, { name: e.target.value })}
                    maxLength={40}
                    className="h-7 text-xs flex-1"
                    aria-label="Rename mapping"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => move(m.id, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => move(m.id, +1)} disabled={i === sorted.length - 1} aria-label="Move down">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => remove(m.id)} aria-label="Delete mapping">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={m.pose}
                    onChange={(e) => updateOne(m.id, { pose: e.target.value as PoseKey })}
                    className="bg-input text-foreground rounded-md px-2 py-1 text-xs border border-border flex-1 min-w-0"
                  >
                    {POSE_KEYS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  <span className="text-muted-foreground shrink-0">→</span>
                  <select
                    value={m.action}
                    onChange={(e) => updateOne(m.id, { action: e.target.value as Tool | GestureAction })}
                    className="bg-input text-foreground rounded-md px-2 py-1 text-xs border border-border flex-1 min-w-0"
                  >
                    <optgroup label="Tools">
                      {TOOL_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                    <optgroup label="Actions">
                      {ACTION_NAMES.filter((a) => a !== "none").map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </optgroup>
                  </select>
                  <label className="text-[10px] flex items-center gap-1 shrink-0">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={(e) => updateOne(m.id, { enabled: e.target.checked })}
                    />
                    on
                  </label>
                </div>
                {v.ok ? (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-success" /> Priority {i + 1}
                    {isLiveMatch && <span className="ml-1 text-success font-medium">· firing now</span>}
                  </div>
                ) : (
                  <ul className="text-[10px] text-warning space-y-0.5">
                    {v.errors.map((e, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 mt-px shrink-0" /> <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
