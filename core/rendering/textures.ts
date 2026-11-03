import type { TextureKind, TextureLayer } from "@/types/layer";
import { mulberry32 } from "@/core/geometry/random";
import { parseColor } from "./color";

export const TEXTURES: { id: TextureKind; label: string; blend: TextureLayer["blendMode"]; opacity: number }[] = [
  { id: "paper", label: "Paper Grain", blend: "multiply", opacity: 0.5 },
  { id: "film-grain", label: "Film Grain", blend: "overlay", opacity: 0.45 },
  { id: "noise", label: "Noise", blend: "soft-light", opacity: 0.5 },
  { id: "halftone", label: "Halftone", blend: "multiply", opacity: 0.35 },
  { id: "dots", label: "Dots", blend: "normal", opacity: 0.4 },
  { id: "lines", label: "Lines", blend: "normal", opacity: 0.25 },
  { id: "grid", label: "Grid Pattern", blend: "normal", opacity: 0.25 },
  { id: "scanlines", label: "Scanlines", blend: "multiply", opacity: 0.35 },
  { id: "vintage", label: "Vintage Paper", blend: "multiply", opacity: 0.55 },
  { id: "geometric", label: "Geometric", blend: "normal", opacity: 0.2 },
];

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Per-pixel noise written directly into ImageData (alpha-only in the texture colour). */
function noiseInto(ctx: Ctx, w: number, h: number, color: string, seed: number, strength: number, cell: number) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const { r, g, b } = parseColor(color);
  const rng = mulberry32(seed);
  const c = Math.max(1, Math.round(cell));
  if (c === 1) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
      d[i + 3] = Math.pow(rng(), 1.6) * 255 * strength;
    }
  } else {
    const cols = Math.ceil(w / c);
    const vals = new Float32Array(cols * Math.ceil(h / c)).map(() => rng());
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
        d[i + 3] = Math.pow(vals[Math.floor(y / c) * cols + Math.floor(x / c)], 1.4) * 255 * strength;
      }
  }
  ctx.putImageData(img, 0, 0);
}

const cache = new Map<string, HTMLCanvasElement>();

/**
 * Render a texture into a canvas of w×h *output pixels*. `unit` is the size of
 * one document pixel in output pixels so patterns keep their document scale.
 */
export function renderTexture(l: Pick<TextureLayer, "texture" | "color" | "scale" | "seed">, w: number, h: number, unit: number): HTMLCanvasElement {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const key = `${l.texture}|${l.color}|${l.scale}|${l.seed}|${W}x${H}|${unit.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const s = Math.max(0.1, l.scale) * unit;
  const rng = mulberry32(l.seed);
  ctx.fillStyle = l.color;
  ctx.strokeStyle = l.color;
  switch (l.texture) {
    case "film-grain":
      noiseInto(ctx, W, H, l.color, l.seed, 0.9, Math.max(1, s * 1.2));
      break;
    case "noise":
      noiseInto(ctx, W, H, l.color, l.seed, 1, Math.max(1, s * 3));
      break;
    case "paper": {
      noiseInto(ctx, W, H, l.color, l.seed, 0.35, Math.max(1, s * 1.5));
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = Math.max(0.5, s * 0.8);
      const fibers = Math.round((W * H) / (2400 * s * s)) + 40;
      for (let i = 0; i < Math.min(fibers, 6000); i++) {
        const x = rng() * W, y = rng() * H, len = (10 + rng() * 40) * s, a = rng() * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + rng() * 6 * s, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "vintage": {
      noiseInto(ctx, W, H, l.color, l.seed, 0.3, Math.max(1, s * 2));
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < 14; i++) {
        const x = rng() * W, y = rng() * H, r = (0.08 + rng() * 0.25) * Math.max(W, H);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const { r: cr, g: cg, b: cb } = parseColor(l.color);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${0.12 + rng() * 0.12})`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      // vignette
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      const { r: vr, g: vg, b: vb } = parseColor(l.color);
      v.addColorStop(0, `rgba(${vr},${vg},${vb},0)`);
      v.addColorStop(1, `rgba(${vr},${vg},${vb},0.45)`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case "halftone": {
      const step = 14 * s;
      const angle = Math.PI / 4;
      const diag = Math.hypot(W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(angle);
      for (let y = -diag / 2; y < diag / 2; y += step)
        for (let x = -diag / 2; x < diag / 2; x += step) {
          // radius follows a diagonal gradient across the layer
          const t = (x + y + diag) / (2 * diag);
          const r = (step / 2) * Math.max(0.05, t) * 0.95;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.restore();
      break;
    }
    case "dots": {
      const step = 24 * s;
      const r = Math.max(0.5, 2.6 * s);
      for (let y = step / 2; y < H; y += step)
        for (let x = step / 2; x < W; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      break;
    }
    case "lines": {
      const step = 18 * s;
      ctx.lineWidth = Math.max(0.5, 1.5 * s);
      for (let i = -H; i < W + H; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + H, H);
        ctx.stroke();
      }
      break;
    }
    case "grid": {
      const step = 40 * s;
      ctx.lineWidth = Math.max(0.5, 1 * s);
      for (let x = 0; x <= W; x += step) ctx.fillRect(Math.round(x), 0, ctx.lineWidth, H);
      for (let y = 0; y <= H; y += step) ctx.fillRect(0, Math.round(y), W, ctx.lineWidth);
      break;
    }
    case "scanlines": {
      const step = 6 * s;
      for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, Math.max(0.5, step / 2.5));
      break;
    }
    case "geometric": {
      const step = 80 * s;
      ctx.lineWidth = Math.max(0.5, 1.5 * s);
      let row = 0;
      for (let y = 0; y < H + step; y += step, row++)
        for (let x = 0, col = 0; x < W + step; x += step, col++) {
          const k = Math.floor(mulberry32(l.seed + row * 997 + col * 31)() * 4);
          ctx.beginPath();
          if (k === 0) ctx.arc(x + step / 2, y + step / 2, step * 0.35, 0, Math.PI * 2);
          else if (k === 1) {
            ctx.moveTo(x, y + step);
            ctx.lineTo(x + step / 2, y);
            ctx.lineTo(x + step, y + step);
            ctx.closePath();
          } else if (k === 2) ctx.arc(x, y, step, 0, Math.PI / 2);
          else ctx.rect(x + step * 0.2, y + step * 0.2, step * 0.6, step * 0.6);
          ctx.stroke();
        }
      break;
    }
  }
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
  cache.set(key, c);
  return c;
}
