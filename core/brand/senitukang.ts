import type { Rect } from "@/types/canvas";
import type { Layer, ShapeLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import { createShapeLayer } from "@/core/document/factory";
import { intersectionArea, layerBounds } from "@/core/geometry/transform";
import { contrastRatio, mix } from "@/core/rendering/color";
import { kitMeasure } from "@/core/templates/kit";
import { layoutText, type MeasureFn } from "@/core/text/layout";
import { LOCKUP_PATH, LOCKUP_VIEWBOX, SYMBOL_PATH, SYMBOL_VIEWBOX } from "./logo-paths";

/**
 * The Senitukang logo is the hero of every example design. It is one vector
 * layer flagged `brandLocked`: users can move and scale it, but the editor store
 * keeps it on the page (see sanitizeBrand).
 */

export const SENITUKANG = {
  url: "https://senitukang.com",
  ink: "#171717",
  paper: "#F0EDE5",
  symbol: { path: SYMBOL_PATH, viewBox: SYMBOL_VIEWBOX },
  lockup: { path: LOCKUP_PATH, viewBox: LOCKUP_VIEWBOX },
} as const;

type Variant = "symbol" | "lockup";

const aspectOf = (v: Variant) => SENITUKANG[v].viewBox.width / SENITUKANG[v].viewBox.height;

/** Smallest allowed logo width, relative to the page's short side. */
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

/** Fit a logo of the given aspect, centred, inside a box. */
function fitIn(box: Rect, aspect: number, scale = 1): Rect {
  const width = Math.min(box.width, box.height * aspect) * scale;
  const height = width / aspect;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/** Studio images that read as light overall; the rest are dark. */
const LIGHT_IMAGES = new Set(["builtin:horizon", "builtin:concrete", "builtin:fold", "builtin:ridges"]);

/** Rough tone of an image layer, which can't be sampled in pure code. */
function imageTone(l: Extract<Layer, { type: "image" }>): string {
  const e = l.effects;
  if (e.halftone.enabled) return e.halftone.color;
  if (e.duotone.enabled) return mix(e.duotone.shadow, e.duotone.highlight, 0.5);
  return LIGHT_IMAGES.has(l.assetId) ? "#D8D4CC" : "#2A2A2A";
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

/** The composition's main graphic: its largest solid form that doesn't carry text. */
function findHeroShape(doc: DesignDocument, text: Rect[]): ShapeLayer | null {
  const page = doc.width * doc.height;
  let best: ShapeLayer | null = null;
  let bestScore = 0;
  for (const l of doc.layers) {
    if (l.type !== "shape" || !l.visible || !l.fill || l.opacity < 0.5 || l.shape === "line" || l.shape === "path") continue;
    const b = layerBounds(l);
    const area = b.width * b.height;
    if (area < page * 0.035 || area > page * 0.7) continue;
    if (hitsText(b, text) > area * 0.12) continue; // a panel behind copy, not a graphic
    const edges = [b.x <= 1, b.y <= 1, b.x + b.width >= doc.width - 1, b.y + b.height >= doc.height - 1].filter(Boolean).length;
    if (l.shape === "rect" && edges >= 2) continue; // a page band or block
    const score = area * (l.shape === "rect" ? 1 : 1.6);
    if (score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

/** Largest text-free spot on the page, nearest the main image (or the page centre). */
function findFreeSpot(doc: DesignDocument, text: Rect[], variant: Variant, short: number): Rect | null {
  const aspect = aspectOf(variant);
  const inset = short * 0.05;
  const pad = short * 0.02;
  const images = doc.layers.filter((l) => l.type === "image" && l.visible).map(layerBounds);
  const focus = images.sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? { x: 0, y: 0, width: doc.width, height: doc.height };
  const fx = Math.max(0, focus.x) + Math.min(focus.width, doc.width) / 2;
  const fy = Math.max(0, focus.y) + Math.min(focus.height, doc.height) / 2;
  const surfaces = [
    ...images,
    ...doc.layers.filter((l) => l.type === "shape" && l.visible && !!l.fill && l.shape !== "line" && l.width * l.height > doc.width * doc.height * 0.02).map(layerBounds),
  ];
  // Sizes are the logo's width: the lockup needs more width for the same presence.
  const unit = variant === "lockup" ? 1.5 : 1;
  for (const s of [0.66, 0.58, 0.5, 0.44, 0.38, 0.32, 0.26, 0.2, 0.15]) {
    const width = Math.min(short * s * unit, doc.width - inset * 2);
    const height = width / aspect;
    if (height > doc.height - inset * 2) continue;
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

function logoLayer(variant: Variant, r: Rect, fill: string, fillRole: ShapeLayer["fillRole"]): ShapeLayer {
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

const contrastPick = (surfaces: string[]) =>
  worstContrast(SENITUKANG.ink, surfaces) >= worstContrast(SENITUKANG.paper, surfaces) ? SENITUKANG.ink : SENITUKANG.paper;

/**
 * Return a copy of the document with the logo as its hero: it takes the place of
 * the main graphic when there is one, otherwise the largest text-free area.
 */
export function withSenitukangBrand(doc: DesignDocument, measure: MeasureFn = kitMeasure): DesignDocument {
  if (doc.layers.some(isBrandLayer)) return doc;
  const short = Math.min(doc.width, doc.height);
  const text = visibleText(doc, measure);
  const pad = short * 0.02;

  const hero = findHeroShape(doc, text);
  if (hero) {
    const box = layerBounds(hero);
    const variant: Variant = box.width / box.height >= 2 ? "lockup" : "symbol";
    for (const scale of [1, 0.92, 0.84, 0.76, 0.68]) {
      const r = fitIn(box, aspectOf(variant), scale);
      if (hitsText(inflate(r, pad), text) > 0) continue;
      const under = surfacesUnder(doc, r, hero);
      const keep = worstContrast(hero.fill!, under) >= 2.2;
      return {
        ...doc,
        layers: [...doc.layers.filter((l) => l !== hero), logoLayer(variant, r, keep ? hero.fill! : contrastPick(under), keep ? hero.fillRole : "none")],
      };
    }
  }

  // No main graphic: the full lockup when it has room, so the name is on the page.
  const lockup = findFreeSpot(doc, text, "lockup", short);
  const symbol = findFreeSpot(doc, text, "symbol", short);
  const useLockup = lockup && (!symbol || lockup.width >= short * 0.42);
  const variant: Variant = useLockup ? "lockup" : "symbol";
  const r = (useLockup ? lockup : symbol) ?? fitIn({ x: short * 0.05, y: short * 0.05, width: short * 0.15, height: short * 0.15 }, aspectOf("symbol"));
  const under = surfacesUnder(doc, r);
  const flatPage = !doc.background.transparent && under.length === 1 && under[0] === doc.background.color;
  const fill = contrastPick(under);
  return { ...doc, layers: [...doc.layers, logoLayer(variant, r, fill, flatPage ? (fill === SENITUKANG.ink ? "ink" : "paper") : "none")] };
}

/**
 * Enforce the logo's protection on any document. Applied to every edit, so it
 * holds whichever panel, shortcut, undo step or import made the change: the
 * logo stays single, visible, opaque, on top, undistorted, legible and on the page.
 */
export function sanitizeBrand(doc: DesignDocument): DesignDocument {
  const logo = doc.layers.find(isBrandLayer);
  if (!logo || logo.type !== "shape") return doc;
  const vb = logo.pathViewBox ?? SENITUKANG.symbol.viewBox;
  const aspect = vb.width / vb.height;
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
  const swap = !doc.background.transparent && !onImage && logo.fill && contrastRatio(logo.fill, bg) < MIN_CONTRAST;
  const fill = swap ? contrastPick([bg]) : logo.fill;

  const unchanged =
    width === logo.width && height === logo.height && x === logo.x && y === logo.y && fill === logo.fill &&
    logo.visible && logo.opacity === 1 && logo.blendMode === "normal" && !logo.locked &&
    doc.layers[doc.layers.length - 1] === logo && doc.layers.filter(isBrandLayer).length === 1;
  if (unchanged) return doc;

  const fixed: ShapeLayer = { ...logo, width, height, x, y, fill, visible: true, opacity: 1, blendMode: "normal", locked: false, fillRole: swap ? "none" : logo.fillRole };
  return { ...doc, layers: [...doc.layers.filter((l) => !isBrandLayer(l)), fixed] };
}
