import type { ImageLayer, Layer, ShapeLayer, TextLayer, TextureLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import { browserMeasure, layoutText, type TextLayout } from "@/core/text/layout";
import { BLEND_TO_COMPOSITE, processImage, type ImageSource } from "./image-pipeline";
import { shapePath, tracePath } from "./paths";
import { renderTexture } from "./textures";

/**
 * The single source of truth for painting layers. Used by the Konva editor
 * (via custom sceneFuncs), thumbnails, raster export and generator previews,
 * so what you see is exactly what you export.
 */

export interface DrawContext {
  /** Output pixels per document pixel (zoom × devicePixelRatio, or export scale). */
  unit: number;
  getSource: (assetId: string) => ImageSource | null;
  /** Cap for processed image resolution (performance in the editor). */
  maxImageSide?: number;
}

export function textLayoutFor(l: TextLayer): TextLayout {
  return layoutText(l, browserMeasure);
}

const supportsLetterSpacing = typeof CanvasRenderingContext2D !== "undefined" && "letterSpacing" in CanvasRenderingContext2D.prototype;

function fillTextSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, ls: number, stroke: boolean) {
  if (!ls) {
    if (stroke) ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    return;
  }
  if (supportsLetterSpacing) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ls}px`;
    if (stroke) ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    return;
  }
  let cx = x;
  for (const ch of text) {
    if (stroke) ctx.strokeText(ch, cx, y);
    else ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + ls;
  }
}

export function drawText(ctx: CanvasRenderingContext2D, l: TextLayer, layout = textLayoutFor(l)) {
  const h = l.autoHeight ? layout.height : l.height;
  const w = l.vertical ? layout.width : l.width;
  if (l.backgroundColor) {
    ctx.fillStyle = l.backgroundColor;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.font = layout.font;
  ctx.textBaseline = "alphabetic";
  const passes: ("shadow" | "stroke" | "fill")[] = [];
  if (l.stroke && l.strokeWidth > 0) passes.push("stroke");
  passes.push("fill");
  for (const pass of passes) {
    ctx.save();
    if (l.shadow.enabled && pass === passes[0]) {
      ctx.shadowColor = l.shadow.color;
      ctx.shadowBlur = l.shadow.blur;
      ctx.shadowOffsetX = l.shadow.offsetX;
      ctx.shadowOffsetY = l.shadow.offsetY;
    }
    if (pass === "stroke") {
      ctx.strokeStyle = l.stroke!;
      ctx.lineWidth = l.strokeWidth * 2;
      ctx.lineJoin = "round";
    } else ctx.fillStyle = l.fill;
    if (layout.glyphs) {
      ctx.textAlign = "center";
      for (const g of layout.glyphs) {
        if (pass === "stroke") ctx.strokeText(g.char, g.x, g.y);
        else ctx.fillText(g.char, g.x, g.y);
      }
    } else {
      ctx.textAlign = "left";
      for (const line of layout.lines)
        for (const word of line.words) fillTextSpaced(ctx, word.text, word.x, line.baseline, layout.letterSpacingPx, pass === "stroke");
    }
    ctx.restore();
  }
}

export function drawShape(ctx: CanvasRenderingContext2D, l: ShapeLayer) {
  const cmds = shapePath(l);
  ctx.beginPath();
  tracePath(ctx, cmds);
  if (l.dash?.length) ctx.setLineDash(l.dash);
  if (l.shape === "line") {
    ctx.strokeStyle = l.stroke ?? l.fill ?? "#171717";
    ctx.lineWidth = Math.max(0.5, l.height);
    ctx.lineCap = "butt";
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  if (l.fill) {
    ctx.fillStyle = l.fill;
    ctx.fill();
  }
  if (l.stroke && l.strokeWidth > 0) {
    ctx.strokeStyle = l.stroke;
    ctx.lineWidth = l.strokeWidth;
    ctx.lineJoin = "miter";
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

export function imageOutputSize(l: ImageLayer, src: ImageSource, unit: number, maxSide = 4096) {
  const sw = src instanceof HTMLImageElement ? src.naturalWidth || src.width : src.width;
  const sh = src instanceof HTMLImageElement ? src.naturalHeight || src.height : src.height;
  // Never upscale beyond the cropped source resolution.
  const srcMax = Math.max(sw * l.crop.width, sh * l.crop.height);
  let w = l.width * unit;
  let h = l.height * unit;
  const limit = Math.min(maxSide, Math.max(srcMax, 64));
  const k = Math.max(w, h) > limit ? limit / Math.max(w, h) : 1;
  w *= k;
  h *= k;
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

export function drawImageLayer(ctx: CanvasRenderingContext2D, l: ImageLayer, dc: DrawContext) {
  const src = dc.getSource(l.assetId);
  if (!src) {
    // Placeholder while loading / when missing.
    ctx.fillStyle = "rgba(136,136,136,0.18)";
    ctx.fillRect(0, 0, l.width, l.height);
    ctx.strokeStyle = "rgba(136,136,136,0.6)";
    ctx.lineWidth = 1 / dc.unit;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(l.width, l.height);
    ctx.moveTo(l.width, 0);
    ctx.lineTo(0, l.height);
    ctx.stroke();
    return;
  }
  // Quantise output resolution so small zoom changes reuse the cache.
  const q = Math.pow(2, Math.ceil(Math.log2(Math.max(0.05, dc.unit)) * 2) / 2);
  const { w, h } = imageOutputSize(l, src, q, dc.maxImageSide);
  const processed = processImage(src, l, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(processed, 0, 0, l.width, l.height);
}

export function drawTexture(ctx: CanvasRenderingContext2D, l: TextureLayer, dc: DrawContext) {
  const unit = Math.min(dc.unit, 2);
  const maxSide = 4096;
  let w = l.width * unit;
  let h = l.height * unit;
  const k = Math.max(w, h) > maxSide ? maxSide / Math.max(w, h) : 1;
  w *= k;
  h *= k;
  const tex = renderTexture(l, w, h, unit * k);
  ctx.drawImage(tex, 0, 0, l.width, l.height);
}

/** Paint one layer in its local coordinate space (0,0)-(w,h). */
export function drawLayerContent(ctx: CanvasRenderingContext2D, l: Layer, dc: DrawContext) {
  switch (l.type) {
    case "text":
      return drawText(ctx, l);
    case "shape":
      return drawShape(ctx, l);
    case "image":
      return drawImageLayer(ctx, l, dc);
    case "texture":
      return drawTexture(ctx, l, dc);
  }
}

/** Paint a layer with its full transform, opacity and blend mode in document space. */
export function drawLayer(ctx: CanvasRenderingContext2D, l: Layer, dc: DrawContext) {
  if (!l.visible || l.opacity <= 0) return;
  ctx.save();
  ctx.translate(l.x, l.y);
  if (l.rotation) ctx.rotate((l.rotation * Math.PI) / 180);
  ctx.globalAlpha *= l.opacity;
  ctx.globalCompositeOperation = BLEND_TO_COMPOSITE[l.blendMode] ?? "source-over";
  drawLayerContent(ctx, l, dc);
  ctx.restore();
}

export interface RenderOptions {
  scale: number;
  transparent?: boolean;
  getSource: DrawContext["getSource"];
  /** Optional explicit background override (e.g. white for JPG when transparent). */
  background?: string;
  maxImageSide?: number;
  canvas?: HTMLCanvasElement;
}

/** Rasterise a whole document. Callers must ensure fonts and images are loaded first. */
export function renderDocument(doc: DesignDocument, opts: RenderOptions): HTMLCanvasElement {
  const c = opts.canvas ?? document.createElement("canvas");
  c.width = Math.max(1, Math.round(doc.width * opts.scale));
  c.height = Math.max(1, Math.round(doc.height * opts.scale));
  const ctx = c.getContext("2d")!;
  ctx.save();
  ctx.clearRect(0, 0, c.width, c.height);
  const transparent = opts.transparent ?? doc.background.transparent;
  if (!transparent || opts.background) {
    ctx.fillStyle = opts.background ?? doc.background.color;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.scale(opts.scale, opts.scale);
  const dc: DrawContext = { unit: opts.scale, getSource: opts.getSource, maxImageSide: opts.maxImageSide ?? 8192 };
  for (const l of doc.layers) drawLayer(ctx, l, dc);
  ctx.restore();
  return c;
}
