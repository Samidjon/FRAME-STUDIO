"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Spinner, cx } from "@/components/shared/ui";
import { importFile } from "@/lib/storage/assets";
import { BUILTIN_IMAGES, getBuiltinImage } from "@/core/rendering/builtin-images";
import { colorDistance, toHex } from "@/core/rendering/color";
import { toast } from "@/stores/ui-store";
import type { AssetRef } from "@/core/composition/types";

export interface PickedImage extends AssetRef {
  name: string;
  /** Object / data URL for the thumbnail. */
  preview: string | null;
  /** Dominant colours when known (builtin images). */
  palette?: string[];
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

// ── builtin thumbnails (painted lazily, cached for the session) ──────────────
const thumbCache = new Map<string, string>();

function builtinThumb(id: string): string | null {
  const hit = thumbCache.get(id);
  if (hit) return hit;
  const src = getBuiltinImage(id);
  if (!src) return null;
  const c = document.createElement("canvas");
  const s = 120 / Math.max(src.width, src.height);
  c.width = Math.round(src.width * s);
  c.height = Math.round(src.height * s);
  c.getContext("2d")?.drawImage(src, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.8);
  thumbCache.set(id, url);
  return url;
}

/** Paint builtin thumbnails one per frame so the page stays responsive. */
export function useBuiltinThumbs(enabled = true) {
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => Object.fromEntries([...thumbCache.entries()]));
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let i = 0;
    const step = () => {
      if (!alive || i >= BUILTIN_IMAGES.length) return;
      const b = BUILTIN_IMAGES[i++];
      if (!thumbCache.has(b.id)) {
        const url = builtinThumb(b.id);
        if (url) setThumbs((t) => ({ ...t, [b.id]: url }));
      }
      setTimeout(step, 16);
    };
    const t = setTimeout(step, 50);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [enabled]);
  return thumbs;
}

export function builtinPick(id: string): PickedImage {
  const def = BUILTIN_IMAGES.find((b) => b.id === id) ?? BUILTIN_IMAGES[0];
  return { assetId: `builtin:${def.id}`, width: def.width, height: def.height, name: def.label, preview: thumbCache.get(def.id) ?? null, palette: def.palette };
}

/** Dominant colours of an image URL: coarse colour buckets, distinct by distance. */
export async function extractPalette(url: string, count = 5): Promise<string[]> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = 40;
  c.height = 40;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, 40, 40);
  const d = ctx.getImageData(0, 0, 40, 40).data;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += d[i];
    e.g += d[i + 1];
    e.b += d[i + 2];
    buckets.set(key, e);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((e) => toHex({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, a: 1 }));
  const out: string[] = [];
  for (const col of ranked) {
    if (out.every((o) => colorDistance(o, col) > 64)) out.push(col);
    if (out.length >= count) break;
  }
  return out;
}

export function ImageDrop({
  label,
  hint,
  value,
  onChange,
  kind,
  compact,
}: {
  label: string;
  hint: string;
  value: PickedImage | null;
  onChange: (v: PickedImage | null) => void;
  kind: "image" | "logo";
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ kind: "error", title: "Images only", description: "Use PNG, JPG, WebP or SVG." });
      return;
    }
    setBusy(true);
    try {
      const meta = await importFile(file, kind === "logo" ? { kind: "logo" } : {});
      const preview = URL.createObjectURL(file);
      onChange({ assetId: meta.id, width: meta.width ?? 1000, height: meta.height ?? 1000, name: meta.name, preview });
    } catch (e) {
      toast({ kind: "error", title: "Upload failed", description: e instanceof Error ? e.message : "The file could not be read." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void accept(e.dataTransfer.files[0]);
        }}
        className={cx(
          "relative flex items-center gap-4 border border-dashed p-3 transition-colors",
          over ? "border-accent bg-accent/10" : "border-line-strong",
          compact ? "min-h-[72px]" : "min-h-[104px]",
        )}
      >
        {value ? (
          <>
            <div className={cx("relative shrink-0 overflow-hidden border border-line bg-sunken", compact ? "h-14 w-14" : "h-20 w-20")}>
              {value.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.preview} alt="" className={cx("h-full w-full", kind === "logo" ? "object-contain p-1" : "object-cover")} />
              ) : (
                <span className="label-mono absolute inset-0 flex items-center justify-center">IMG</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{value.name}</div>
              <div className="font-mono text-[10px] text-subtle">
                {value.width} × {value.height}
              </div>
              <button className="mt-1 text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => inputRef.current?.click()}>
                Replace
              </button>
            </div>
            <button aria-label={`Remove ${label}`} className="self-start p-1 text-subtle hover:text-fg" onClick={() => onChange(null)}>
              <X size={14} />
            </button>
          </>
        ) : (
          <button className="flex w-full items-center gap-3 text-left" onClick={() => inputRef.current?.click()} disabled={busy}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-line text-muted">{busy ? <Spinner /> : <ImagePlus size={16} />}</span>
            <span>
              <span className="block text-[13px] font-medium">{busy ? "Importing…" : `Drop ${label.toLowerCase()} or browse`}</span>
              <span className="block text-[11px] text-subtle">{hint}</span>
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label={`Upload ${label}`}
          onChange={(e) => {
            void accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
