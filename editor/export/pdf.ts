"use client";

import { jsPDF } from "jspdf";
import type { Layer, ShapeLayer, TextLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import { drawLayerContent, renderDocument, textLayoutFor, type DrawContext } from "@/core/rendering/draw";
import { shapePath, type PathCmd } from "@/core/rendering/paths";
import { parseColor } from "@/core/rendering/color";
import { getSource } from "@/lib/image/resources";
import { prepareDocument } from "@/lib/image/thumbnail";
import { pdfPageSize, type PdfPageSize } from "./pdf-page";

export { PAGE_SIZES_PT, pdfPageSize, type PdfPageSize } from "./pdf-page";

export type PdfMode = "vector" | "flatten";

export interface PdfOptions {
  pageSize: PdfPageSize;
  /** "vector": shapes as vector paths, text/images/textures as rasters. "flatten": one full-page raster. */
  mode?: PdfMode;
  /** Resolution of raster parts. */
  dpi?: number;
  /** Ignored: PDF pages are always opaque. Kept for a uniform options shape. */
  transparent?: boolean;
  title?: string;
  onProgress?: (fraction: number) => void;
}

export interface PdfResult {
  blob: Blob;
  pageWidth: number;
  pageHeight: number;
  notes: string[];
}

const MAX_RASTER_SIDE = 8192;

interface Placement {
  /** Page points per document pixel. */
  s: number;
  ox: number;
  oy: number;
}

function placement(doc: DesignDocument, pw: number, ph: number): Placement {
  const s = Math.min(pw / doc.width, ph / doc.height);
  return { s, ox: (pw - doc.width * s) / 2, oy: (ph - doc.height * s) / 2 };
}

const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));

function rgbOf(color: string) {
  const c = parseColor(color);
  return { r: c.r, g: c.g, b: c.b, a: Math.max(0, Math.min(1, c.a)) };
}

/** Local layer point → page point. */
function makeTransform(l: Layer, p: Placement) {
  const rad = (l.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return (x: number, y: number): [number, number] => {
    const dx = l.x + x * cos - y * sin;
    const dy = l.y + x * sin + y * cos;
    return [p.ox + dx * p.s, p.oy + dy * p.s];
  };
}

function tracePdf(pdf: jsPDF, cmds: PathCmd[], tf: (x: number, y: number) => [number, number]) {
  let open = false;
  for (const c of cmds) {
    if (c.op === "M") {
      pdf.moveTo(...tf(c.x, c.y));
      open = true;
    } else if (c.op === "L") pdf.lineTo(...tf(c.x, c.y));
    else if (c.op === "C") {
      const [x1, y1] = tf(c.x1, c.y1);
      const [x2, y2] = tf(c.x2, c.y2);
      const [x, y] = tf(c.x, c.y);
      pdf.curveTo(x1, y1, x2, y2, x, y);
    } else if (open) pdf.close();
  }
}

function drawShapeVector(pdf: jsPDF, l: ShapeLayer, p: Placement) {
  const cmds = shapePath(l);
  if (!cmds.length) return;
  const tf = makeTransform(l, p);
  const isLine = l.shape === "line";
  const fillColor = isLine ? null : l.fill;
  const strokeColor = isLine ? (l.stroke ?? l.fill ?? "#171717") : l.stroke && l.strokeWidth > 0 ? l.stroke : null;
  const fill = fillColor ? rgbOf(fillColor) : null;
  const stroke = strokeColor ? rgbOf(strokeColor) : null;
  if ((!fill || fill.a <= 0) && (!stroke || stroke.a <= 0)) return;

  pdf.saveGraphicsState();
  pdf.setGState(pdf.GState({ opacity: l.opacity * (fill?.a ?? 1), "stroke-opacity": l.opacity * (stroke?.a ?? 1) }));
  if (fill) pdf.setFillColor(fill.r, fill.g, fill.b);
  if (stroke) {
    pdf.setDrawColor(stroke.r, stroke.g, stroke.b);
    pdf.setLineWidth((isLine ? Math.max(0.5, l.height) : l.strokeWidth) * p.s);
    pdf.setLineJoin(isLine ? "round" : "miter");
    pdf.setLineCap("butt");
    if (l.dash?.length) pdf.setLineDashPattern(l.dash.map((d) => d * p.s), 0);
  }
  tracePdf(pdf, cmds, tf);
  if (fill && fill.a > 0 && stroke && stroke.a > 0) pdf.fillStroke();
  else if (fill && fill.a > 0) pdf.fill();
  else pdf.stroke();
  pdf.restoreGraphicsState();
}

/** Local-space bounds a layer may paint into (text shadows/strokes spill out of the box). */
function paintBounds(l: Layer): { x0: number; y0: number; x1: number; y1: number } {
  let w = l.width;
  let h = l.height;
  let m = 2;
  if (l.type === "text") {
    const t = l as TextLayer;
    const layout = textLayoutFor(t);
    w = t.vertical ? layout.width : t.width;
    h = t.autoHeight ? layout.height : t.height;
    // Glyphs may overhang the box (italic, tight leading); be generous.
    m = t.fontSize * 0.6 + (t.stroke ? t.strokeWidth * 2 : 0) + (t.shadow.enabled ? t.shadow.blur * 2 + Math.max(Math.abs(t.shadow.offsetX), Math.abs(t.shadow.offsetY)) : 0);
  }
  return { x0: -m, y0: -m, x1: w + m, y1: h + m };
}

function hasAlpha(c: HTMLCanvasElement): boolean {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return true;
  try {
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
    return false;
  } catch {
    return true;
  }
}

let aliasCounter = 0;

/** Rasterise one layer into a canvas covering its rotated bounds and place it on the page. */
function drawLayerRaster(pdf: jsPDF, l: Layer, p: Placement, dpi: number, notes: string[]) {
  const b = paintBounds(l);
  const tf = (x: number, y: number) => {
    const rad = (l.rotation * Math.PI) / 180;
    return [l.x + x * Math.cos(rad) - y * Math.sin(rad), l.y + x * Math.sin(rad) + y * Math.cos(rad)];
  };
  const corners = [tf(b.x0, b.y0), tf(b.x1, b.y0), tf(b.x1, b.y1), tf(b.x0, b.y1)];
  const bx = Math.min(...corners.map((c) => c[0]));
  const by = Math.min(...corners.map((c) => c[1]));
  const bw = Math.max(...corners.map((c) => c[0])) - bx;
  const bh = Math.max(...corners.map((c) => c[1])) - by;
  if (bw <= 0 || bh <= 0) return;

  // Output pixels per document pixel.
  let k = (p.s * dpi) / 72;
  if (Math.max(bw, bh) * k > MAX_RASTER_SIDE) k = MAX_RASTER_SIDE / Math.max(bw, bh);
  const cw = Math.max(1, Math.ceil(bw * k));
  const ch = Math.max(1, Math.ceil(bh * k));
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d");
  if (!ctx) {
    notes.push(`Layer “${l.name}” could not be rasterised.`);
    return;
  }
  ctx.scale(k, k);
  ctx.translate(-bx, -by);
  ctx.translate(l.x, l.y);
  if (l.rotation) ctx.rotate((l.rotation * Math.PI) / 180);
  ctx.globalAlpha = l.opacity;
  const dc: DrawContext = { unit: k, getSource, maxImageSide: MAX_RASTER_SIDE };
  drawLayerContent(ctx, l, dc);

  const opaque = l.type === "image" && l.opacity >= 1 && !hasAlpha(c);
  const alias = `fs-${l.id}-${aliasCounter++}`;
  const x = p.ox + bx * p.s;
  const y = p.oy + by * p.s;
  if (opaque) pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", x, y, bw * p.s, bh * p.s, alias, "NONE");
  else pdf.addImage(c, "PNG", x, y, bw * p.s, bh * p.s, alias, "FAST");
  c.width = 0;
  c.height = 0;
}

/** Export the document as a single-page PDF. */
export async function exportPdfDetailed(doc: DesignDocument, opts: PdfOptions): Promise<PdfResult> {
  const notes: string[] = [];
  const dpi = Math.max(36, Math.min(600, opts.dpi ?? 300));
  const mode = opts.mode ?? "vector";
  opts.onProgress?.(0);
  await prepareDocument(doc);

  const { width: pw, height: ph } = pdfPageSize(doc, opts.pageSize);
  const p = placement(doc, pw, ph);
  const pdf = new jsPDF({ unit: "pt", format: [pw, ph], orientation: pw > ph ? "landscape" : "portrait", compress: true });
  pdf.setProperties({ title: opts.title ?? "Senitukang Studio export", creator: "Senitukang Studio" });

  const artW = doc.width * p.s;
  const artH = doc.height * p.s;

  if (mode === "flatten") {
    let scale = (p.s * dpi) / 72;
    if (Math.max(doc.width, doc.height) * scale > 16384) scale = 16384 / Math.max(doc.width, doc.height);
    const px = doc.width * scale * doc.height * scale;
    if (px > 268_000_000) scale *= Math.sqrt(268_000_000 / px);
    const canvas = renderDocument(doc, {
      scale,
      transparent: false,
      background: doc.background.transparent ? "#FFFFFF" : doc.background.color,
      getSource,
      maxImageSide: 16384,
    });
    opts.onProgress?.(0.6);
    await yieldFrame();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", p.ox, p.oy, artW, artH, "fs-flat", "NONE");
    canvas.width = 0;
    canvas.height = 0;
  } else {
    // Clip everything to the artwork rectangle so overflowing layers don't leak into margins.
    pdf.saveGraphicsState();
    pdf.rect(p.ox, p.oy, artW, artH, null);
    pdf.clip();
    pdf.discardPath();
    if (!doc.background.transparent) {
      const bg = rgbOf(doc.background.color);
      pdf.setFillColor(bg.r, bg.g, bg.b);
      pdf.rect(p.ox, p.oy, artW, artH, "F");
    }
    const layers = doc.layers.filter((l) => l.visible && l.opacity > 0);
    let blendNoted = false;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      if (l.blendMode !== "normal" && !blendNoted) {
        notes.push("Blend modes are drawn as normal in vector PDF mode; use “Flatten” for exact blending.");
        blendNoted = true;
      }
      try {
        if (l.type === "shape") drawShapeVector(pdf, l, p);
        else drawLayerRaster(pdf, l, p, dpi, notes);
      } catch (e) {
        notes.push(`Layer “${l.name}” was skipped (${e instanceof Error ? e.message : "error"}).`);
      }
      opts.onProgress?.(((i + 1) / layers.length) * 0.85);
      await yieldFrame();
    }
    pdf.restoreGraphicsState();
  }

  const blob = pdf.output("blob");
  opts.onProgress?.(1);
  return { blob, pageWidth: pw, pageHeight: ph, notes };
}

export async function exportPdf(doc: DesignDocument, opts: PdfOptions): Promise<Blob> {
  return (await exportPdfDetailed(doc, opts)).blob;
}
