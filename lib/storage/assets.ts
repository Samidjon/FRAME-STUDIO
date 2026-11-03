"use client";

import { getDB } from "@/lib/indexeddb/db";
import { uid } from "@/core/document/factory";
import {
  ACCEPTED_FONT_EXT,
  ACCEPTED_IMAGE_MIME,
  MAX_FONT_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_SIDE,
  MAX_SVG_BYTES,
  type AssetKind,
  type AssetMeta,
  type StoredAsset,
} from "@/types/assets";
import { sanitizeSvg } from "@/lib/image/svg-sanitize";
import { registerSource, releaseSource } from "@/lib/image/resources";
import { registerUserFont, sanitizeFamilyName, sniffFontFormat } from "@/lib/fonts/catalog";

export class AssetError extends Error {}

const strip = (a: StoredAsset): AssetMeta => {
  const { blob: _b, thumb: _t, ...meta } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
  return meta;
};

/** Magic-byte sniffing — never trust the browser-reported MIME alone. */
async function sniffImage(file: Blob): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  const head = (await file.slice(0, 1024).text()).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

function loadImageEl(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AssetError("The image could not be decoded"));
    };
    img.src = url;
  });
}

function toBlob(c: HTMLCanvasElement, type: string, q?: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new AssetError("Encoding failed"))), type, q));
}

async function hasAlpha(img: HTMLImageElement): Promise<boolean> {
  const c = document.createElement("canvas");
  const s = 64;
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, s, s);
  const d = ctx.getImageData(0, 0, s, s).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

/** Downscale very large rasters and re-encode; keep alpha when present. */
async function optimizeRaster(file: Blob, mime: string) {
  const img = await loadImageEl(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const k = Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h));
  let blob: Blob = file;
  let outW = w;
  let outH = h;
  if (k < 1 || file.size > 6 * 1024 * 1024) {
    outW = Math.round(w * k);
    outH = Math.round(h * k);
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, outW, outH);
    const alpha = mime === "image/png" || mime === "image/webp" ? await hasAlpha(img) : false;
    blob = alpha ? await toBlob(c, "image/png") : await toBlob(c, "image/webp", 0.92);
    mime = blob.type;
  }
  URL.revokeObjectURL(img.src);
  return { blob, mime, width: outW, height: outH };
}

async function makeThumb(blob: Blob): Promise<Blob | null> {
  try {
    const img = await loadImageEl(blob);
    const s = 320 / Math.max(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * Math.min(1, s)));
    c.height = Math.max(1, Math.round(img.naturalHeight * Math.min(1, s)));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    return await toBlob(c, "image/webp", 0.8);
  } catch {
    return null;
  }
}

export interface ImportOptions {
  kind?: AssetKind;
  projectId?: string | null;
  folder?: string | null;
}

export async function importFile(file: File, opts: ImportOptions = {}): Promise<AssetMeta> {
  const lower = file.name.toLowerCase();
  const isFont = ACCEPTED_FONT_EXT.some((e) => lower.endsWith(e)) || opts.kind === "font";
  const db = await getDB();
  const now = Date.now();

  if (isFont) {
    if (file.size > MAX_FONT_BYTES) throw new AssetError("Font files must be under 10 MB");
    const buf = await file.arrayBuffer();
    if (!sniffFontFormat(buf)) throw new AssetError("This is not a valid WOFF, WOFF2, TTF or OTF font");
    const family = sanitizeFamilyName(file.name);
    await registerUserFont(family, buf);
    const asset: StoredAsset = {
      id: uid("ast"), kind: "font", name: family, mime: "font/" + (sniffFontFormat(buf) ?? "ttf"), size: file.size,
      width: null, height: null, fontFamily: family, favorite: false, folder: opts.folder ?? null,
      projectId: opts.projectId ?? null, ownerId: null, createdAt: now, remotePath: null,
      blob: new Blob([buf], { type: "application/octet-stream" }), thumb: null,
    };
    await db.put("assets", asset);
    return strip(asset);
  }

  const sniffed = await sniffImage(file);
  if (!sniffed || !(ACCEPTED_IMAGE_MIME as readonly string[]).includes(sniffed))
    throw new AssetError("Unsupported file. Use PNG, JPG, WebP, SVG, or a WOFF/WOFF2/TTF/OTF font.");
  if (file.size > MAX_IMAGE_BYTES) throw new AssetError("Images must be under 40 MB");

  let blob: Blob;
  let mime = sniffed;
  let width: number;
  let height: number;
  if (sniffed === "image/svg+xml") {
    if (file.size > MAX_SVG_BYTES) throw new AssetError("SVG files must be under 2 MB");
    const clean = sanitizeSvg(await file.text());
    blob = new Blob([clean], { type: "image/svg+xml" });
    const img = await loadImageEl(blob);
    width = img.naturalWidth || 512;
    height = img.naturalHeight || 512;
    URL.revokeObjectURL(img.src);
  } else {
    const o = await optimizeRaster(file, sniffed);
    blob = o.blob;
    mime = o.mime;
    width = o.width;
    height = o.height;
  }
  const kind: AssetKind = opts.kind ?? (sniffed === "image/svg+xml" ? "svg" : "image");
  const asset: StoredAsset = {
    id: uid("ast"), kind, name: file.name.replace(/\.[^.]+$/, "").slice(0, 64) || "Untitled", mime, size: blob.size,
    width, height, fontFamily: null, favorite: false, folder: opts.folder ?? null, projectId: opts.projectId ?? null,
    ownerId: null, createdAt: now, remotePath: null, blob, thumb: await makeThumb(blob),
  };
  await db.put("assets", asset);
  const el = await loadImageEl(blob);
  registerSource(asset.id, el);
  return strip(asset);
}

export async function listAssets(kind?: AssetKind): Promise<(AssetMeta & { thumbUrl: string | null })[]> {
  const db = await getDB();
  const all = kind ? await db.getAllFromIndex("assets", "kind", kind) : await db.getAll("assets");
  return all
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((a) => ({ ...strip(a), thumbUrl: a.thumb ? URL.createObjectURL(a.thumb) : a.kind !== "font" ? URL.createObjectURL(a.blob) : null }));
}

export async function getAssetMeta(id: string): Promise<AssetMeta | null> {
  const db = await getDB();
  const a = await db.get("assets", id);
  return a ? strip(a) : null;
}

export async function getAssetBlob(id: string): Promise<Blob | null> {
  const db = await getDB();
  return (await db.get("assets", id))?.blob ?? null;
}

export async function updateAsset(id: string, patch: Partial<Pick<AssetMeta, "name" | "favorite" | "folder" | "kind">>) {
  const db = await getDB();
  const a = await db.get("assets", id);
  if (!a) throw new AssetError("Asset not found");
  await db.put("assets", { ...a, ...patch });
}

export async function deleteAsset(id: string) {
  const db = await getDB();
  await db.delete("assets", id);
  releaseSource(id);
}

/** Re-register uploaded fonts on startup so documents render with them. */
export async function restoreUserFonts() {
  try {
    const db = await getDB();
    const fonts = await db.getAllFromIndex("assets", "kind", "font");
    await Promise.all(fonts.map(async (f) => registerUserFont(f.fontFamily ?? f.name, await f.blob.arrayBuffer()).catch(() => undefined)));
  } catch {
    /* IndexedDB unavailable */
  }
}
