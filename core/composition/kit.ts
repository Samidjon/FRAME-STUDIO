import type { GridSettings, GridType, Rect } from "@/types/canvas";
import type { BlendMode, ColorRole, ImageLayer, Layer, MaskShape, ShapeKind, ShapeLayer, TextAlign, TextLayer, TextRole, TextureLayer } from "@/types/layer";
import { createImageLayer, createShapeLayer, createTextLayer, createTextureLayer, defaultEffects, defaultGrid } from "@/core/document/factory";
import { computeGrid, type GridGeometry } from "@/core/geometry/grid";
import { layerBounds } from "@/core/geometry/transform";
import type { Rng } from "@/core/geometry/random";
import { fitFontSize, layoutText, type MeasureFn } from "@/core/text/layout";
import { contrastRatio, luminance, mix, parseColor, toHex } from "@/core/rendering/color";
import { BUILTIN_IMAGES } from "@/core/rendering/builtin-images";
import type { AlgorithmId, AssetRef, GeneratorInput } from "./types";
import { getGenStyle, resolvePalette, type GenPalette, type GenStyle } from "./styles";

/**
 * Construction kit shared by every composition algorithm: grid creation,
 * fitted text blocks, contrast-aware colour choice, images, logos, rules.
 * Pure TypeScript — measurement is injected.
 */

/** Absolute floor for generated type, in document px. */
export const MIN_TEXT_PX = 6;

export type Orientation = "portrait" | "landscape" | "square";

export interface Ctx {
  input: GeneratorInput;
  algorithm: AlgorithmId;
  variant: number;
  W: number;
  H: number;
  /** Short side. */
  unit: number;
  orientation: Orientation;
  rng: Rng;
  style: GenStyle;
  pal: GenPalette;
  measure: MeasureFn;
  image: AssetRef;
  /** Approximate average colour of the hero image (after style effects). */
  imageTone: string;
  /** User images have unknown content — scrims are mandatory. */
  imageIsUser: boolean;
  logo: AssetRef | null;
  title: string;
  subtitle: string;
  body: string;
  meta: string[];
  density: number;
  asymmetry: number;
  layers: Layer[];
  /** Text layers that may overlap others on purpose. */
  overlap: Set<string>;
  seq: number;
}

/** Result of an algorithm: layers live on ctx; this carries the page setup. */
export interface Comp {
  grid: GridSettings;
  background: string;
}

const STYLE_BUILTIN: Record<string, string> = {
  swiss: "concrete",
  brutalist: "concrete",
  minimal: "horizon",
  experimental: "bloom",
  japanese: "horizon",
  modernist: "fold",
  bauhaus: "orbit",
  "retro-futurism": "neon",
  monochrome: "ridges",
  acid: "chrome",
};

function averageColor(colors: string[]): string {
  if (!colors.length) return "#6B6B6B";
  const acc = colors.map(parseColor).reduce((a, c) => ({ r: a.r + c.r, g: a.g + c.g, b: a.b + c.b, a: 1 }), { r: 0, g: 0, b: 0, a: 1 });
  return toHex({ r: acc.r / colors.length, g: acc.g / colors.length, b: acc.b / colors.length, a: 1 });
}

export function fallbackImage(styleId: string): AssetRef {
  const id = STYLE_BUILTIN[styleId] ?? "dune";
  const def = BUILTIN_IMAGES.find((b) => b.id === id) ?? BUILTIN_IMAGES[0];
  return { assetId: `builtin:${def.id}`, width: def.width, height: def.height };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function createCtx(input: GeneratorInput, algorithm: AlgorithmId, variant: number, rng: Rng, measure: MeasureFn): Ctx {
  const W = Math.max(16, Math.round(input.format.width));
  const H = Math.max(16, Math.round(input.format.height));
  const style = getGenStyle(input.style);
  const pal = resolvePalette(style, input.palette, rng);
  const image = input.image ?? fallbackImage(style.id);
  const builtin = image.assetId.startsWith("builtin:") ? BUILTIN_IMAGES.find((b) => `builtin:${b.id}` === image.assetId) : undefined;
  let tone = builtin ? averageColor(builtin.palette) : "#6B6B6B";
  const fx = style.effects(pal);
  if (fx.grayscale) {
    const l = Math.round(Math.sqrt(luminance(tone)) * 255);
    tone = toHex({ r: l, g: l, b: l, a: 1 });
  }
  if (fx.duotone?.enabled) tone = mix(fx.duotone.shadow, fx.duotone.highlight, Math.min(1, Math.sqrt(luminance(tone)) * 1.2));
  const ratio = W / H;
  const no = (input.seed % 97) + 1;
  return {
    input,
    algorithm,
    variant,
    W,
    H,
    unit: Math.min(W, H),
    orientation: ratio > 1.08 ? "landscape" : ratio < 0.92 ? "portrait" : "square",
    rng,
    style,
    pal,
    measure,
    image,
    imageTone: tone,
    imageIsUser: !builtin,
    logo: input.logo,
    title: input.title.trim() || "Visual Language",
    subtitle: input.subtitle.trim(),
    body: input.body.trim(),
    meta: [`No. ${pad2(no)}`, `${style.name} Series`, `${W} × ${H}`, `Edition ${String.fromCharCode(65 + (input.seed % 26))}`],
    density: Math.max(0, Math.min(1, input.density)),
    asymmetry: Math.max(0, Math.min(1, input.asymmetry)),
    layers: [],
    overlap: new Set(),
    seq: 0,
  };
}

export function nid(c: Ctx, prefix: string) {
  c.seq += 1;
  return `${prefix}_${c.algorithm.replace(/-/g, "")}${c.variant}_${pad2(c.seq)}`;
}

/** Type scale for the page: maxima, the fitter shrinks as needed. */
export function sizes(c: Ctx) {
  const u = c.unit;
  const d = c.density;
  return {
    display: Math.max(c.W, c.H) * 0.3,
    heading: u * (0.06 - d * 0.012),
    sub: u * (0.044 - d * 0.008),
    body: u * (0.027 - d * 0.004),
    meta: Math.max(MIN_TEXT_PX, u * 0.0155),
    minDisplay: Math.max(MIN_TEXT_PX, u * 0.04),
    minSub: Math.max(MIN_TEXT_PX, u * 0.02),
    minBody: Math.max(MIN_TEXT_PX, u * 0.013),
    minMeta: Math.max(MIN_TEXT_PX, u * 0.0105),
    hair: Math.max(1, Math.round(u * 0.0018)),
    gap: Math.round(u * 0.02),
  };
}

export interface GridOpts {
  type: GridType;
  columns: number;
  rows: number;
  /** Multiplier of the style margin. */
  margin?: number;
  margins?: { top: number; right: number; bottom: number; left: number };
  gutter?: number;
  columnRatios?: number[];
  rowRatios?: number[];
}

export function marginPx(c: Ctx, mult = 1) {
  return Math.max(4, Math.round(c.unit * c.style.margin * (1.2 - 0.4 * c.density) * mult));
}

export function makeGrid(c: Ctx, o: GridOpts): { settings: GridSettings; geo: GridGeometry } {
  const m = marginPx(c, o.margin ?? 1);
  const base = defaultGrid(c.W, c.H);
  const settings: GridSettings = {
    ...base,
    type: o.type,
    visible: false,
    columns: o.columns,
    rows: o.rows,
    gutter: o.gutter ?? Math.max(2, Math.round(c.unit * 0.022 * (1.1 - 0.4 * c.density))),
    margins: o.margins ?? { top: m, right: m, bottom: m, left: m },
    baseline: Math.max(4, Math.round(c.unit / 90)),
    columnRatios: o.columnRatios ?? base.columnRatios,
    rowRatios: o.rowRatios ?? base.rowRatios,
  };
  return { settings, geo: computeGrid(c.W, c.H, settings) };
}

// ── colour ──────────────────────────────────────────────────────────────────

export interface Paint {
  color: string;
  role: ColorRole;
}

const ROLES = ["ink", "paper", "background", "accent", "muted"] as const;

export function paint(c: Ctx, role: (typeof ROLES)[number]): Paint {
  return { color: c.pal[role], role };
}

/** Most readable palette colour on `bg`, preferring the given roles in order. */
export function inkOn(c: Ctx, bg: string, prefer: (typeof ROLES)[number][] = ["ink", "paper", "background"], min = 4.5): Paint {
  for (const r of prefer) if (contrastRatio(bg, c.pal[r]) >= min) return paint(c, r);
  const best = ROLES.map((r) => paint(c, r)).reduce((a, b) => (contrastRatio(bg, b.color) > contrastRatio(bg, a.color) ? b : a));
  if (contrastRatio(bg, best.color) >= 3) return best;
  return { color: contrastRatio(bg, "#111111") > contrastRatio(bg, "#FFFFFF") ? "#111111" : "#FFFFFF", role: "none" };
}

/** Accent when it reads on `bg` (≥ 3:1, large type), otherwise the best ink. */
export function accentOn(c: Ctx, bg: string): Paint {
  return contrastRatio(bg, c.pal.accent) >= 3 ? paint(c, "accent") : inkOn(c, bg);
}

/** Colour of a scrim (the darker of ink / background) and the effective tone after compositing. */
export function scrimFor(c: Ctx, opacityHint?: number): { paint: Paint; opacity: number; effective: string } {
  const dark = luminance(c.pal.ink) < luminance(c.pal.background) ? paint(c, "ink") : paint(c, "background");
  const light = dark.role === "ink" ? paint(c, "background") : paint(c, "ink");
  const toneLum = luminance(c.imageTone);
  // Light images get a light scrim, dark images a dark one: less muddy.
  const useLight = !c.imageIsUser && toneLum > 0.45;
  const p = useLight ? light : dark;
  const opacity = opacityHint ?? (c.imageIsUser ? 0.62 : useLight ? 0.5 : toneLum < 0.08 ? 0.35 : 0.55);
  // Unknown user images: assume the worst case for contrast (mid grey).
  const assumed = c.imageIsUser ? "#8A8A8A" : c.imageTone;
  return { paint: p, opacity, effective: mix(assumed, p.color, opacity) };
}

// ── layers ──────────────────────────────────────────────────────────────────

export interface ShapeOpts {
  name?: string;
  opacity?: number;
  shape?: ShapeKind;
  blend?: BlendMode;
  stroke?: Paint & { width: number };
  noFill?: boolean;
  cornerRadius?: number;
  rotation?: number;
}

export function addRect(c: Ctx, r: Rect, fill: Paint, o: ShapeOpts = {}): ShapeLayer {
  const s = createShapeLayer(o.shape ?? "rect", {
    id: nid(c, "shp"),
    name: o.name ?? "Block",
    x: r.x,
    y: r.y,
    width: Math.max(1, r.width),
    height: Math.max(1, r.height),
    fill: o.noFill ? null : fill.color,
    fillRole: o.noFill ? "none" : fill.role,
    stroke: o.stroke ? o.stroke.color : null,
    strokeRole: o.stroke ? o.stroke.role : "none",
    strokeWidth: o.stroke ? o.stroke.width : 0,
    opacity: o.opacity ?? 1,
    blendMode: o.blend ?? "normal",
    cornerRadius: o.cornerRadius ?? 0,
    rotation: o.rotation ?? 0,
  });
  c.layers.push(s);
  return s;
}

export function addRule(c: Ctx, x: number, y: number, w: number, p: Paint, thickness?: number, name = "Rule"): ShapeLayer {
  const t = thickness ?? sizes(c).hair;
  return addRect(c, { x, y: Math.round(y), width: w, height: t }, p, { name });
}

export interface ImageOpts {
  name?: string;
  mask?: MaskShape;
  opacity?: number;
  blend?: BlendMode;
  /** Apply the style's image treatment (default true). */
  effects?: boolean;
}

export function addImage(c: Ctx, r: Rect, o: ImageOpts = {}): ImageLayer {
  const fx = o.effects === false ? {} : c.style.effects(c.pal);
  const img = createImageLayer(c.image.assetId, {
    id: nid(c, "img"),
    name: o.name ?? "Image",
    x: r.x,
    y: r.y,
    width: Math.max(1, r.width),
    height: Math.max(1, r.height),
    mask: o.mask ?? "none",
    opacity: o.opacity ?? 1,
    blendMode: o.blend ?? "normal",
    effects: { ...defaultEffects(), ...fx },
  });
  c.layers.push(img);
  return img;
}

/** Contain-fit the logo into `box`. Named "Logo" so validation can find it. */
export function addLogo(c: Ctx, box: Rect, align: "left" | "center" | "right" = "left", vAlign: "top" | "center" | "bottom" = "top"): Rect | null {
  if (!c.logo || box.width < 4 || box.height < 4) return null;
  const s = Math.min(box.width / Math.max(1, c.logo.width), box.height / Math.max(1, c.logo.height));
  const w = c.logo.width * s;
  const h = c.logo.height * s;
  const x = align === "left" ? box.x : align === "right" ? box.x + box.width - w : box.x + (box.width - w) / 2;
  const y = vAlign === "top" ? box.y : vAlign === "bottom" ? box.y + box.height - h : box.y + (box.height - h) / 2;
  const img = createImageLayer(c.logo.assetId, { id: nid(c, "logo"), name: "Logo", x, y, width: w, height: h });
  c.layers.push(img);
  return { x, y, width: w, height: h };
}

export function addTexture(c: Ctx, chanceOf = 0.6) {
  if (!c.style.texture || c.rng() > chanceOf) return null;
  const dark = luminance(c.pal.background) < 0.2;
  const t: TextureLayer = createTextureLayer(c.style.texture, c.W, c.H, {
    id: nid(c, "tex"),
    name: "Texture",
    color: dark ? c.pal.ink : "#171717",
    opacity: 0.08 + c.rng() * 0.1,
    blendMode: dark ? "screen" : "multiply",
    seed: Math.floor(c.rng() * 1e6),
    scale: Math.max(0.5, c.unit / 1080),
  });
  c.layers.push(t);
  return t;
}

// ── text ────────────────────────────────────────────────────────────────────

export type FontKind = "display" | "heading" | "body" | "mono";

export interface TextSpec {
  name: string;
  text: string;
  role: TextRole;
  kind: FontKind;
  box: Rect;
  maxSize: number;
  minSize?: number;
  align?: TextAlign;
  vAlign?: "top" | "center" | "bottom";
  uppercase?: boolean;
  lineHeight?: number;
  tracking?: number;
  weight?: number;
  /** Colour beneath the text, used to pick a readable fill. */
  under: string;
  fill?: Paint;
  /** Label chip: text gets a solid background. */
  chip?: Paint & { padding: number };
  /** Shrink the box width to the text (labels, metadata). */
  hug?: boolean;
  rotation?: 0 | -90 | 90;
  intentional?: boolean;
  opacity?: number;
  /** Allow ellipsis truncation when even the minimum size does not fit. */
  truncate?: boolean;
}

function kindProps(c: Ctx, s: TextSpec) {
  const st = c.style;
  const fam = st.fonts[s.kind];
  const weight = s.weight ?? st.weights[s.kind];
  const defaults: Record<FontKind, { lh: number; tr: number; up: boolean }> = {
    display: { lh: st.displayLineHeight, tr: st.tracking, up: st.uppercase },
    heading: { lh: 1.1, tr: -10, up: false },
    body: { lh: 1.4, tr: 0, up: false },
    mono: { lh: 1.3, tr: 60, up: true },
  };
  const d = defaults[s.kind];
  return { fontFamily: fam, fontWeight: weight, lineHeight: s.lineHeight ?? d.lh, letterSpacing: s.tracking ?? d.tr, uppercase: s.uppercase ?? d.up };
}

/** Does `layer` lay out within width × maxH with no broken words? */
export function textFits(layer: TextLayer, width: number, maxH: number, measure: MeasureFn) {
  const l = layoutText({ ...layer, width, autoHeight: true }, measure);
  const inner = width - (layer.backgroundPadding || 0) * 2;
  return !l.overflow && l.height <= maxH + 0.5 && l.lines.every((ln) => ln.width <= inner + 0.5);
}

/**
 * Create a text layer fitted into `box` (largest size ≤ maxSize that fits).
 * Returns null for empty text or an impossible box.
 */
export function fitText(c: Ctx, s: TextSpec): TextLayer | null {
  const text = s.text.trim();
  if (!text) return null;
  const rot = s.rotation ?? 0;
  const bw = rot ? s.box.height : s.box.width;
  const bh = rot ? s.box.width : s.box.height;
  if (bw < 4 || bh < 2) return null;
  const pad = s.chip?.padding ?? 0;
  const kp = kindProps(c, s);
  const fill = s.fill ?? inkOn(c, s.chip?.color ?? s.under);
  let layer = createTextLayer(
    {
      id: nid(c, "txt"),
      name: s.name,
      role: s.role,
      text,
      ...kp,
      align: s.align ?? "left",
      fill: fill.color,
      fillRole: fill.role,
      backgroundColor: s.chip ? s.chip.color : null,
      backgroundPadding: pad,
      rotation: rot,
      opacity: s.opacity ?? 1,
      width: bw,
      fontSize: s.maxSize,
      autoHeight: true,
    },
    c.W,
  );
  const min = Math.max(MIN_TEXT_PX, Math.min(s.minSize ?? MIN_TEXT_PX, s.maxSize));
  const fitAt = (t: string, lo: number) => {
    const probe = { ...layer, text: t };
    const size = fitFontSize(probe, { width: bw, height: bh }, c.measure, s.maxSize, lo);
    let f = size;
    while (f > lo && !textFits({ ...probe, fontSize: f }, bw, bh, c.measure)) f = Math.max(lo, f - Math.max(0.5, f * 0.04));
    return textFits({ ...probe, fontSize: f }, bw, bh, c.measure) ? f : null;
  };
  let size = fitAt(text, min);
  let finalText = text;
  if (size === null && s.truncate !== false) {
    const words = text.split(/\s+/);
    while (words.length > 1 && size === null) {
      words.pop();
      finalText = words.join(" ").replace(/[,.;:—-]+$/, "") + "…";
      size = fitAt(finalText, min);
    }
  }
  if (size === null) {
    finalText = text;
    size = fitAt(text, MIN_TEXT_PX);
  }
  if (size === null) return null;
  size = Math.floor(size * 10) / 10;
  layer = { ...layer, text: finalText, fontSize: size };
  const lay = layoutText({ ...layer, width: bw, autoHeight: true }, c.measure);
  const h = Math.ceil(lay.height * 100) / 100;
  let w = bw;
  if (s.hug && !rot) {
    const natural = Math.max(...lay.lines.map((l) => l.width), 1);
    w = Math.min(bw, Math.ceil(natural + pad * 2 + 2));
    if (!textFits({ ...layer, width: w }, w, h + 0.5, c.measure)) w = bw;
  }
  const box = s.box;
  const align = s.align ?? "left";
  const vAlign = s.vAlign ?? "top";
  let x = box.x;
  let y = box.y;
  if (!rot) {
    if (w < box.width) x = align === "right" ? box.x + box.width - w : align === "center" ? box.x + (box.width - w) / 2 : box.x;
    y = vAlign === "top" ? box.y : vAlign === "bottom" ? box.y + box.height - h : box.y + (box.height - h) / 2;
  } else {
    // Rotated: the box's long side carries the line; vAlign positions the thickness across the box width.
    const across = vAlign === "top" ? 0 : vAlign === "bottom" ? box.width - h : (box.width - h) / 2;
    if (rot === -90) {
      x = box.x + across;
      y = box.y + box.height;
    } else {
      x = box.x + across + h;
      y = box.y;
    }
  }
  layer = { ...layer, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, width: w, height: h };
  c.layers.push(layer);
  if (s.intentional) c.overlap.add(layer.id);
  return layer;
}

export interface StackItem extends Omit<TextSpec, "box" | "vAlign"> {
  share: number;
}

/**
 * Stack text blocks top-to-bottom inside `box`. Each item receives a share of
 * the height, is fitted, and the stack is then aligned as a whole.
 */
export function textStack(c: Ctx, box: Rect, items: StackItem[], opts: { vAlign?: "top" | "center" | "bottom"; gap?: number } = {}): TextLayer[] {
  const live = items.filter((i) => i.text.trim());
  if (!live.length) return [];
  const gap = opts.gap ?? sizes(c).gap;
  const total = live.reduce((a, i) => a + i.share, 0);
  const avail = Math.max(1, box.height - gap * (live.length - 1));
  const placed: TextLayer[] = [];
  for (const it of live) {
    const h = (avail * it.share) / total;
    const before = c.layers.length;
    const l = fitText(c, { ...it, box: { x: box.x, y: box.y, width: box.width, height: h }, vAlign: "top" });
    if (l) placed.push(l);
    else c.layers.length = before;
  }
  const stackH = placed.reduce((a, l) => a + l.height, 0) + gap * Math.max(0, placed.length - 1);
  let y = opts.vAlign === "bottom" ? box.y + box.height - stackH : opts.vAlign === "center" ? box.y + (box.height - stackH) / 2 : box.y;
  for (const l of placed) {
    l.y = Math.round(y * 100) / 100;
    y += l.height + gap;
  }
  return placed;
}

/** A row of metadata labels spread across `box` (first left, last right). */
export function metaRow(c: Ctx, box: Rect, items: string[], under: string, fill?: Paint): TextLayer[] {
  const S = sizes(c);
  const n = items.length;
  if (!n) return [];
  const seg = box.width / n;
  const out: TextLayer[] = [];
  items.forEach((t, i) => {
    const align: TextAlign = n === 1 ? "left" : i === 0 ? "left" : i === n - 1 ? "right" : "left";
    const l = fitText(c, {
      name: `Meta ${i + 1}`,
      text: t,
      role: "metadata",
      kind: "mono",
      box: { x: box.x + seg * i, y: box.y, width: seg - (i < n - 1 ? S.gap * 0.5 : 0), height: box.height },
      maxSize: S.meta,
      minSize: S.minMeta,
      align,
      vAlign: "center",
      under,
      fill,
      hug: true,
    });
    if (l) out.push(l);
  });
  return out;
}

/**
 * Mirror the composition horizontally (structural variant). Boxes move, but
 * text keeps its alignment so reading edges stay flush-left.
 */
export function mirrorLayers(layers: Layer[], W: number): Layer[] {
  return layers.map((l) => {
    const b = layerBounds(l);
    const nx = W - b.x - b.width;
    return { ...l, x: l.x + (nx - b.x) };
  });
}

export const rectBottom = (r: Rect) => r.y + r.height;
export const rectRight = (r: Rect) => r.x + r.width;
export function inset(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, width: Math.max(1, r.width - 2 * d), height: Math.max(1, r.height - 2 * d) };
}
