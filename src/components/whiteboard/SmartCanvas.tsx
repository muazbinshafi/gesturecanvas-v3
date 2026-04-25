/**
 * SmartCanvas — vector drawing surface with viewport (pan/zoom), layers,
 * sticky notes, images, palm rejection, pen pressure, and theme-aware bg.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";
import { getStroke } from "perfect-freehand";
import {
  BOARD_THEMES, STICKY_COLORS, type BoardData, type BoardObject, type BoardTheme,
  type ImageObject, type Layer, type PalmRejectionSettings, type Point,
  type ShapeObject, type StickyObject, type StrokeObject, type TextObject, type Tool,
  type Viewport, DEFAULT_VIEWPORT,
} from "@/lib/whiteboard/types";
import { detectShape } from "@/lib/whiteboard/heuristics";
import { recognizeInkAI } from "@/lib/whiteboard/ai";
import { autoLayoutArrow } from "@/lib/whiteboard/autolayout";

export interface SmartCanvasHandle {
  exportPNG: (background?: string) => Promise<Blob | null>;
  exportData: () => BoardData;
  loadData: (d: BoardData) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  applyGestureCursor: (pose: string, cursor: { x: number; y: number } | null) => void;
  applyTwoHand: (info: TwoHandInfo | null) => void;
  setViewport: (v: Viewport) => void;
  getViewport: () => Viewport;
  resetViewport: () => void;
  zoomBy: (factor: number, cx?: number, cy?: number) => void;
  panBy: (dx: number, dy: number) => void;
  addImage: (src: string, x?: number, y?: number, w?: number, h?: number) => void;
  addSticky: (x?: number, y?: number) => void;
  addObjects: (objs: BoardObject[]) => void;
  getCanvasEl: () => HTMLCanvasElement | null;
  centerOn: (x: number, y: number) => void;
}

export interface TwoHandInfo {
  midX: number; midY: number;
  /** Distance between two finger tips, normalized to canvas pixels. */
  dist: number;
  /** Rotation angle (radians) between the two cursors. */
  angle: number;
}

interface Props {
  tool: Tool;
  color: string;
  size: number;
  smartInkMode: "off" | "heuristics" | "auto" | "latex";
  online: boolean;
  readOnly?: boolean;
  initialData?: BoardData;
  onChange?: (data: BoardData) => void;
  layersVisible?: Record<Layer, boolean>;
  activeLayer?: Layer;
  theme?: BoardTheme;
  palm?: PalmRejectionSettings;
  onRemoteEcho?: (op: { kind: "add" | "clear" | "undo" | "load"; objects?: BoardObject[]; data?: BoardData }) => void;
}

const DEFAULT_LAYERS_VISIBLE: Record<Layer, boolean> = { ink: true, shapes: true, text: true, objects: true };
const DEFAULT_PALM_PROP: PalmRejectionSettings = { enabled: false, acceptedPointerTypes: ["pen", "mouse", "touch"] };

export const SmartCanvas = forwardRef<SmartCanvasHandle, Props>(function SmartCanvas(
  {
    tool, color, size, smartInkMode, online, readOnly, initialData, onChange,
    layersVisible = DEFAULT_LAYERS_VISIBLE,
    activeLayer = "ink",
    theme = "dark",
    palm = DEFAULT_PALM_PROP,
    onRemoteEcho,
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const objectsRef = useRef<BoardObject[]>(initialData?.objects ?? []);
  const drawingRef = useRef<{ id: string; points: Point[] } | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<BoardObject[][]>([]);
  const redoStackRef = useRef<BoardObject[][]>([]);
  const gestureDownRef = useRef(false);
  const lastGestureCursorRef = useRef<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<Viewport>({ ...DEFAULT_VIEWPORT });
  const panStartRef = useRef<{ vx: number; vy: number; mx: number; my: number } | null>(null);
  const twoHandRef = useRef<{ baseDist: number; baseScale: number; baseVx: number; baseVy: number; baseMidX: number; baseMidY: number } | null>(null);
  const themeBg = BOARD_THEMES[theme]?.bg ?? "#0d0f1a";

  // Resize observer
  useEffect(() => {
    const onResize = () => {
      const wrap = wrapRef.current; if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      const w = Math.max(320, Math.floor(r.width));
      const h = Math.max(320, Math.floor(r.height));
      setDims({ w, h });
    };
    onResize();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => { window.removeEventListener("resize", onResize); ro.disconnect(); };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { redrawBase(); }, [dims.w, dims.h, themeBg, layersVisible.ink, layersVisible.shapes, layersVisible.text, layersVisible.objects]);

  function pushUndo() {
    undoStackRef.current.push(objectsRef.current.map((o) => ({ ...o })));
    redoStackRef.current = [];
    if (undoStackRef.current.length > 100) undoStackRef.current.shift();
  }
  function commit(broadcastObjs?: BoardObject[]) {
    onChange?.({ version: 1, objects: objectsRef.current, width: dims.w, height: dims.h });
    if (broadcastObjs && onRemoteEcho) onRemoteEcho({ kind: "add", objects: broadcastObjs });
    redrawBase();
  }

  // World ↔ screen helpers
  function worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const v = viewportRef.current;
    return { x: wx * v.scale + v.x, y: wy * v.scale + v.y };
  }
  function screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const v = viewportRef.current;
    return { x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale };
  }
  function visibleLayer(o: BoardObject): boolean {
    const l: Layer = (o.layer ?? defaultLayerFor(o));
    return layersVisible[l];
  }

  function applyViewportTransform(ctx: CanvasRenderingContext2D) {
    const dpr = window.devicePixelRatio || 1;
    const v = viewportRef.current;
    ctx.setTransform(dpr * v.scale, 0, 0, dpr * v.scale, dpr * v.x, dpr * v.y);
  }

  function redrawBase() {
    const c = baseRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = dims.w * dpr; c.height = dims.h * dpr;
    c.style.width = dims.w + "px"; c.style.height = dims.h + "px";
    // background fill in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = themeBg;
    ctx.fillRect(0, 0, dims.w, dims.h);
    drawGrid(ctx, dims.w, dims.h, viewportRef.current, theme);
    // objects in world space
    applyViewportTransform(ctx);
    for (const o of objectsRef.current) if (visibleLayer(o)) drawObject(ctx, o);
  }

  function redrawLive() {
    const c = liveRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = dims.w * dpr; c.height = dims.h * dpr;
    c.style.width = dims.w + "px"; c.style.height = dims.h + "px";
    applyViewportTransform(ctx);
    const d = drawingRef.current;
    if (d) drawStrokePath(ctx, d.points, color, size);
    const g = lastGestureCursorRef.current;
    if (g) {
      // gesture cursor drawn in screen space — switch transform briefly
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.beginPath();
      ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 2; ctx.stroke();
      applyViewportTransform(ctx);
    }
  }

  useEffect(() => {
    let raf = 0;
    const step = () => { redrawLive(); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims.w, dims.h, color, size]);

  const startAt = useCallback((x: number, y: number) => {
    if (readOnly) return;
    if (tool === "pen") {
      const id = Math.random().toString(36).slice(2);
      drawingRef.current = { id, points: [{ x, y, p: 0.5 }] };
    } else if (tool === "rect" || tool === "circle" || tool === "arrow") {
      shapeStartRef.current = { x, y };
    } else if (tool === "eraser") {
      eraseAt(x, y);
    } else if (tool === "text") {
      const t = window.prompt("Text:");
      if (t) {
        pushUndo();
        const obj: TextObject = { id: Math.random().toString(36).slice(2), type: "text", x, y, text: t, color, size: Math.max(14, size * 4), createdAt: Date.now(), layer: "text" };
        objectsRef.current = [...objectsRef.current, obj];
        commit([obj]);
      }
    } else if (tool === "sticky") {
      addSticky(x, y);
    } else if (tool === "pan") {
      panStartRef.current = { vx: viewportRef.current.x, vy: viewportRef.current.y, mx: x, my: y };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, color, size, readOnly]);

  const moveAt = useCallback((x: number, y: number, p?: number) => {
    if (drawingRef.current) drawingRef.current.points.push({ x, y, p: p ?? 0.5 });
    if (shapeStartRef.current) {
      const s = shapeStartRef.current;
      const ctx = liveRef.current?.getContext("2d"); if (!ctx) return;
      applyViewportTransform(ctx);
      ctx.clearRect(-1e6, -1e6, 2e6, 2e6);
      drawShape(ctx, tool as "rect" | "circle" | "arrow", s.x, s.y, x - s.x, y - s.y, color, size);
    }
    if (tool === "eraser" && gestureDownRef.current) eraseAt(x, y);
    if (tool === "pan" && panStartRef.current) {
      const start = panStartRef.current;
      // x,y are world coords from screenToWorld at start; for pan we use raw screen deltas
      // We store `mx,my` as world coords from the down event, so this is approximate.
      const v = viewportRef.current;
      v.x = start.vx + (x - start.mx) * v.scale;
      v.y = start.vy + (y - start.my) * v.scale;
      redrawBase();
    }
  }, [tool, color, size]);

  const endAt = useCallback(async (x: number, y: number) => {
    const d = drawingRef.current;
    if (d && d.points.length > 1) {
      pushUndo();
      const stroke: StrokeObject = { id: d.id, type: "stroke", points: d.points, color, size, createdAt: Date.now(), layer: "ink" };
      let replaced: BoardObject | null = null;
      if (smartInkMode !== "off") {
        replaced = detectShape({ points: d.points, color, size, id: d.id, createdAt: stroke.createdAt });
        if (replaced && (replaced.type === "rect" || replaced.type === "circle")) (replaced as ShapeObject).layer = "shapes";
        if (!replaced && (smartInkMode === "auto" || smartInkMode === "latex") && online && d.points.length > 12) {
          const dataUrl = await rasterizeStrokeToPNG(d.points, color, size);
          if (dataUrl) {
            const ai = await recognizeInkAI(dataUrl, smartInkMode === "latex" ? "math" : "general");
            if (ai && ai.confidence > 0.6) {
              if (ai.kind === "shape") {
                replaced = detectShape({ points: d.points, color, size, id: d.id, createdAt: stroke.createdAt }) ?? null;
                if (replaced && (replaced.type === "rect" || replaced.type === "circle")) (replaced as ShapeObject).layer = "shapes";
              } else if (ai.kind === "text" || ai.kind === "equation") {
                const minX = Math.min(...d.points.map((p) => p.x));
                const minY = Math.min(...d.points.map((p) => p.y));
                replaced = {
                  id: d.id, type: "text", x: minX, y: minY,
                  text: ai.value, color, size: 18, createdAt: stroke.createdAt, layer: "text",
                  ...(ai.kind === "equation" ? { latex: true } : {}),
                } as TextObject;
              }
            }
          }
        }
      }
      const finalObj = replaced ?? stroke;
      objectsRef.current = [...objectsRef.current, finalObj];
      commit([finalObj]);
    }
    drawingRef.current = null;
    if (shapeStartRef.current) {
      const s = shapeStartRef.current;
      const w = x - s.x, h = y - s.y;
      if (Math.abs(w) > 4 || Math.abs(h) > 4) {
        pushUndo();
        let obj: ShapeObject = { id: Math.random().toString(36).slice(2), type: tool as "rect" | "circle" | "arrow", x: s.x, y: s.y, w, h, color, size, createdAt: Date.now(), layer: "shapes" };
        if (obj.type === "arrow") obj = autoLayoutArrow(obj, objectsRef.current);
        objectsRef.current = [...objectsRef.current, obj];
        commit([obj]);
      }
      shapeStartRef.current = null;
    }
    panStartRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, color, size, smartInkMode, online]);

  function eraseAt(x: number, y: number) {
    const r = Math.max(10, size * 3);
    const before = objectsRef.current.length;
    objectsRef.current = objectsRef.current.filter((o) => !visibleLayer(o) || !hitTest(o, x, y, r));
    if (objectsRef.current.length !== before) { pushUndo(); commit(); }
  }

  function shouldAcceptPointer(e: React.PointerEvent): boolean {
    if (!palm.enabled) return true;
    const pt = e.pointerType as "pen" | "mouse" | "touch";
    if (!palm.acceptedPointerTypes.includes(pt)) return false;
    // Palm rejection heuristic: large radius + low pressure on touch likely a palm.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ne = e as unknown as { width?: number; height?: number; pressure?: number };
    if (pt === "touch") {
      const w = ne.width ?? 0, h = ne.height ?? 0;
      const radius = Math.max(w, h);
      if (radius > 40 && (ne.pressure ?? 0) < 0.05) return false;
    }
    return true;
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (!shouldAcceptPointer(e)) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
    startAt(w.x, w.y);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!shouldAcceptPointer(e)) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
    const pressure = e.pressure > 0 ? e.pressure : undefined;
    moveAt(w.x, w.y, pressure);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!shouldAcceptPointer(e)) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
    endAt(w.x, w.y);
  };

  // Wheel: trackpad pan (no ctrl) / pinch zoom (ctrl).
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault?.();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.002);
      zoomBy(factor, sx, sy);
    } else {
      const v = viewportRef.current;
      v.x -= e.deltaX; v.y -= e.deltaY;
      redrawBase();
    }
  };

  function zoomBy(factor: number, cx?: number, cy?: number) {
    const v = viewportRef.current;
    const sx = cx ?? dims.w / 2;
    const sy = cy ?? dims.h / 2;
    const newScale = Math.min(8, Math.max(0.1, v.scale * factor));
    // keep point under cursor stable
    const wx = (sx - v.x) / v.scale;
    const wy = (sy - v.y) / v.scale;
    v.scale = newScale;
    v.x = sx - wx * v.scale;
    v.y = sy - wy * v.scale;
    redrawBase();
  }
  function panBy(dx: number, dy: number) {
    const v = viewportRef.current;
    v.x += dx; v.y += dy;
    redrawBase();
  }

  const applyGestureCursor = useCallback((pose: string, cursor: { x: number; y: number } | null) => {
    lastGestureCursorRef.current = cursor;
    if (!cursor) {
      if (gestureDownRef.current) { endAt(0, 0); gestureDownRef.current = false; }
      return;
    }
    // gesture cursor is in screen space — convert
    const w = screenToWorld(cursor.x, cursor.y);
    const isDrawing = pose === "DRAW" && tool === "pen";
    const isErasing = pose === "ERASE";
    const wantsDown = isDrawing || isErasing;
    if (wantsDown && !gestureDownRef.current) {
      gestureDownRef.current = true;
      if (isDrawing) startAt(w.x, w.y);
      if (isErasing) eraseAt(w.x, w.y);
    } else if (wantsDown && gestureDownRef.current) {
      moveAt(w.x, w.y);
    } else if (!wantsDown && gestureDownRef.current) {
      gestureDownRef.current = false;
      endAt(w.x, w.y);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, startAt, moveAt, endAt]);

  const applyTwoHand = useCallback((info: TwoHandInfo | null) => {
    if (!info) { twoHandRef.current = null; return; }
    if (!twoHandRef.current) {
      const v = viewportRef.current;
      twoHandRef.current = { baseDist: info.dist, baseScale: v.scale, baseVx: v.x, baseVy: v.y, baseMidX: info.midX, baseMidY: info.midY };
      return;
    }
    const start = twoHandRef.current;
    const factor = info.dist / Math.max(1, start.baseDist);
    const newScale = Math.min(8, Math.max(0.1, start.baseScale * factor));
    const v = viewportRef.current;
    // anchor at original mid point; also pan with mid movement
    const wx = (start.baseMidX - start.baseVx) / start.baseScale;
    const wy = (start.baseMidY - start.baseVy) / start.baseScale;
    v.scale = newScale;
    v.x = info.midX - wx * v.scale;
    v.y = info.midY - wy * v.scale;
    redrawBase();
  }, []);

  function addImage(src: string, x?: number, y?: number, w = 240, h = 180) {
    const wx = x ?? screenToWorld(dims.w / 2, dims.h / 2).x - w / 2;
    const wy = y ?? screenToWorld(dims.w / 2, dims.h / 2).y - h / 2;
    pushUndo();
    const obj: ImageObject = { id: Math.random().toString(36).slice(2), type: "image", x: wx, y: wy, w, h, src, color: "#000", createdAt: Date.now(), layer: "objects" };
    objectsRef.current = [...objectsRef.current, obj];
    commit([obj]);
  }

  function addSticky(x?: number, y?: number) {
    const wx = x ?? screenToWorld(dims.w / 2, dims.h / 2).x - 80;
    const wy = y ?? screenToWorld(dims.w / 2, dims.h / 2).y - 50;
    const text = window.prompt("Sticky note:") ?? "";
    if (text === null) return;
    const bg = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
    pushUndo();
    const obj: StickyObject = { id: Math.random().toString(36).slice(2), type: "sticky", x: wx, y: wy, w: 160, h: 100, text, bg, color: "#1f2937", size: 14, createdAt: Date.now(), layer: "objects" };
    objectsRef.current = [...objectsRef.current, obj];
    commit([obj]);
  }

  // Drag-and-drop image files
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
    files.forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = () => addImage(reader.result as string, w.x + i * 20, w.y + i * 20);
      reader.readAsDataURL(f);
    });
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  useImperativeHandle(ref, () => ({
    exportPNG: async (background) => {
      const bg = background ?? themeBg;
      const out = document.createElement("canvas");
      const dpr = window.devicePixelRatio || 1;
      out.width = dims.w * dpr; out.height = dims.h * dpr;
      const ctx = out.getContext("2d"); if (!ctx) return null;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, dims.w, dims.h);
      const v = viewportRef.current;
      ctx.save();
      ctx.translate(v.x, v.y); ctx.scale(v.scale, v.scale);
      for (const o of objectsRef.current) if (visibleLayer(o)) drawObject(ctx, o);
      ctx.restore();
      return await new Promise<Blob | null>((res) => out.toBlob((b) => res(b), "image/png"));
    },
    exportData: () => ({ version: 1, objects: objectsRef.current, width: dims.w, height: dims.h, exportedAt: new Date().toISOString() }),
    loadData: (d) => { pushUndo(); objectsRef.current = d.objects ?? []; commit(); onRemoteEcho?.({ kind: "load", data: d }); },
    clear: () => { pushUndo(); objectsRef.current = []; commit(); onRemoteEcho?.({ kind: "clear" }); },
    undo: () => {
      const prev = undoStackRef.current.pop();
      if (prev) {
        redoStackRef.current.push(objectsRef.current.map((o) => ({ ...o })));
        objectsRef.current = prev; commit();
        onRemoteEcho?.({ kind: "undo" });
      }
    },
    redo: () => {
      const next = redoStackRef.current.pop();
      if (next) {
        undoStackRef.current.push(objectsRef.current.map((o) => ({ ...o })));
        objectsRef.current = next; commit();
      }
    },
    applyGestureCursor,
    applyTwoHand,
    setViewport: (v) => { viewportRef.current = { ...v }; redrawBase(); },
    getViewport: () => ({ ...viewportRef.current }),
    resetViewport: () => { viewportRef.current = { ...DEFAULT_VIEWPORT }; redrawBase(); },
    zoomBy,
    panBy,
    addImage,
    addSticky,
    addObjects: (objs) => { pushUndo(); objectsRef.current = [...objectsRef.current, ...objs]; commit(objs); },
    getCanvasEl: () => baseRef.current,
    centerOn: (x, y) => {
      const v = viewportRef.current;
      v.x = dims.w / 2 - x * v.scale;
      v.y = dims.h / 2 - y * v.scale;
      redrawBase();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [dims.w, dims.h, applyGestureCursor, applyTwoHand, themeBg]);

  return (
    <div ref={wrapRef} className="relative w-full h-full rounded-lg overflow-hidden touch-none select-none" style={{ background: themeBg }}>
      <canvas ref={baseRef} className="absolute inset-0" />
      <canvas
        ref={liveRef}
        className="absolute inset-0"
        style={{ cursor: tool === "pen" ? "crosshair" : tool === "eraser" ? "cell" : tool === "pan" ? "grab" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDrop={onDrop}
        onDragOver={onDragOver}
      />
    </div>
  );
});

function defaultLayerFor(o: BoardObject): Layer {
  switch (o.type) {
    case "stroke": return "ink";
    case "rect":
    case "circle":
    case "arrow": return "shapes";
    case "text": return "text";
    case "sticky":
    case "image": return "objects";
    default: return "ink";
  }
}

function drawObject(ctx: CanvasRenderingContext2D, o: BoardObject) {
  if (o.type === "stroke") drawStrokePath(ctx, o.points, o.color, o.size);
  else if (o.type === "rect" || o.type === "circle" || o.type === "arrow") drawShape(ctx, o.type, o.x, o.y, o.w, o.h, o.color, o.size);
  else if (o.type === "text") {
    ctx.fillStyle = o.color;
    ctx.font = `${o.size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    if (o.latex) ctx.fillText(`∑ ${o.text}`, o.x, o.y);
    else ctx.fillText(o.text, o.x, o.y);
  } else if (o.type === "sticky") {
    ctx.fillStyle = o.bg;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = o.color || "#1f2937";
    ctx.font = `${o.size || 14}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    wrapText(ctx, o.text, o.x + 10, o.y + 10, o.w - 20, (o.size || 14) + 4);
  } else if (o.type === "image") {
    drawImageObject(ctx, o);
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy); line = words[i]; cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

const imageCache = new Map<string, HTMLImageElement>();
function drawImageObject(ctx: CanvasRenderingContext2D, o: ImageObject) {
  let img = imageCache.get(o.src);
  if (!img) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.src = o.src;
    imageCache.set(o.src, img);
  }
  if (img.complete && img.naturalWidth) {
    ctx.drawImage(img, o.x, o.y, o.w, o.h);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(o.x, o.y, o.w, o.h);
  }
}

function drawStrokePath(ctx: CanvasRenderingContext2D, points: Point[], color: string, size: number) {
  if (points.length < 2) return;
  const stroke = getStroke(points.map((p) => [p.x, p.y, p.p ?? 0.5]), {
    size: size * 2.2, thinning: 0.5, smoothing: 0.6, streamline: 0.5,
  });
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < stroke.length; i++) {
    const [x, y] = stroke[i];
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawShape(ctx: CanvasRenderingContext2D, type: "rect" | "circle" | "arrow", x: number, y: number, w: number, h: number, color: string, size: number) {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, size); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (type === "rect") ctx.strokeRect(x, y, w, h);
  else if (type === "circle") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "arrow") {
    const x2 = x + w, y2 = y + h;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    const ang = Math.atan2(h, w); const head = Math.max(10, size * 3);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
    ctx.stroke();
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, v: Viewport, theme: BoardTheme) {
  const step = 40 * v.scale;
  if (step < 12) return;
  ctx.save();
  ctx.strokeStyle = theme === "light" || theme === "sepia" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const offX = ((v.x % step) + step) % step;
  const offY = ((v.y % step) + step) % step;
  ctx.beginPath();
  for (let x = offX; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = offY; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.restore();
}

function hitTest(o: BoardObject, x: number, y: number, r: number): boolean {
  if (o.type === "stroke") return o.points.some((p) => Math.hypot(p.x - x, p.y - y) < r);
  if (o.type === "text") return x >= o.x - r && x <= o.x + 200 + r && y >= o.y - r && y <= o.y + o.size + r;
  if (o.type === "sticky" || o.type === "image") return x >= o.x - r && x <= o.x + o.w + r && y >= o.y - r && y <= o.y + o.h + r;
  const minX = Math.min(o.x, o.x + o.w), maxX = Math.max(o.x, o.x + o.w);
  const minY = Math.min(o.y, o.y + o.h), maxY = Math.max(o.y, o.y + o.h);
  return x >= minX - r && x <= maxX + r && y >= minY - r && y <= maxY + r;
}

async function rasterizeStrokeToPNG(points: Point[], color: string, size: number): Promise<string | null> {
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  const pad = 16; const w = Math.ceil(maxX - minX + pad * 2); const h = Math.ceil(maxY - minY + pad * 2);
  if (w < 8 || h < 8) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d"); if (!ctx) return null;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  const shifted = points.map((p) => ({ x: p.x - minX + pad, y: p.y - minY + pad, p: p.p }));
  drawStrokePath(ctx, shifted, color, Math.max(2, size));
  return c.toDataURL("image/png");
}
