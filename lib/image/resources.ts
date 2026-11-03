"use client";

import { getBuiltinImage, isBuiltin } from "@/core/rendering/builtin-images";
import type { ImageSource } from "@/core/rendering/image-pipeline";
import { getDB } from "@/lib/indexeddb/db";

/**
 * Runtime registry mapping asset ids to decoded image sources. Documents only
 * ever store ids; decoded pixels live here (never in React state or JSON).
 */

type Listener = () => void;

const sources = new Map<string, ImageSource>();
const pending = new Map<string, Promise<ImageSource | null>>();
const failed = new Set<string>();
const objectUrls = new Map<string, string>();
const listeners = new Set<Listener>();
let version = 0;

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribeResources(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const getResourceVersion = () => version;

function decodeBlob(blob: Blob, id: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    objectUrls.set(id, url);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not decode image ${id}`));
    img.src = url;
  });
}

async function load(id: string): Promise<ImageSource | null> {
  if (isBuiltin(id)) {
    const c = getBuiltinImage(id);
    if (c) sources.set(id, c);
    return c;
  }
  try {
    const db = await getDB();
    const asset = await db.get("assets", id);
    if (!asset) throw new Error("missing asset");
    const img = await decodeBlob(asset.blob, id);
    sources.set(id, img);
    return img;
  } catch {
    failed.add(id);
    return null;
  }
}

/** Synchronous lookup; kicks off loading when missing and notifies on completion. */
export function getSource(id: string): ImageSource | null {
  const s = sources.get(id);
  if (s) return s;
  if (failed.has(id)) return null;
  if (!pending.has(id)) {
    const p = load(id).finally(() => {
      pending.delete(id);
      emit();
    });
    pending.set(id, p);
  }
  return null;
}

export async function ensureSources(ids: Iterable<string>): Promise<void> {
  const list = [...new Set(ids)];
  await Promise.all(
    list.map((id) => {
      if (sources.has(id) || failed.has(id)) return null;
      getSource(id);
      return pending.get(id) ?? null;
    }),
  );
}

export function isFailed(id: string) {
  return failed.has(id);
}

/** Register a freshly uploaded asset so it renders immediately. */
export function registerSource(id: string, src: ImageSource) {
  failed.delete(id);
  sources.set(id, src);
  emit();
}

export function releaseSource(id: string) {
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);
  sources.delete(id);
  emit();
}
