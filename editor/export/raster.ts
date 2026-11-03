"use client";

import type { DesignDocument } from "@/types/project";
import { renderDocument } from "@/core/rendering/draw";
import { getSource } from "@/lib/image/resources";
import { prepareDocument } from "@/lib/image/thumbnail";

export type RasterFormat = "png" | "jpeg" | "webp";

export interface RasterOptions {
  format: RasterFormat;
  /** Export scale (1/2/3…). Ignored when width or height is given. */
  scale?: number;
  /** Custom output width in px (aspect ratio is always kept). */
  width?: number;
  /** Custom output height in px (used when width is absent). */
  height?: number;
  /** PNG / WebP only. JPEG always gets an opaque background. */
  transparent?: boolean;
  /** 0..1 for JPEG / WebP. */
  quality?: number;
}

export interface RasterSize {
  width: number;
  height: number;
  /** Effective scale (output px per document px) after clamping. */
  scale: number;
  /** Requested scale before clamping. */
  requestedScale: number;
  clamped: boolean;
}

export interface RasterResult extends RasterSize {
  blob: Blob;
  /** Actual MIME type produced (browsers without WebP encoding fall back to PNG). */
  mime: string;
}

/** Practical browser canvas limits (Chromium / Firefox). */
export const MAX_CANVAS_SIDE = 16384;
export const MAX_CANVAS_PIXELS = 268_435_456;

const MIME: Record<RasterFormat, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

/** Resolve the output pixel size for the given options, clamped to browser canvas limits. */
export function resolveRasterSize(doc: Pick<DesignDocument, "width" | "height">, opts: Pick<RasterOptions, "scale" | "width" | "height">): RasterSize {
  let requested = opts.scale ?? 1;
  if (opts.width && opts.width > 0) requested = opts.width / doc.width;
  else if (opts.height && opts.height > 0) requested = opts.height / doc.height;
  if (!Number.isFinite(requested) || requested <= 0) requested = 1;
  let scale = requested;
  const side = Math.max(doc.width, doc.height) * scale;
  if (side > MAX_CANVAS_SIDE) scale = MAX_CANVAS_SIDE / Math.max(doc.width, doc.height);
  const px = doc.width * scale * doc.height * scale;
  if (px > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / px);
  // Round down a hair so rounding never pushes us over the limit.
  if (scale !== requested) scale = Math.floor(scale * 10000) / 10000;
  return {
    width: Math.max(1, Math.round(doc.width * scale)),
    height: Math.max(1, Math.round(doc.height * scale)),
    scale,
    requestedScale: requested,
    clamped: scale < requested - 1e-9,
  };
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser could not encode this image (it may be too large)."))), type, quality);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/** Render the document with the editor's own renderer and encode it. */
export async function exportRasterDetailed(doc: DesignDocument, opts: RasterOptions): Promise<RasterResult> {
  await prepareDocument(doc);
  const size = resolveRasterSize(doc, opts);
  const format = opts.format;
  const allowAlpha = format !== "jpeg";
  const transparent = allowAlpha && (opts.transparent ?? doc.background.transparent);
  let background: string | undefined;
  if (!transparent) background = doc.background.transparent ? "#FFFFFF" : doc.background.color;

  const canvas = document.createElement("canvas");
  try {
    renderDocument(doc, {
      scale: size.scale,
      transparent,
      background,
      getSource,
      maxImageSide: MAX_CANVAS_SIDE,
      canvas,
    });
    if (canvas.width !== size.width || canvas.height !== size.height || !canvas.getContext("2d")) {
      throw new Error("Canvas allocation failed");
    }
    const quality = format === "png" ? undefined : Math.min(1, Math.max(0.05, opts.quality ?? 0.92));
    const blob = await toBlob(canvas, MIME[format], quality);
    return { ...size, blob, mime: blob.type || MIME[format] };
  } finally {
    // Release the backing store promptly; large exports can hold hundreds of MB.
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function exportRaster(doc: DesignDocument, opts: RasterOptions): Promise<Blob> {
  return (await exportRasterDetailed(doc, opts)).blob;
}
