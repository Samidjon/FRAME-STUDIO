import type { Rect } from "@/types/canvas";
import type { Layer, ShapeLayer, TextLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import { createShapeLayer, createTextLayer, uid } from "@/core/document/factory";
import { intersectionArea, layerBounds, rectContains } from "@/core/geometry/transform";
import { contrastRatio } from "@/core/rendering/color";
import { layoutText, type MeasureFn } from "@/core/text/layout";
import { kitMeasure } from "@/core/templates/kit";

/**
 * The Senitukang logo as real, editable layers. The symbol is redrawn as vector
 * geometry from the mark on senitukang.com: a 136 × 122 construction of
 * four r = 30.5 forms, the lower half being the upper half rotated 180°.
 */
const R = 30.5;
const K = R * 0.5522847498;

const circle = (cx: number, cy: number) =>
  `M${cx} ${cy - R} C${cx + K} ${cy - R} ${cx + R} ${cy - K} ${cx + R} ${cy} C${cx + R} ${cy + K} ${cx + K} ${cy + R} ${cx} ${cy + R} C${cx - K} ${cy + R} ${cx - R} ${cy + K} ${cx - R} ${cy} C${cx - R} ${cy - K} ${cx - K} ${cy - R} ${cx} ${cy - R} Z`;

/** Pill with a concave end; `dir` 1 opens right (upper form), -1 opens left (lower form). */
const scoop = (roundCx: number, cutCx: number, cy: number, dir: 1 | -1) => {
  const inner = cutCx - dir * R;
  const outer = roundCx - dir * R;
  return `M${roundCx} ${cy - dir * R} L${cutCx} ${cy - dir * R} C${cutCx - dir * K} ${cy - dir * R} ${inner} ${cy - dir * K} ${inner} ${cy} C${inner} ${cy + dir * K} ${cutCx - dir * K} ${cy + dir * R} ${cutCx} ${cy + dir * R} L${roundCx} ${cy + dir * R} C${roundCx - dir * K} ${cy + dir * R} ${outer} ${cy + dir * K} ${outer} ${cy} C${outer} ${cy - dir * K} ${roundCx - dir * K} ${cy - dir * R} ${roundCx} ${cy - dir * R} Z`;
};

export const SENITUKANG = {
  name: "SENITUKANG®",
  url: "https://senitukang.com",
  wordmarkFont: "Playfair Display",
  ink: "#171717",
  plate: "#FFFFFF",
  symbolPath: [scoop(R, 81, R, 1), circle(105.5, R), circle(R, 91.5), scoop(105.5, 55, 91.5, -1)].join(" "),
  symbolViewBox: { width: 136, height: 122 },
} as const;

/** Lockup proportions, relative to the page's short side. */
const SYMBOL_H = 0.046;
const FONT_SIZE = SYMBOL_H * 0.62;
const WORDMARK_EM = 8.3;
const GAP_EM = 0.42;
const PLATE_PAD_EM = 0.55;

function lockupSize(short: number) {
  const fontSize = short * FONT_SIZE;
  const symbolH = short * SYMBOL_H;
  const symbolW = (symbolH * SENITUKANG.symbolViewBox.width) / SENITUKANG.symbolViewBox.height;
  const pad = fontSize * PLATE_PAD_EM;
  const wordW = fontSize * WORDMARK_EM;
  return { fontSize, symbolH, symbolW, pad, wordW, width: symbolW + fontSize * GAP_EM + wordW + pad * 2, height: symbolH + pad * 2 };
}

/** Real occupied area of a layer: text boxes are re-measured instead of trusting a stale height. */
function occupied(l: Layer, measure: MeasureFn): Rect {
  if (l.type !== "text") return layerBounds(l);
  const lay = layoutText(l, measure);
  return layerBounds({ ...l, width: lay.width, height: lay.height });
}

interface Surface {
  /** The flat colour under the rect, or null when it sits on a photo or busy artwork. */
  flat: string | null;
  textOverlap: number;
  shapeOverlap: number;
}

function surfaceAt(doc: DesignDocument, rect: Rect, measure: MeasureFn): Surface {
  let flat: string | null = doc.background.transparent ? null : doc.background.color;
  let textOverlap = 0;
  let shapeOverlap = 0;
  for (const l of doc.layers) {
    if (!l.visible || l.opacity <= 0) continue;
    if (l.type === "texture") continue; // the lockup sits above textures
    const b = occupied(l, measure);
    const area = intersectionArea(b, rect);
    if (area <= 0) continue;
    if (l.type === "text") {
      textOverlap += area;
    } else if (l.type === "image") {
      flat = null;
      // Photos are fine to sit on, but a small framed image should keep its content clear.
      if (b.width < doc.width * 0.9 || b.height < doc.height * 0.9) shapeOverlap += area * 0.25;
    } else if (l.fill && l.opacity > 0.95 && !l.rotation && l.shape === "rect" && rectContains(b, rect)) {
      flat = l.fill;
    } else {
      flat = null;
      shapeOverlap += area;
    }
  }
  return { flat, textOverlap, shapeOverlap };
}

/**
 * Pick the clearest spot: scan the page's left, centre and right columns on a
 * vertical rhythm, heavily penalising text collisions and preferring the
 * bottom-right corner, the conventional place for a sign-off.
 */
function findPlacement(doc: DesignDocument, width: number, height: number, measure: MeasureFn) {
  const short = Math.min(doc.width, doc.height);
  const inset = Math.max(short * 0.035, Math.min(doc.grid.margins.left, doc.grid.margins.bottom, short * 0.07));
  const xs = [doc.width - inset - width, inset, (doc.width - width) / 2];
  const steps = 40;
  const yMax = doc.height - inset - height;
  const span = yMax - inset;
  let best: { x: number; y: number; surface: Surface; score: number } | null = null;
  xs.forEach((x, xi) => {
    for (let i = 0; i <= steps; i++) {
      // Bottom edge first, then the top edge, then inwards from both.
      const t = i % 2 === 0 ? i / 2 / steps : 1 - (i - 1) / 2 / steps;
      const y = yMax - t * span;
      const rect = { x, y, width, height };
      const surface = surfaceAt(doc, rect, measure);
      const score = surface.textOverlap * 1000 + surface.shapeOverlap * 10 + (xi * 0.02 + i * 0.0025) * width * height;
      if (!best || score < best.score) best = { x, y, surface, score };
    }
  });
  return best!;
}

/** Return a copy of the document with the logo as the top-most group. Idempotent. */
export function withSenitukangBrand(doc: DesignDocument, measure: MeasureFn = kitMeasure): DesignDocument {
  if (doc.layers.some((l) => l.name === "Senitukang symbol")) return doc;
  const short = Math.min(doc.width, doc.height);
  const s = lockupSize(short);
  const spot = findPlacement(doc, s.width, s.height, measure);
  const groupId = uid("grp");
  const flat = spot.surface.flat;
  const useDark = !flat || contrastRatio(flat, SENITUKANG.ink) >= contrastRatio(flat, "#F0EDE5");
  const color = useDark ? SENITUKANG.ink : "#F0EDE5";
  // Role-tagged only on a bare background, so style presets keep it legible; on a plate it stays black on white.
  const role = flat && flat === doc.background.color ? (useDark ? "ink" : "paper") : "none";

  const layers: Layer[] = [];
  if (!flat) {
    const plate: ShapeLayer = createShapeLayer("rect", {
      name: "Senitukang plate",
      x: spot.x,
      y: spot.y,
      width: s.width,
      height: s.height,
      fill: SENITUKANG.plate,
      fillRole: "none",
      groupId,
    });
    layers.push(plate);
  }
  const symbol: ShapeLayer = createShapeLayer("path", {
    name: "Senitukang symbol",
    x: spot.x + s.pad,
    y: spot.y + s.pad,
    width: s.symbolW,
    height: s.symbolH,
    pathData: SENITUKANG.symbolPath,
    pathViewBox: SENITUKANG.symbolViewBox,
    fill: color,
    fillRole: role,
    stroke: null,
    strokeRole: "none",
    groupId,
  });
  const lineHeight = 1.1;
  const wordmark: TextLayer = createTextLayer(
    {
      role: "caption",
      name: "Senitukang wordmark",
      text: SENITUKANG.name,
      fontFamily: SENITUKANG.wordmarkFont,
      fontWeight: 500,
      fontSize: s.fontSize,
      lineHeight,
      letterSpacing: -10,
      uppercase: false,
      x: spot.x + s.pad + s.symbolW + s.fontSize * GAP_EM,
      y: spot.y + (s.height - s.fontSize * lineHeight) / 2,
      width: s.wordW,
      fill: color,
      fillRole: role,
      groupId,
    },
    doc.width,
  );
  layers.push(symbol, wordmark);
  return { ...doc, layers: [...doc.layers, ...layers] };
}
