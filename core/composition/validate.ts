import type { Rect } from "@/types/canvas";
import type { Layer, ShapeLayer, TextLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import { intersectionArea, layerBounds, rectContains } from "@/core/geometry/transform";
import { approxMeasure, fitFontSize, layoutText, type MeasureFn } from "@/core/text/layout";
import { contrastRatio } from "@/core/rendering/color";

/**
 * Quality gate for generated compositions. Critical issues (overflowing,
 * clipped or colliding text) disqualify a variant; minor ones lower its score.
 */

export type IssueKind = "overflow" | "out-of-page" | "outside-margin" | "text-overlap" | "logo-overlap" | "low-contrast" | "tiny-text" | "box-height";

export interface Issue {
  kind: IssueKind;
  critical: boolean;
  layerId: string;
  otherId?: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
  warnings: string[];
  score: number;
}

export interface ValidateOptions {
  /** Text layers allowed to overlap other text (experimental typography). */
  intentionalOverlap?: Iterable<string>;
  /** Safe inset from the page edge, px. Default 1.5 % of the short side. */
  safeMargin?: number;
}

const isText = (l: Layer): l is TextLayer => l.type === "text";
const isLogo = (l: Layer) => l.type === "image" && /^logo/i.test(l.name);

export function textLayoutIssues(l: TextLayer, measure: MeasureFn): { overflow: boolean; tooWide: boolean; height: number } {
  const lay = layoutText({ ...l, autoHeight: l.autoHeight }, measure);
  const inner = l.width - (l.backgroundPadding || 0) * 2;
  const tooWide = !l.vertical && lay.lines.some((ln) => ln.width > inner + 0.5);
  const natural = layoutText({ ...l, autoHeight: true }, measure).height;
  return { overflow: lay.overflow, tooWide, height: natural };
}

export function validateDocument(doc: DesignDocument, measure: MeasureFn = approxMeasure, opts: ValidateOptions = {}): ValidationResult {
  const issues: Issue[] = [];
  const page: Rect = { x: 0, y: 0, width: doc.width, height: doc.height };
  const unit = Math.min(doc.width, doc.height);
  const safe = opts.safeMargin ?? Math.round(unit * 0.015);
  const safeRect: Rect = { x: safe, y: safe, width: doc.width - safe * 2, height: doc.height - safe * 2 };
  const intentional = new Set(opts.intentionalOverlap ?? []);
  const visible = doc.layers.filter((l) => l.visible);
  const texts = visible.filter(isText);
  const logos = visible.filter(isLogo);

  const boxes = new Map<string, Rect>();
  for (const t of texts) {
    const { overflow, tooWide, height } = textLayoutIssues(t, measure);
    if (overflow || tooWide) issues.push({ kind: "overflow", critical: true, layerId: t.id, message: `“${t.name}” does not fit its box` });
    if (!t.vertical && height > t.height + 1) issues.push({ kind: "box-height", critical: !t.autoHeight, layerId: t.id, message: `“${t.name}” is taller than its box` });
    const b = layerBounds({ ...t, height: Math.max(t.height, t.vertical ? t.height : height) });
    boxes.set(t.id, b);
    if (!rectContains(page, b, 0.5)) issues.push({ kind: "out-of-page", critical: true, layerId: t.id, message: `“${t.name}” is cut off by the page edge` });
    else if (!rectContains(safeRect, b, 0.5)) issues.push({ kind: "outside-margin", critical: false, layerId: t.id, message: `“${t.name}” sits outside the safe margin` });
    if (t.fontSize < Math.max(6, unit * 0.007)) issues.push({ kind: "tiny-text", critical: false, layerId: t.id, message: `“${t.name}” is very small (${Math.round(t.fontSize)} px)` });
  }

  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      if (intentional.has(a.id) || intentional.has(b.id)) continue;
      const ra = boxes.get(a.id)!;
      const rb = boxes.get(b.id)!;
      const area = intersectionArea(ra, rb);
      const smaller = Math.max(1, Math.min(ra.width * ra.height, rb.width * rb.height));
      if (area / smaller > 0.002) issues.push({ kind: "text-overlap", critical: true, layerId: a.id, otherId: b.id, message: `“${a.name}” collides with “${b.name}”` });
    }
    for (const lg of logos) {
      if (intersectionArea(boxes.get(texts[i].id)!, layerBounds(lg)) > 1)
        issues.push({ kind: "logo-overlap", critical: true, layerId: texts[i].id, otherId: lg.id, message: `“${texts[i].name}” overlaps the logo` });
    }
  }

  // Contrast against the topmost opaque fill beneath each text's centre.
  for (const t of texts) {
    if (t.backgroundColor) {
      if (contrastRatio(t.fill, t.backgroundColor) < 3) issues.push({ kind: "low-contrast", critical: false, layerId: t.id, message: `“${t.name}” has low contrast on its label` });
      continue;
    }
    const b = boxes.get(t.id)!;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const idx = doc.layers.indexOf(t);
    let under: string | null = doc.background.transparent ? null : doc.background.color;
    let unknown = false;
    for (let k = idx - 1; k >= 0; k--) {
      const l = doc.layers[k];
      if (!l.visible) continue;
      const lb = layerBounds(l);
      if (cx < lb.x || cx > lb.x + lb.width || cy < lb.y || cy > lb.y + lb.height) continue;
      if (l.type === "shape" && (l as ShapeLayer).fill && l.opacity >= 0.95 && l.blendMode === "normal") {
        under = (l as ShapeLayer).fill;
        break;
      }
      if (l.type === "image" || (l.type === "shape" && l.opacity < 0.95)) {
        unknown = true;
        break;
      }
    }
    if (!unknown && under) {
      const ratio = contrastRatio(t.fill, under);
      const large = t.fontSize >= unit * 0.035;
      if (ratio < (large ? 2.6 : 3.5)) issues.push({ kind: "low-contrast", critical: false, layerId: t.id, message: `“${t.name}” has low contrast (${ratio.toFixed(1)}:1)` });
    }
  }

  return { ok: !issues.some((i) => i.critical), issues, warnings: [...new Set(issues.map((i) => i.message))], score: scoreDocument(doc, issues) };
}

/** Heuristic aesthetic score 0..100. */
export function scoreDocument(doc: DesignDocument, issues: Issue[]): number {
  let score = 100;
  for (const i of issues) score -= i.critical ? 22 : i.kind === "outside-margin" || i.kind === "box-height" ? 3 : 6;
  const texts = doc.layers.filter(isText).filter((t) => t.visible);
  if (texts.length > 1) {
    const sizes = texts.map((t) => t.fontSize).sort((a, b) => b - a);
    const ratio = sizes[0] / Math.max(1, sizes[Math.floor(sizes.length / 2)]);
    // Clear hierarchy: the largest type at least 2.5× the median.
    if (ratio < 2.5) score -= 8;
    else if (ratio > 4) score += 2;
    // Alignment economy: few distinct left edges reads as intentional.
    const edges = new Set(texts.filter((t) => !t.rotation).map((t) => Math.round(layerBounds(t).x / Math.max(1, doc.width * 0.01))));
    score -= Math.max(0, edges.size - 4) * 2;
  }
  // Breathing room: penalise near-empty or overstuffed pages.
  const unitArea = doc.width * doc.height;
  const covered = doc.layers
    .filter((l) => l.visible && l.type !== "texture")
    .map((l) => layerBounds(l))
    .filter((b) => b.width * b.height < unitArea * 0.95)
    .reduce((a, b) => a + b.width * b.height, 0);
  const cover = covered / unitArea;
  if (cover < 0.15) score -= 6;
  if (cover > 1.6) score -= 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Fix simple problems in place on a copy: refit overflowing text, grow
 * auto-height boxes, nudge text back inside the page.
 */
export function repairDocument(doc: DesignDocument, measure: MeasureFn = approxMeasure): DesignDocument {
  const layers = doc.layers.map((l) => {
    if (!isText(l) || l.vertical) return l;
    let t = { ...l };
    const { overflow, tooWide } = textLayoutIssues(t, measure);
    if (overflow || tooWide) {
      const size = fitFontSize(t, { width: t.width, height: Math.max(t.height, doc.height) }, measure, t.fontSize, Math.min(6, t.fontSize));
      t = { ...t, fontSize: size };
    }
    const h = layoutText({ ...t, autoHeight: true }, measure).height;
    if (t.autoHeight || h > t.height) t = { ...t, height: Math.ceil(h * 100) / 100 };
    const b = layerBounds(t);
    let dx = 0;
    let dy = 0;
    if (b.x < 0) dx = -b.x;
    else if (b.x + b.width > doc.width) dx = doc.width - (b.x + b.width);
    if (b.y < 0) dy = -b.y;
    else if (b.y + b.height > doc.height) dy = doc.height - (b.y + b.height);
    return dx || dy ? { ...t, x: t.x + dx, y: t.y + dy } : t;
  });
  return { ...doc, layers };
}
