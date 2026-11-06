import type { Rect } from "@/types/canvas";
import type { Layer, ShapeLayer, TextLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import { createImageLayer, createShapeLayer } from "@/core/document/factory";
import { intersectionArea, layerBounds } from "@/core/geometry/transform";
import { contrastRatio, mix } from "@/core/rendering/color";
import { kitMeasure } from "@/core/templates/kit";
import { layoutText, type MeasureFn } from "@/core/text/layout";
import { LOCKUP_PATH, LOCKUP_VIEWBOX, SYMBOL_PATH, SYMBOL_VIEWBOX } from "./logo-paths";

/**
 * Company branding for every example design. The name replaces the main title
 * as ordinary editable text. The symbol replaces a graphic form as one vector
 * layer flagged `brandLocked`: users can move and scale it, but the editor
 * store keeps it on the page (see sanitizeBrand).
 */

export const SENITUKANG = {
  name: "Senitukang",
  url: "https://senitukang.com",
  ink: "#171717",
  paper: "#F0EDE5",
  symbol: { path: SYMBOL_PATH, viewBox: SYMBOL_VIEWBOX },
  lockup: { path: LOCKUP_PATH, viewBox: LOCKUP_VIEWBOX },
} as const;

export type LogoVariant = "symbol" | "lockup";
export type LogoSource =
  | { type: "vector"; variant: LogoVariant }
  | { type: "image"; assetId: string; width: number; height: number; name?: string };

const ASPECT = SENITUKANG.symbol.viewBox.width / SENITUKANG.symbol.viewBox.height;

/** Logo width limits on a design, relative to the page's short side. */
const LOGO_MAX = 0.3;
const LOGO_MIN = 0.13;
/** Smallest width a user can scale the logo down to. */
const MIN_WIDTH = 0.08;
/** Below this contrast against a flat page the logo would effectively vanish. */
const MIN_CONTRAST = 1.6;

export const isBrandLayer = (l: Layer) => l.brandLocked === true;

/** Real occupied area of a layer: text boxes are re-measured instead of trusting a stale height. */
function occupied(l: Layer, measure: MeasureFn): Rect {
  if (l.type !== "text") return layerBounds(l);
  const lay = layoutText(l, measure);
  // Tight display leading lets glyphs overshoot the line box, so allow for it.
  const overshoot = l.fontSize * Math.max(0.04, 0.5 - l.lineHeight / 2 + 0.04);
  return layerBounds({ ...l, y: l.y - overshoot, width: lay.width, height: lay.height + overshoot * 2 });
}

const visibleText = (doc: DesignDocument, measure: MeasureFn) =>
  doc.layers.filter((l) => l.type === "text" && l.visible && l.opacity > 0.05).map((l) => occupied(l, measure));

const hitsText = (r: Rect, text: Rect[]) => text.reduce((sum, t) => sum + intersectionArea(r, t), 0);

const inflate = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, width: r.width + p * 2, height: r.height + p * 2 });

/* ---------------------------------------------------------------- the name */

const CJK = /[　-ヿ㐀-鿿＀-￯]/;

/** The headline: the largest horizontal Latin text, preferring real titles over numerals, glyphs, kanji or small print. */
function findTitle(doc: DesignDocument): TextLayer | null {
  const lines = doc.layers.filter(
    (l): l is TextLayer => l.type === "text" && l.visible && !l.vertical && !CJK.test(l.text) && (l.text.match(/\p{L}/gu) ?? []).length >= 3,
  );
  const largest = (ls: TextLayer[]) => ls.reduce<TextLayer | null>((best, l) => (!best || l.fontSize > best.fontSize ? l : best), null);
  return largest(lines.filter((l) => l.role === "display" || l.role === "heading")) ?? largest(lines.filter((l) => l.role !== "metadata")) ?? largest(lines);
}

/** Extended display faces, far wider than the shared width estimate assumes. */
const WIDE_FACES = new Set(["Unbounded", "Syne", "Archivo Black", "Rubik Mono One", "Major Mono Display", "Space Mono"]);

/** Set the company name in the title's own style, scaled to fill the title's box on one line. */
function nameInTitle(title: TextLayer, doc: DesignDocument, measure: MeasureFn): TextLayer {
  const text = SENITUKANG.name;
  const naturalAt = (fontSize: number) => layoutText({ ...title, text, fontSize, width: 1e6, autoHeight: true }, measure).lines[0].width;
  const oldHeight = layoutText(title, measure).height;
  // Estimates run narrow for heavy or capital settings, so leave room: the name must never break.
  const safety = WIDE_FACES.has(title.fontFamily) ? 0.62 : title.uppercase || title.fontWeight >= 800 ? 0.84 : 0.94;
  const widthFit = (title.fontSize * title.width * safety) / Math.max(1, naturalAt(title.fontSize));
  const fontSize = Math.max(6, Math.floor(Math.min(widthFit, title.fontSize * 1.6, oldHeight / title.lineHeight)));
  const height = fontSize * title.lineHeight;
  // Keep the line where the title block ended, so spacing to the copy below holds.
  const y = title.rotation ? title.y : title.y + Math.max(0, oldHeight - height);
  const room = title.align === "left" && !title.rotation ? Math.max(title.width, doc.width - title.x) : title.width;
  return { ...title, text, name: "Senitukang name", fontSize, height, y, width: room };
}

/* ---------------------------------------------------------------- the logo */

const LIGHT_IMAGES = new Set(["builtin:horizon", "builtin:concrete", "builtin:fold", "builtin:ridges"]);

/** Rough tone of an image layer, which can't be sampled in pure code. */
function imageTone(l: Extract<Layer, { type: "image" }>): string {
  const e = l.effects;
  if (e.halftone.enabled) return e.halftone.color;
  if (e.duotone.enabled) return mix(e.duotone.shadow, e.duotone.highlight, 0.5);
  return LIGHT_IMAGES.has(l.assetId) ? "#B8B4AC" : "#2A2A2A";
}

/** Colours a rect visibly sits on: anything covering a meaningful part of it. */
function surfacesUnder(doc: DesignDocument, r: Rect, skip?: Layer): string[] {
  const out = [doc.background.transparent ? "#FFFFFF" : doc.background.color];
  const area = r.width * r.height;
  for (const l of doc.layers) {
    if (l === skip || !l.visible || l.opacity < 0.5 || l.type === "text" || l.type === "texture") continue;
    if (l.type === "shape" && (!l.fill || l.shape === "line")) continue; // outlines don't change what's underneath
    const covered = intersectionArea(layerBounds(l), r) / area;
    if (covered < 0.12) continue;
    if (covered > 0.9) out.length = 0; // fully hides whatever is below
    if (l.type === "image") out.push(imageTone(l));
    else if (l.fill) out.push(l.fill);
  }
  return out.length ? out : ["#FFFFFF"];
}

const worstContrast = (color: string, surfaces: string[]) => Math.min(...surfaces.map((c) => contrastRatio(color, c)));

const contrastPick = (surfaces: string[]) =>
  worstContrast(SENITUKANG.ink, surfaces) >= worstContrast(SENITUKANG.paper, surfaces) ? SENITUKANG.ink : SENITUKANG.paper;

/** A compact graphic form the logo can stand in for: rounder forms first, then the largest. */
function findLogoShape(doc: DesignDocument, text: Rect[]): ShapeLayer | null {
  const page = doc.width * doc.height;
  let best: ShapeLayer | null = null;
  let bestScore = 0;
  for (const l of doc.layers) {
    if (l.type !== "shape" || !l.visible || !l.fill || l.opacity < 0.5 || l.shape === "line" || l.shape === "path") continue;
    const b = layerBounds(l);
    const area = b.width * b.height;
    const aspect = b.width / Math.max(1, b.height);
    if (area < page * 0.002 || area > page * 0.7 || aspect < 0.55 || aspect > 1.8) continue;
    if (hitsText(b, text) > area * 0.12) continue; // a panel behind copy, not a graphic
    const score = area * (l.shape === "rect" ? 1 : 8);
    if (score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

const logoRect = (cx: number, cy: number, width: number): Rect => ({ x: cx - width / 2, y: cy - width / ASPECT / 2, width, height: width / ASPECT });

const insidePage = (r: Rect, doc: DesignDocument, inset: number) =>
  r.x >= inset && r.y >= inset && r.x + r.width <= doc.width - inset && r.y + r.height <= doc.height - inset;

/** Text-free spot nearest the main image (or the page centre), at a moderate size. */
function findFreeSpot(doc: DesignDocument, text: Rect[], short: number): Rect | null {
  const inset = short * 0.05;
  const pad = short * 0.02;
  const images = doc.layers.filter((l) => l.type === "image" && l.visible).map(layerBounds);
  const focus = [...images].sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? { x: 0, y: 0, width: doc.width, height: doc.height };
  const fx = Math.max(0, focus.x) + Math.min(focus.width, doc.width) / 2;
  const fy = Math.max(0, focus.y) + Math.min(focus.height, doc.height) / 2;
  const surfaces = [
    ...images,
    ...doc.layers.filter((l) => l.type === "shape" && l.visible && !!l.fill && l.shape !== "line" && l.width * l.height > doc.width * doc.height * 0.02).map(layerBounds),
  ];
  for (const s of [LOGO_MAX, 0.26, 0.22, 0.18, 0.15, LOGO_MIN, 0.1]) {
    const width = short * s;
    const height = width / ASPECT;
    let best: Rect | null = null;
    let bestD = Infinity;
    for (let i = 0; i <= 28; i++)
      for (let j = 0; j <= 28; j++) {
        const x = inset + ((doc.width - inset * 2 - width) * i) / 28;
        const y = inset + ((doc.height - inset * 2 - height) * j) / 28;
        const r = { x, y, width, height };
        if (hitsText(inflate(r, pad), text) > 0) continue;
        // Prefer sitting wholly on or off an image or panel: straddling an edge hurts legibility.
        const straddles = surfaces.some((b) => {
          const c = intersectionArea(b, r) / (width * height);
          return c > 0.03 && c < 0.97;
        });
        const d = Math.hypot(x + width / 2 - fx, y + height / 2 - fy) + (straddles ? short : 0);
        if (d < bestD) {
          best = r;
          bestD = d;
        }
      }
    if (best) return best;
  }
  return null;
}

function logoLayer(r: Rect, fill: string, fillRole: ShapeLayer["fillRole"], variant: LogoVariant = "symbol"): ShapeLayer {
  return createShapeLayer("path", {
    name: "Senitukang logo",
    brandLocked: true,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    pathData: SENITUKANG[variant].path,
    pathViewBox: SENITUKANG[variant].viewBox,
    fill,
    fillRole,
    stroke: null,
    strokeRole: "none",
  });
}

/**
 * Return a copy of the document carrying the brand as two separate elements:
 * the name in place of the main title, the logo in place of a graphic form
 * (or, when there is none, in the clearest area).
 */
export function withSenitukangBrand(doc: DesignDocument, measure: MeasureFn = kitMeasure, opts: { keepTitle?: boolean } = {}): DesignDocument {
  if (doc.layers.some(isBrandLayer)) return doc;
  const short = Math.min(doc.width, doc.height);

  const title = opts.keepTitle ? null : findTitle(doc);
  const named: DesignDocument = title ? { ...doc, layers: doc.layers.map((l) => (l === title ? nameInTitle(title, doc, measure) : l)) } : doc;
  const text = visibleText(named, measure);
  const pad = short * 0.02;
  const inset = short * 0.02;

  const form = findLogoShape(named, text);
  if (form) {
    const b = layerBounds(form);
    const target = Math.min(short * LOGO_MAX, Math.max(short * LOGO_MIN, Math.min(b.width, b.height * ASPECT)));
    for (const k of [1, 0.88, 0.76, 0.66]) {
      const r = logoRect(b.x + b.width / 2, b.y + b.height / 2, target * k);
      if (!insidePage(r, named, inset) || hitsText(inflate(r, pad), text) > 0) continue;
      const under = surfacesUnder(named, r, form);
      const keep = worstContrast(form.fill!, under) >= 2.2;
      return {
        ...named,
        layers: [...named.layers.filter((l) => l !== form), logoLayer(r, keep ? form.fill! : contrastPick(under), keep ? form.fillRole : "none")],
      };
    }
  }

  const r = findFreeSpot(named, text, short) ?? logoRect(short * 0.12, short * 0.12, short * LOGO_MIN);
  const under = surfacesUnder(named, r);
  const flatPage = !named.background.transparent && under.length === 1 && under[0] === named.background.color;
  const fill = contrastPick(under);
  return { ...named, layers: [...named.layers, logoLayer(r, fill, flatPage ? (fill === SENITUKANG.ink ? "ink" : "paper") : "none")] };
}

/**
 * Swap the design's logo, keeping its position and visual weight. The result
 * stays protected, whichever version or uploaded file is chosen.
 */
export function replaceBrandLogo(doc: DesignDocument, source: LogoSource): DesignDocument {
  const logo = doc.layers.find(isBrandLayer);
  if (!logo) return doc;
  const aspect = source.type === "vector" ? SENITUKANG[source.variant].viewBox.width / SENITUKANG[source.variant].viewBox.height : source.width / Math.max(1, source.height);
  const area = logo.width * logo.height;
  const width = Math.sqrt(area * aspect);
  const height = width / aspect;
  const c = { x: logo.x + logo.width / 2, y: logo.y + logo.height / 2 };
  const r = { x: c.x - width / 2, y: c.y - height / 2, width, height };
  let next: Layer;
  if (source.type === "vector") {
    const fill = logo.type === "shape" && logo.fill ? logo.fill : contrastPick(surfacesUnder(doc, r, logo));
    const role = logo.type === "shape" ? logo.fillRole : "none";
    next = logoLayer(r, fill, role, source.variant);
  } else {
    next = createImageLayer(source.assetId, { name: "Senitukang logo", brandLocked: true, ...r });
  }
  next = { ...next, id: logo.id, rotation: logo.rotation, groupId: logo.groupId };
  return { ...doc, layers: doc.layers.map((l) => (l === logo ? next : l)) };
}

/**
 * Enforce the logo's protection on any document. Applied to every edit, so it
 * holds whichever panel, shortcut, undo step or import made the change: the
 * logo stays single, visible, opaque, on top, undistorted, legible and on the page.
 */
export function sanitizeBrand(doc: DesignDocument): DesignDocument {
  const logo = doc.layers.find(isBrandLayer);
  if (!logo) return doc;
  const shape = logo.type === "shape" ? logo : null;
  const vb = shape?.pathViewBox;
  const aspect = vb ? vb.width / vb.height : logo.width / Math.max(1, logo.height);
  const short = Math.min(doc.width, doc.height);

  let width = Math.max(short * MIN_WIDTH, logo.width);
  width = Math.min(width, doc.width, doc.height * aspect);
  const height = width / aspect;
  const b = layerBounds({ x: logo.x, y: logo.y, width, height, rotation: logo.rotation });
  const shift = (start: number, size: number, limit: number) =>
    size > limit ? (limit - size) / 2 - start : start < 0 ? -start : start + size > limit ? limit - start - size : 0;
  const x = logo.x + shift(b.x, b.width, doc.width);
  const y = logo.y + shift(b.y, b.height, doc.height);

  // The page colour can be changed under the logo; don't let it disappear.
  const onImage = doc.layers.some((l) => l.type === "image" && l.visible && intersectionArea(layerBounds(l), b) > 0);
  const bg = doc.background.color;
  const swap = !!shape?.fill && !doc.background.transparent && !onImage && contrastRatio(shape.fill, bg) < MIN_CONTRAST;
  const fill = swap ? contrastPick([bg]) : shape?.fill;

  const unchanged =
    width === logo.width && height === logo.height && x === logo.x && y === logo.y && fill === shape?.fill &&
    logo.visible && logo.opacity === 1 && logo.blendMode === "normal" && !logo.locked &&
    doc.layers[doc.layers.length - 1] === logo && doc.layers.filter(isBrandLayer).length === 1;
  if (unchanged) return doc;

  const base = { width, height, x, y, visible: true, opacity: 1, blendMode: "normal" as const, locked: false };
  const fixed: Layer = shape ? { ...shape, ...base, fill: fill ?? null, fillRole: swap ? "none" : shape.fillRole } : { ...logo, ...base };
  return { ...doc, layers: [...doc.layers.filter((l) => !isBrandLayer(l)), fixed] };
}
