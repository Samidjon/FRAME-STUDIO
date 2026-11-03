"use client";

import type { DesignDocument } from "@/types/project";
import { renderDocument } from "@/core/rendering/draw";
import { ensureSources, getSource } from "./resources";
import { loadFonts } from "@/lib/fonts/catalog";

export function docAssetIds(doc: DesignDocument): string[] {
  return doc.layers.flatMap((l) => (l.type === "image" ? [l.assetId] : []));
}

export function docFontFamilies(doc: DesignDocument): string[] {
  return doc.layers.flatMap((l) => (l.type === "text" ? [l.fontFamily] : []));
}

/** Load every image and font a document needs, with a timeout guard. */
export async function prepareDocument(doc: DesignDocument, timeoutMs = 8000) {
  await Promise.race([
    Promise.all([ensureSources(docAssetIds(doc)), loadFonts(docFontFamilies(doc))]),
    new Promise((r) => setTimeout(r, timeoutMs)),
  ]);
}

export async function renderDocumentToCanvas(doc: DesignDocument, maxSide: number, opts: { transparent?: boolean } = {}) {
  await prepareDocument(doc);
  const scale = Math.min(1, maxSide / Math.max(doc.width, doc.height));
  return renderDocument(doc, { scale, getSource, transparent: opts.transparent, maxImageSide: Math.max(512, maxSide * 2) });
}

export function canvasToBlob(c: HTMLCanvasElement, type = "image/webp", quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), type, quality));
}

export async function renderThumbnail(doc: DesignDocument, maxSide = 480): Promise<Blob> {
  const c = await renderDocumentToCanvas(doc, maxSide);
  return canvasToBlob(c, "image/webp", 0.82);
}

/** Data URL thumbnail cache for in-memory previews (template / generator grids). */
const urlCache = new Map<string, string>();
export async function renderPreviewUrl(key: string, doc: DesignDocument, maxSide = 420): Promise<string> {
  const hit = urlCache.get(key);
  if (hit) return hit;
  const blob = await renderThumbnail(doc, maxSide);
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}
