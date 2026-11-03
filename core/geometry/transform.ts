import type { Point, Rect } from "@/types/canvas";
import type { Layer } from "@/types/layer";

const DEG = Math.PI / 180;

export function rotatePoint(p: Point, origin: Point, deg: number): Point {
  const r = deg * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
}

/** Corners of a layer's box after rotation around its (x, y) origin. */
export function layerCorners(l: Pick<Layer, "x" | "y" | "width" | "height" | "rotation">): Point[] {
  const o = { x: l.x, y: l.y };
  return [
    { x: l.x, y: l.y },
    { x: l.x + l.width, y: l.y },
    { x: l.x + l.width, y: l.y + l.height },
    { x: l.x, y: l.y + l.height },
  ].map((p) => (l.rotation ? rotatePoint(p, o, l.rotation) : p));
}

export function boundsOfPoints(pts: Point[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function layerBounds(l: Pick<Layer, "x" | "y" | "width" | "height" | "rotation">): Rect {
  return boundsOfPoints(layerCorners(l));
}

export function unionBounds(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  return boundsOfPoints(rects.flatMap((r) => [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y + r.height }]));
}

export function rectsIntersect(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.width + pad && a.x + a.width + pad > b.x && a.y < b.y + b.height + pad && a.y + a.height + pad > b.y;
}

export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function rectContains(outer: Rect, inner: Rect, tol = 0.5): boolean {
  return (
    inner.x >= outer.x - tol &&
    inner.y >= outer.y - tol &&
    inner.x + inner.width <= outer.x + outer.width + tol &&
    inner.y + inner.height <= outer.y + outer.height + tol
  );
}

/** Move a layer so that its visual bounding box's top-left lands on (x, y). */
export function translateLayerBoundsTo<T extends Layer>(l: T, x: number, y: number): T {
  const b = layerBounds(l);
  return { ...l, x: l.x + (x - b.x), y: l.y + (y - b.y) };
}

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/** Align layers to the selection bounds, or to `target` (e.g. the page) when given. */
export function alignLayers(layers: Layer[], mode: AlignMode, target?: Rect): Layer[] {
  const ref = target ?? unionBounds(layers.map(layerBounds));
  if (!ref) return layers;
  return layers.map((l) => {
    const b = layerBounds(l);
    let dx = 0;
    let dy = 0;
    if (mode === "left") dx = ref.x - b.x;
    if (mode === "right") dx = ref.x + ref.width - (b.x + b.width);
    if (mode === "hcenter") dx = ref.x + ref.width / 2 - (b.x + b.width / 2);
    if (mode === "top") dy = ref.y - b.y;
    if (mode === "bottom") dy = ref.y + ref.height - (b.y + b.height);
    if (mode === "vcenter") dy = ref.y + ref.height / 2 - (b.y + b.height / 2);
    return { ...l, x: l.x + dx, y: l.y + dy };
  });
}

/** Equal spacing between the visual bounds of 3+ layers along an axis. */
export function distributeLayers(layers: Layer[], axis: "x" | "y"): Layer[] {
  if (layers.length < 3) return layers;
  const items = layers.map((l) => ({ l, b: layerBounds(l) }));
  items.sort((a, b) => (axis === "x" ? a.b.x - b.b.x : a.b.y - b.b.y));
  const first = items[0].b;
  const last = items[items.length - 1].b;
  const span = axis === "x" ? last.x + last.width - first.x : last.y + last.height - first.y;
  const total = items.reduce((s, i) => s + (axis === "x" ? i.b.width : i.b.height), 0);
  const gap = (span - total) / (items.length - 1);
  let cursor = axis === "x" ? first.x : first.y;
  const moved = new Map<string, Layer>();
  for (const it of items) {
    const delta = cursor - (axis === "x" ? it.b.x : it.b.y);
    moved.set(it.l.id, axis === "x" ? { ...it.l, x: it.l.x + delta } : { ...it.l, y: it.l.y + delta });
    cursor += (axis === "x" ? it.b.width : it.b.height) + gap;
  }
  return layers.map((l) => moved.get(l.id) ?? l);
}

export interface SnapResult {
  dx: number;
  dy: number;
  guidesX: number[];
  guidesY: number[];
}

/**
 * Snap a moving box to target lines. Checks the box's start / centre / end on
 * each axis and returns the smallest correction within `threshold`.
 */
export function snapBox(box: Rect, targetsX: number[], targetsY: number[], threshold: number): SnapResult {
  const pick = (edges: number[], targets: number[]) => {
    let best: { d: number; t: number } | null = null;
    for (const e of edges)
      for (const t of targets) {
        const d = t - e;
        if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t };
      }
    return best;
  };
  const sx = pick([box.x, box.x + box.width / 2, box.x + box.width], targetsX);
  const sy = pick([box.y, box.y + box.height / 2, box.y + box.height], targetsY);
  const dx = sx?.d ?? 0;
  const dy = sy?.d ?? 0;
  const moved = { ...box, x: box.x + dx, y: box.y + dy };
  const hits = (edges: number[], targets: number[]) => targets.filter((t) => edges.some((e) => Math.abs(e - t) < 0.5));
  return {
    dx,
    dy,
    guidesX: sx ? hits([moved.x, moved.x + moved.width / 2, moved.x + moved.width], targetsX) : [],
    guidesY: sy ? hits([moved.y, moved.y + moved.height / 2, moved.y + moved.height], targetsY) : [],
  };
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
