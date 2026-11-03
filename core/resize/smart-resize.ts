import type { GridSettings, Guide, Rect } from "@/types/canvas";
import type { Layer, ShapeLayer, TextLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import { intersectionArea, layerBounds, translateLayerBoundsTo, unionBounds } from "@/core/geometry/transform";
import { approxMeasure, fitFontSize, layoutText, type MeasureFn } from "@/core/text/layout";

/**
 * Smart resize: adapt a finished design to a new format. Four strategies,
 * from the literal (uniform scale) to the structural (re-composition on a
 * new grid). The source document is never mutated; every layer id is kept.
 */

export type ResizeMode = "scale" | "preserve-type" | "reflow" | "reposition";

export const RESIZE_MODES: ResizeMode[] = ["scale", "preserve-type", "reflow", "reposition"];

/** Generated / resized type never goes below this (unless the source already did). */
export const MIN_RESIZE_FONT = 6;

export function describeResizeModes(): { id: ResizeMode; n: string; label: string; description: string }[] {
  return [
    { id: "scale", n: "01", label: "Scale to fit", description: "Uniformly scales the whole design to fit and centres it. Full-bleed backgrounds extend to the new edges." },
    { id: "preserve-type", n: "02", label: "Preserve type", description: "Positions remap proportionally between the margins, images cover their new boxes and text keeps its size, re-wrapping instead of stretching." },
    { id: "reflow", n: "03", label: "Reflow", description: "Re-composes on a new grid: hero image and text stack are rearranged for the new orientation while the type hierarchy is kept." },
    { id: "reposition", n: "04", label: "Reposition", description: "Keeps element sizes (scaled by the smaller factor) and anchors each one to its nearest edge or centre." },
  ];
}

const R = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
const isText = (l: Layer): l is TextLayer => l.type === "text";
const right = (r: Rect) => r.x + r.width;
const bottom = (r: Rect) => r.y + r.height;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function isFullBleed(l: Layer, W: number, H: number): boolean {
  const b = layerBounds(l);
  return b.x <= W * 0.01 && b.y <= H * 0.01 && right(b) >= W * 0.99 && bottom(b) >= H * 0.99;
}

function quarterTurn(l: Layer) {
  const r = ((l.rotation % 180) + 180) % 180;
  return Math.abs(r - 90) < 0.5;
}

/** Scale size-dependent style properties (type, strokes, radii, effects) by f. */
function scaleStyle<T extends Layer>(l: T, f: number): T {
  const c = { ...l } as Layer;
  if (c.type === "text") {
    const min = Math.min(c.fontSize, MIN_RESIZE_FONT);
    c.fontSize = Math.max(min, Math.round(c.fontSize * f * 10) / 10);
    c.backgroundPadding = c.backgroundPadding * f;
    c.strokeWidth = c.strokeWidth * f;
    c.shadow = { ...c.shadow, blur: c.shadow.blur * f, offsetX: c.shadow.offsetX * f, offsetY: c.shadow.offsetY * f };
  } else if (c.type === "shape") {
    c.strokeWidth = c.strokeWidth * f;
    c.cornerRadius = c.cornerRadius * f;
    if (c.dash) c.dash = c.dash.map((d) => d * f);
  } else if (c.type === "image") {
    c.cornerRadius = c.cornerRadius * f;
    c.border = { ...c.border, width: c.border.width * f };
    c.effects = { ...c.effects, blur: c.effects.blur * f, halftone: { ...c.effects.halftone, size: Math.max(1, c.effects.halftone.size * f) } };
  } else if (c.type === "texture") {
    c.scale = Math.max(0.1, c.scale * f);
  }
  return c as T;
}

/** Give the layer a box whose visual bounds equal `r` (quarter turns swap axes). */
function setBounds<T extends Layer>(l: T, r: Rect): T {
  let next: T;
  if (!l.rotation) return { ...l, x: r.x, y: r.y, width: Math.max(1, r.width), height: Math.max(1, r.height) };
  if (quarterTurn(l)) next = { ...l, width: Math.max(1, r.height), height: Math.max(1, r.width) };
  else {
    const b = layerBounds(l);
    const f = Math.min(r.width / Math.max(1, b.width), r.height / Math.max(1, b.height));
    next = { ...l, width: Math.max(1, l.width * f), height: Math.max(1, l.height * f) };
  }
  return translateLayerBoundsTo(next, r.x, r.y);
}

function textFitsWidth(t: TextLayer, measure: MeasureFn) {
  const lay = layoutText({ ...t, autoHeight: true }, measure);
  const inner = t.width - (t.backgroundPadding || 0) * 2;
  return !lay.overflow && lay.lines.every((ln) => ln.width <= inner + 0.5);
}

/**
 * Make text fit: shrink (not below MIN_RESIZE_FONT) until no word breaks and,
 * when maxH is given, the block is no taller than maxH. Height follows content.
 */
function refitText(t: TextLayer, measure: MeasureFn, maxH?: number, maxWidth?: number): TextLayer {
  if (t.vertical) return t;
  let out = { ...t };
  const min = Math.min(out.fontSize, MIN_RESIZE_FONT);
  const h0 = layoutText({ ...out, autoHeight: true }, measure).height;
  const limitH = maxH ?? (out.autoHeight ? Infinity : out.height);
  if (!textFitsWidth(out, measure) || h0 > limitH + 0.5) {
    const size = fitFontSize(out, { width: out.width, height: Number.isFinite(limitH) ? limitH : 1e7 }, measure, out.fontSize, min);
    out = { ...out, fontSize: size };
  }
  // Still breaking words at the floor size: widen the box (up to maxWidth).
  if (!textFitsWidth(out, measure) && maxWidth) {
    const lay = layoutText({ ...out, width: 1e6, autoHeight: true }, measure);
    const need = Math.max(...lay.lines.map((l) => l.width), 1) + (out.backgroundPadding || 0) * 2 + 2;
    out = { ...out, width: Math.min(maxWidth, Math.max(out.width, need)) };
  }
  const h = layoutText({ ...out, autoHeight: true }, measure).height;
  if (out.autoHeight || h > out.height) {
    // Keep the visual anchor for rotated text while its thickness changes.
    const before = layerBounds(out);
    out = { ...out, height: Math.ceil(h * 100) / 100 };
    if (out.rotation) out = translateLayerBoundsTo(out, before.x, before.y);
  }
  return out;
}

/** Keep a (non full-bleed) layer inside the page: shrink if larger, then translate. */
function clampToPage<T extends Layer>(l: T, W: number, H: number, measure: MeasureFn): T {
  let out: Layer = l;
  let b = layerBounds(out);
  if (b.width > W + 0.5 || b.height > H + 0.5) {
    const f = Math.min(W / b.width, H / b.height) * 0.98;
    if (isText(out)) {
      const along = quarterTurn(out) ? H : W;
      out = refitText({ ...out, width: Math.min(out.width, along * 0.98) }, measure, (quarterTurn(out) ? W : H) * 0.98);
    } else out = { ...out, width: out.width * f, height: out.height * f };
    b = layerBounds(out);
  }
  const nx = clamp(b.x, 0, Math.max(0, W - b.width));
  const ny = clamp(b.y, 0, Math.max(0, H - b.height));
  if (nx !== b.x || ny !== b.y) out = { ...out, x: out.x + (nx - b.x), y: out.y + (ny - b.y) };
  return out as T;
}

function scaleGrid(g: GridSettings, f: number, margins: GridSettings["margins"]): GridSettings {
  return { ...g, margins, gutter: Math.max(0, Math.round(g.gutter * f)), baseline: Math.max(2, Math.round(g.baseline * f)) };
}

function mapGuides(guides: Guide[], fx: (p: number) => number, fy: (p: number) => number, W: number, H: number): Guide[] {
  return guides
    .map((g) => ({ ...g, position: Math.round((g.axis === "x" ? fx(g.position) : fy(g.position)) * 100) / 100 }))
    .filter((g) => g.position >= 0 && g.position <= (g.axis === "x" ? W : H));
}

const roundMargins = (m: GridSettings["margins"]) => ({ top: Math.round(m.top), right: Math.round(m.right), bottom: Math.round(m.bottom), left: Math.round(m.left) });

// ── modes ────────────────────────────────────────────────────────────────────

function modeScale(doc: DesignDocument, tw: number, th: number, measure: MeasureFn): DesignDocument {
  const s = Math.min(tw / doc.width, th / doc.height);
  const ox = (tw - doc.width * s) / 2;
  const oy = (th - doc.height * s) / 2;
  const layers = doc.layers.map((l) => {
    if (isFullBleed(l, doc.width, doc.height)) return setBounds(scaleStyle(l, s), R(0, 0, tw, th));
    let n: Layer = scaleStyle(l, s);
    n = { ...n, x: ox + l.x * s, y: oy + l.y * s, width: l.width * s, height: l.height * s };
    if (isText(n)) n = refitText(n, measure, undefined, tw);
    return clampToPage(n, tw, th, measure);
  });
  const m = doc.grid.margins;
  return {
    ...doc,
    width: tw,
    height: th,
    layers,
    grid: scaleGrid(doc.grid, s, roundMargins({ top: oy + m.top * s, right: ox + m.right * s, bottom: oy + m.bottom * s, left: ox + m.left * s })),
    guides: mapGuides(doc.guides, (p) => ox + p * s, (p) => oy + p * s, tw, th),
  };
}

/** Per-axis linear map between the old and new live areas (inside the margins). */
function marginMapper(doc: DesignDocument, tw: number, th: number) {
  const s = Math.min(tw / doc.width, th / doc.height);
  const m = doc.grid.margins;
  const nm = { top: m.top * s, right: m.right * s, bottom: m.bottom * s, left: m.left * s };
  const cw = Math.max(1, doc.width - m.left - m.right);
  const ch = Math.max(1, doc.height - m.top - m.bottom);
  const kx = (tw - nm.left - nm.right) / cw;
  const ky = (th - nm.top - nm.bottom) / ch;
  const mx = (x: number) => nm.left + (x - m.left) * kx;
  const my = (y: number) => nm.top + (y - m.top) * ky;
  const mapRect = (b: Rect) => R(mx(b.x), my(b.y), b.width * kx, b.height * ky);
  return { s, nm, kx, ky, mx, my, mapRect };
}

const ASPECT_SHAPES = new Set(["circle", "star", "polygon", "triangle", "path"]);

/** Proportional placement used by preserve-type (and for decoration in reflow). */
function placeProportional(l: Layer, map: ReturnType<typeof marginMapper>, sx: number, sy: number, tw: number, th: number, measure: MeasureFn): Layer {
  const b = layerBounds(l);
  const target = map.mapRect(b);
  const keepAspect = (l.type === "shape" && ASPECT_SHAPES.has(l.shape)) || (l.type === "image" && /logo/i.test(l.name));
  if (!keepAspect && l.type !== "text") {
    return clampToPage(setBounds(scaleStyle(l, Math.sqrt(map.kx * map.ky)), target), tw, th, measure);
  }
  if (keepAspect) {
    const f = Math.min(map.kx, map.ky);
    const w = b.width * f;
    const h = b.height * f;
    const cx = target.x + target.width / 2;
    const cy = target.y + target.height / 2;
    return clampToPage(setBounds(scaleStyle(l, f), R(cx - w / 2, cy - h / 2, w, h)), tw, th, measure);
  }
  // Text: size by the area factor, width follows the new box, height re-wraps.
  const t = l as TextLayer;
  const f = Math.sqrt(sx * sy);
  const qt = quarterTurn(t);
  let n: TextLayer = scaleStyle(t, Math.min(f, Math.max(sx, sy)));
  const along = qt ? target.height : target.width;
  const across = qt ? target.width : target.height;
  n = { ...n, width: Math.max(1, along) };
  if (t.rotation) n = translateLayerBoundsTo(n, target.x, target.y);
  else n = { ...n, x: target.x, y: target.y };
  n = refitText(n, measure, Math.max(across * 1.15, n.fontSize * n.lineHeight), qt ? th : tw);
  return clampToPage(n, tw, th, measure);
}

function modePreserveType(doc: DesignDocument, tw: number, th: number, measure: MeasureFn): DesignDocument {
  const sx = tw / doc.width;
  const sy = th / doc.height;
  const map = marginMapper(doc, tw, th);
  const layers = doc.layers.map((l) =>
    isFullBleed(l, doc.width, doc.height) ? setBounds(scaleStyle(l, Math.sqrt(sx * sy)), R(0, 0, tw, th)) : placeProportional(l, map, sx, sy, tw, th, measure),
  );
  return {
    ...doc,
    width: tw,
    height: th,
    layers,
    grid: scaleGrid(doc.grid, map.s, roundMargins(map.nm)),
    guides: mapGuides(doc.guides, map.mx, map.my, tw, th),
  };
}

/** Anchor each element to its nearest edge / centre zone per axis. */
function anchoredRect(b: Rect, W: number, H: number, tw: number, th: number, s: number): Rect {
  const w = b.width * s;
  const h = b.height * s;
  const axis = (start: number, size: number, newSize: number, len: number, newLen: number) => {
    const c = (start + size / 2) / len;
    if (c < 0.4) return start * s;
    if (c > 0.6) return newLen - (len - (start + size)) * s - newSize;
    return newLen / 2 + (start + size / 2 - len / 2) * s - newSize / 2;
  };
  return R(axis(b.x, b.width, w, W, tw), axis(b.y, b.height, h, H, th), w, h);
}

function placeAnchored(l: Layer, W: number, H: number, tw: number, th: number, s: number, measure: MeasureFn): Layer {
  const b = layerBounds(l);
  const r = anchoredRect(b, W, H, tw, th, s);
  let n: Layer = scaleStyle(l, s);
  if (isText(n)) {
    n = { ...n, width: l.width * s, height: l.height * s };
    n = refitText(n, measure, undefined, tw);
    n = translateLayerBoundsTo(n, r.x, r.y);
    // Text that grew taller keeps its anchor edge (bottom / centre).
    const nb = layerBounds(n);
    const cy = (b.y + b.height / 2) / H;
    if (cy > 0.6) n = translateLayerBoundsTo(n, nb.x, bottom(r) - nb.height);
    else if (cy >= 0.4) n = translateLayerBoundsTo(n, nb.x, r.y + r.height / 2 - nb.height / 2);
  } else n = setBounds(n, r);
  return clampToPage(n, tw, th, measure);
}

function modeReposition(doc: DesignDocument, tw: number, th: number, measure: MeasureFn): DesignDocument {
  const s = Math.min(tw / doc.width, th / doc.height);
  const layers = doc.layers.map((l) =>
    isFullBleed(l, doc.width, doc.height) ? setBounds(scaleStyle(l, s), R(0, 0, tw, th)) : placeAnchored(l, doc.width, doc.height, tw, th, s, measure),
  );
  const m = doc.grid.margins;
  return {
    ...doc,
    width: tw,
    height: th,
    layers,
    grid: scaleGrid(doc.grid, s, roundMargins({ top: m.top * s, right: m.right * s, bottom: m.bottom * s, left: m.left * s })),
    guides: mapGuides(doc.guides, (p) => (p / doc.width) * tw, (p) => (p / doc.height) * th, tw, th),
  };
}

// ── reflow ───────────────────────────────────────────────────────────────────

type Role = "background" | "hero" | "logo" | "text" | "rule" | "backer" | "decor";

function classify(doc: DesignDocument): Map<string, Role> {
  const W = doc.width;
  const H = doc.height;
  const area = W * H;
  const roles = new Map<string, Role>();
  const visible = doc.layers;
  for (const l of visible) if (isFullBleed(l, W, H)) roles.set(l.id, "background");
  const images = visible.filter((l) => l.type === "image" && !roles.has(l.id));
  for (const im of images) {
    const b = layerBounds(im);
    if (/logo/i.test(im.name) || b.width * b.height < area * 0.03) roles.set(im.id, "logo");
  }
  const hero = images.filter((l) => !roles.has(l.id)).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (hero && hero.width * hero.height >= area * 0.06) roles.set(hero.id, "hero");
  const texts = visible.filter(isText).filter((t) => !roles.has(t.id));
  for (const t of texts) roles.set(t.id, !t.rotation && !t.vertical && [...t.text.trim()].length > 2 ? "text" : "decor");
  // Shapes that sit behind stacked text act as backers (scrims, panels, labels).
  const stacked = texts.filter((t) => roles.get(t.id) === "text");
  // Thin horizontal rules near the text travel with the stack.
  const tu = unionBounds(stacked.map(layerBounds));
  for (const l of visible) {
    if (roles.has(l.id) || l.type !== "shape" || l.rotation || !tu) continue;
    const b = layerBounds(l);
    const thin = b.height <= Math.max(2, H * 0.008) && b.width >= W * 0.03;
    const near = b.y >= tu.y - H * 0.05 && bottom(b) <= bottom(tu) + H * 0.05 && b.x >= tu.x - W * 0.05 && right(b) <= right(tu) + W * 0.05;
    if (thin && near) roles.set(l.id, "rule");
  }
  for (const l of visible) {
    if (roles.has(l.id) || l.type !== "shape") continue;
    const b = layerBounds(l);
    const idx = visible.indexOf(l);
    const backs = stacked.some((t) => {
      const tb = layerBounds(t);
      const cx = tb.x + tb.width / 2;
      const cy = tb.y + tb.height / 2;
      return visible.indexOf(t) > idx && cx >= b.x && cx <= right(b) && cy >= b.y && cy <= bottom(b) && (l as ShapeLayer).fill;
    });
    roles.set(l.id, backs ? "backer" : "decor");
  }
  for (const l of visible) if (!roles.has(l.id)) roles.set(l.id, "decor");
  return roles;
}

function modeReflow(doc: DesignDocument, tw: number, th: number, measure: MeasureFn): DesignDocument {
  const W = doc.width;
  const H = doc.height;
  const sx = tw / W;
  const sy = th / H;
  const s = Math.min(sx, sy);
  const roles = classify(doc);
  const byId = new Map(doc.layers.map((l) => [l.id, l]));
  const out = new Map<string, Layer>();
  const srcMargin = (doc.grid.margins.left + doc.grid.margins.right + doc.grid.margins.top + doc.grid.margins.bottom) / 4;
  const m = Math.max(4, Math.round((srcMargin / Math.min(W, H)) * Math.min(tw, th)));
  const gap = Math.round(Math.min(tw, th) * 0.03);
  const content = R(m, m, tw - 2 * m, th - 2 * m);
  const tgtLand = tw > th * 1.1;

  const texts = doc.layers.filter((l): l is TextLayer => roles.get(l.id) === "text");
  const rules = doc.layers.filter((l) => roles.get(l.id) === "rule");
  const textUnion = unionBounds(texts.map(layerBounds));
  const heroSrc = doc.layers.find((l) => roles.get(l.id) === "hero");

  // 1. Hero / text regions on the new grid.
  let textBox = content;
  let panel: Rect | null = null;
  if (heroSrc) {
    const hb = layerBounds(heroSrc);
    const edges = [hb.x <= W * 0.01, hb.y <= H * 0.01, right(hb) >= W * 0.99, bottom(hb) >= H * 0.99].filter(Boolean).length;
    const bleed = edges >= 2;
    const tc = textUnion ? { x: textUnion.x + textUnion.width / 2, y: textUnion.y + textUnion.height / 2 } : { x: W, y: H };
    // Reading order along the source's dominant separation axis: left/top → first.
    const hx = hb.x + hb.width / 2;
    const hy = hb.y + hb.height / 2;
    const heroFirst = Math.abs(hx - tc.x) / W > Math.abs(hy - tc.y) / H ? hx <= tc.x : hy <= tc.y;
    let heroRect: Rect;
    if (tgtLand) {
      const half = bleed ? tw / 2 : (content.width - gap) / 2;
      heroRect = bleed ? R(heroFirst ? 0 : tw - half, 0, half, th) : R(heroFirst ? content.x : right(content) - half, content.y, half, content.height);
      panel = heroFirst ? R(right(heroRect), 0, tw - right(heroRect), th) : R(0, 0, heroRect.x, th);
      textBox = heroFirst ? R(right(heroRect) + (bleed ? m : gap), content.y, right(content) - right(heroRect) - (bleed ? m : gap), content.height) : R(content.x, content.y, heroRect.x - content.x - (bleed ? m : gap), content.height);
    } else {
      const share = clamp((hb.height / H) * (th / tw > 1.3 ? 1 : 0.9), 0.38, 0.6);
      const hh = bleed ? th * share : (content.height - gap) * share;
      heroRect = bleed ? R(0, heroFirst ? 0 : th - hh, tw, hh) : R(content.x, heroFirst ? content.y : bottom(content) - hh, content.width, hh);
      panel = heroFirst ? R(0, bottom(heroRect), tw, th - bottom(heroRect)) : R(0, 0, tw, heroRect.y);
      textBox = heroFirst ? R(content.x, bottom(heroRect) + (bleed ? m : gap), content.width, bottom(content) - bottom(heroRect) - (bleed ? m : gap)) : R(content.x, content.y, content.width, heroRect.y - content.y - (bleed ? m : gap));
    }
    out.set(heroSrc.id, setBounds(scaleStyle(heroSrc, Math.sqrt(sx * sy)), heroRect));
  }

  // 2. Text stack in reading order, one uniform scale k keeps the hierarchy.
  const ordered: Layer[] = [...texts, ...rules].sort((a, b) => {
    const A = layerBounds(a);
    const B = layerBounds(b);
    return Math.abs(A.y - B.y) > Math.min(A.height, B.height) * 0.5 ? A.y - B.y : A.x - B.x;
  });
  const srcGaps = ordered.map((t, i) => {
    if (!i) return 0;
    const prev = layerBounds(ordered[i - 1]);
    return Math.max(0, layerBounds(t).y - bottom(prev));
  });
  const uw = textUnion ? Math.max(1, textUnion.width) : W;
  const widthOf = (t: Layer) => textBox.width * clamp(layerBounds(t).width / uw, t.type === "text" ? 0.45 : 0.05, 1);
  const build = (k: number) => {
    const items: Layer[] = ordered.map((t) => {
      if (t.type !== "text") return { ...scaleStyle(t, k), width: Math.max(1, widthOf(t)), height: Math.max(1, t.height * k) };
      let n = scaleStyle(t, k);
      // Labels (text with a background) hug their content; blocks take the stack width.
      const w = t.backgroundColor ? Math.min(textBox.width, t.width * k) : widthOf(t);
      n = { ...n, width: Math.max(1, w), height: t.autoHeight ? t.height : t.height * k };
      return refitText(n, measure, undefined, textBox.width);
    });
    const minGap = Math.min(tw, th) * 0.008;
    const gaps = srcGaps.map((g, i) => (i ? Math.max(minGap, g * k) : 0));
    const total = items.reduce((a, n, i) => a + n.height + gaps[i], 0);
    const fits = items.every((n) => n.type !== "text" || textFitsWidth(n, measure));
    return { items, gaps, total, fits };
  };
  if (ordered.length) {
    const kMax = Math.max(s, Math.sqrt(sx * sy)) * 1.15;
    let lo = 0.05;
    let hi = kMax;
    let best = build(lo);
    const top = build(hi);
    if (top.total <= textBox.height && top.fits) best = top;
    else {
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        const r = build(mid);
        if (r.total <= textBox.height && r.fits) {
          lo = mid;
          best = r;
        } else hi = mid;
      }
    }
    const srcCy = textUnion ? (textUnion.y + textUnion.height / 2) / H : 0;
    const vAlign = heroSrc ? "top" : srcCy > 0.6 ? "bottom" : srcCy < 0.4 ? "top" : "center";
    let y = vAlign === "bottom" ? bottom(textBox) - best.total : vAlign === "center" ? textBox.y + (textBox.height - best.total) / 2 : textBox.y;
    y = Math.max(0, y);
    best.items.forEach((n, i) => {
      y += best.gaps[i];
      const align = n.type === "text" ? n.align : "left";
      const x = align === "right" ? right(textBox) - n.width : align === "center" ? textBox.x + (textBox.width - n.width) / 2 : textBox.x;
      out.set(n.id, clampToPage({ ...n, x, y }, tw, th, measure));
      y += n.height;
    });
  }

  // 3. Backers follow their text; large ones become the text panel.
  for (const l of doc.layers) {
    if (roles.get(l.id) !== "backer") continue;
    const b = layerBounds(l);
    const covered = texts.filter((t) => {
      const tb = layerBounds(t);
      const cx = tb.x + tb.width / 2;
      const cy = tb.y + tb.height / 2;
      return cx >= b.x && cx <= right(b) && cy >= b.y && cy <= bottom(b);
    });
    const placed = covered.map((t) => out.get(t.id)).filter((x): x is Layer => !!x);
    const u = unionBounds(placed.map(layerBounds));
    if (!u) {
      out.set(l.id, placeProportional(l, marginMapper(doc, tw, th), sx, sy, tw, th, measure));
      continue;
    }
    const tu = unionBounds(covered.map(layerBounds))!;
    const k = Math.sqrt(sx * sy);
    let r = R(u.x - (tu.x - b.x) * k, u.y - (tu.y - b.y) * k, u.width + ((tu.x - b.x) + (right(b) - right(tu))) * k, u.height + ((tu.y - b.y) + (bottom(b) - bottom(tu))) * k);
    if (panel && b.width * b.height > W * H * 0.2) r = panel;
    // Edge-bleeding backers keep bleeding.
    if (b.x <= 1) r = R(0, r.y, right(r), r.height);
    if (right(b) >= W - 1) r = R(r.x, r.y, tw - r.x, r.height);
    if (b.y <= 1) r = R(r.x, 0, r.width, bottom(r));
    if (bottom(b) >= H - 1) r = R(r.x, r.y, r.width, th - r.y);
    const x0 = clamp(r.x, 0, tw);
    const y0 = clamp(r.y, 0, th);
    r = R(x0, y0, clamp(right(r), x0 + 1, tw) - x0, clamp(bottom(r), y0 + 1, th) - y0);
    out.set(l.id, setBounds(scaleStyle(l, k), r));
  }

  // 4. Everything else: backgrounds stretch, logos anchor, decoration maps proportionally
  //    and steps aside when it would land on the re-flowed text.
  const map = marginMapper(doc, tw, th);
  const stackU = unionBounds(ordered.map((l) => out.get(l.id)).filter((x): x is Layer => !!x).map(layerBounds));
  const heroR = heroSrc && out.get(heroSrc.id) ? layerBounds(out.get(heroSrc.id)!) : null;
  const clear = (r: Rect) =>
    r.x >= 0 && r.y >= 0 && right(r) <= tw && bottom(r) <= th && (!stackU || intersectionArea(r, stackU) < 1) && (!heroR || intersectionArea(r, heroR) < r.width * r.height * 0.1);
  for (const l of doc.layers) {
    if (out.has(l.id)) continue;
    const role = roles.get(l.id);
    if (role === "background") out.set(l.id, setBounds(scaleStyle(l, Math.sqrt(sx * sy)), R(0, 0, tw, th)));
    else if (role === "logo") out.set(l.id, placeAnchored(l, W, H, tw, th, s, measure));
    else {
      let n = placeProportional(l, map, sx, sy, tw, th, measure);
      const nb = layerBounds(n);
      if (n.type !== "text" && stackU && intersectionArea(nb, stackU) > nb.width * nb.height * 0.15) {
        search: for (const f of [1, 0.75, 0.5]) {
          const w = nb.width * f;
          const h = nb.height * f;
          const xIn = clamp(nb.x, textBox.x, Math.max(textBox.x, right(textBox) - w));
          for (const r of [R(xIn, bottom(stackU) + gap, w, h), R(xIn, stackU.y - gap - h, w, h), R(right(stackU) + gap, clamp(nb.y, 0, th - h), w, h), R(stackU.x - gap - w, clamp(nb.y, 0, th - h), w, h)]) {
            if (clear(r)) {
              n = setBounds(scaleStyle(n, f), r);
              break search;
            }
          }
        }
      }
      out.set(l.id, n);
    }
  }

  return {
    ...doc,
    width: tw,
    height: th,
    layers: doc.layers.map((l) => out.get(l.id) ?? byId.get(l.id)!),
    grid: scaleGrid(doc.grid, s, { top: m, right: m, bottom: m, left: m }),
    guides: mapGuides(doc.guides, (p) => (p / W) * tw, (p) => (p / H) * th, tw, th),
  };
}

/** Adapt `doc` to tw × th with the chosen strategy. Returns a new document. */
export function smartResize(doc: DesignDocument, targetW: number, targetH: number, mode: ResizeMode, measure: MeasureFn = approxMeasure): DesignDocument {
  const src = structuredClone(doc);
  const tw = Math.max(16, Math.round(targetW));
  const th = Math.max(16, Math.round(targetH));
  if (tw === src.width && th === src.height) return src;
  switch (mode) {
    case "scale":
      return modeScale(src, tw, th, measure);
    case "preserve-type":
      return modePreserveType(src, tw, th, measure);
    case "reflow":
      return modeReflow(src, tw, th, measure);
    case "reposition":
      return modeReposition(src, tw, th, measure);
  }
}
