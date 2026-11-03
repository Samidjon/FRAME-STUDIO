import type { BlendMode, ImageLayer } from "@/types/layer";
import { mulberry32 } from "@/core/geometry/random";
import { parseColor } from "./color";
import { maskPath, tracePath } from "./paths";

export type ImageSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export function sourceSize(src: ImageSource) {
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height };
  return { w: src.width, h: src.height };
}

/**
 * Source rectangle actually drawn: the largest region inside the crop box with
 * the layer's aspect ratio, centred ("cover"). Images therefore never stretch.
 */
export function coverRect(src: { w: number; h: number }, crop: ImageLayer["crop"], boxW: number, boxH: number) {
  const cx = crop.x * src.w;
  const cy = crop.y * src.h;
  const cw = Math.max(1, crop.width * src.w);
  const ch = Math.max(1, crop.height * src.h);
  const target = Math.max(1e-6, boxW) / Math.max(1e-6, boxH);
  let sw = cw;
  let sh = cw / target;
  if (sh > ch) {
    sh = ch;
    sw = ch * target;
  }
  return { sx: cx + (cw - sw) / 2, sy: cy + (ch - sh) / 2, sw, sh };
}

export const BLEND_TO_COMPOSITE: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  "hard-light": "hard-light",
  "soft-light": "soft-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};

function hasPixelEffects(e: ImageLayer["effects"]) {
  return e.brightness || e.contrast || e.saturation || e.grayscale || e.hue || e.exposure || e.duotone.enabled || e.grain;
}

function applyPixelEffects(ctx: CanvasRenderingContext2D, w: number, h: number, e: ImageLayer["effects"], seed: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const bright = (e.brightness / 100) * 255 * 0.5;
  const cf = (259 * (e.contrast * 1.275 + 255)) / (255 * (259 - e.contrast * 1.275));
  const expo = Math.pow(2, e.exposure / 50);
  const sat = 1 + e.saturation / 100;
  const gray = e.grayscale / 100;
  const hueRad = (e.hue * Math.PI) / 180;
  const cosH = Math.cos(hueRad);
  const sinH = Math.sin(hueRad);
  // Hue rotation matrix (luminance preserving).
  const hm = [
    0.213 + cosH * 0.787 - sinH * 0.213, 0.715 - cosH * 0.715 - sinH * 0.715, 0.072 - cosH * 0.072 + sinH * 0.928,
    0.213 - cosH * 0.213 + sinH * 0.143, 0.715 + cosH * 0.285 + sinH * 0.14, 0.072 - cosH * 0.072 - sinH * 0.283,
    0.213 - cosH * 0.213 - sinH * 0.787, 0.715 - cosH * 0.715 + sinH * 0.715, 0.072 + cosH * 0.928 + sinH * 0.072,
  ];
  const dt = e.duotone.enabled ? [parseColor(e.duotone.shadow), parseColor(e.duotone.highlight)] : null;
  const rng = mulberry32(seed);
  const grainAmt = (e.grain / 100) * 90;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (e.exposure) { r *= expo; g *= expo; b *= expo; }
    if (e.brightness) { r += bright; g += bright; b += bright; }
    if (e.contrast) { r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128; }
    if (e.hue) {
      const nr = r * hm[0] + g * hm[1] + b * hm[2];
      const ng = r * hm[3] + g * hm[4] + b * hm[5];
      const nb = r * hm[6] + g * hm[7] + b * hm[8];
      r = nr; g = ng; b = nb;
    }
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (e.saturation) { r = lum + (r - lum) * sat; g = lum + (g - lum) * sat; b = lum + (b - lum) * sat; }
    if (gray) { r += (lum - r) * gray; g += (lum - g) * gray; b += (lum - b) * gray; }
    if (dt) {
      const t = Math.max(0, Math.min(1, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255));
      r = dt[0].r + (dt[1].r - dt[0].r) * t;
      g = dt[0].g + (dt[1].g - dt[0].g) * t;
      b = dt[0].b + (dt[1].b - dt[0].b) * t;
    }
    if (grainAmt) { const n = (rng() - 0.5) * grainAmt; r += n; g += n; b += n; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
}

function applyHalftone(ctx: CanvasRenderingContext2D, w: number, h: number, e: ImageLayer["effects"], unit: number) {
  const src = ctx.getImageData(0, 0, w, h).data;
  const step = Math.max(2, e.halftone.size * unit);
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "#F0EDE5";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = e.halftone.color;
  const a = (e.halftone.angle * Math.PI) / 180;
  const diag = Math.hypot(w, h);
  const cos = Math.cos(a), sin = Math.sin(a);
  for (let v = -diag; v < diag; v += step)
    for (let u = -diag; u < diag; u += step) {
      const x = w / 2 + u * cos - v * sin;
      const y = h / 2 + u * sin + v * cos;
      if (x < -step || y < -step || x > w + step || y > h + step) continue;
      const sx = Math.max(0, Math.min(w - 1, Math.round(x)));
      const sy = Math.max(0, Math.min(h - 1, Math.round(y)));
      const i = (sy * w + sx) * 4;
      const lum = (0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]) / 255;
      const r = (step / 2) * Math.sqrt(1 - lum) * 1.25;
      if (r < 0.3) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.restore();
}

const cache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE = 48;

export function pipelineKey(l: ImageLayer, outW: number, outH: number) {
  return [l.assetId, outW, outH, l.crop.x, l.crop.y, l.crop.width, l.crop.height, l.flipX, l.flipY, JSON.stringify(l.effects), l.mask, l.cornerRadius, l.border.width, l.border.color, l.width, l.height].join("|");
}

/**
 * Produce the final pixels of an image layer at `outW × outH`: crop → flip →
 * colour effects → blur → overlay → halftone → mask/radius → border.
 * Results are memoised so canvas re-renders never repeat pixel work.
 */
export function processImage(src: ImageSource, l: ImageLayer, outW: number, outH: number): HTMLCanvasElement {
  const W = Math.max(1, Math.round(outW));
  const H = Math.max(1, Math.round(outH));
  const key = pipelineKey(l, W, H);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const unit = W / Math.max(1, l.width); // output px per document px
  const e = l.effects;
  const size = sourceSize(src);
  const r = coverRect(size, l.crop, l.width, l.height);

  ctx.save();
  if (l.flipX || l.flipY) {
    ctx.translate(l.flipX ? W : 0, l.flipY ? H : 0);
    ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
  }
  if (e.blur > 0 && "filter" in ctx) ctx.filter = `blur(${e.blur * unit}px)`;
  ctx.imageSmoothingQuality = "high";
  // Overdraw slightly when blurring so edges don't fade to transparent.
  const bleed = e.blur > 0 ? e.blur * unit * 2 : 0;
  ctx.drawImage(src, r.sx, r.sy, r.sw, r.sh, -bleed, -bleed, W + bleed * 2, H + bleed * 2);
  ctx.restore();
  ctx.filter = "none";

  if (hasPixelEffects(e)) applyPixelEffects(ctx, W, H, e, 1337);

  if (e.overlay.enabled) {
    ctx.save();
    ctx.globalAlpha = e.overlay.opacity;
    ctx.globalCompositeOperation = BLEND_TO_COMPOSITE[e.overlay.blend] ?? "source-over";
    ctx.fillStyle = e.overlay.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (e.halftone.enabled) applyHalftone(ctx, W, H, e, unit);

  const mp = maskPath(l.mask, W, H, l.cornerRadius * unit);
  if (mp) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    tracePath(ctx, mp);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
  }
  if (l.border.width > 0) {
    const bw = l.border.width * unit;
    ctx.save();
    ctx.beginPath();
    tracePath(ctx, mp ?? [{ op: "M", x: 0, y: 0 }, { op: "L", x: W, y: 0 }, { op: "L", x: W, y: H }, { op: "L", x: 0, y: H }, { op: "Z" }]);
    ctx.clip();
    ctx.lineWidth = bw * 2; // half is clipped away → border sits inside the shape
    ctx.strokeStyle = l.border.color;
    ctx.stroke();
    ctx.restore();
  }

  cache.set(key, c);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  return c;
}

export function clearImageCache() {
  cache.clear();
}
