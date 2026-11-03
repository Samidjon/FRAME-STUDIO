import { mulberry32, type Rng } from "@/core/geometry/random";

/**
 * Procedurally painted "photographs" used by templates, the landing page and
 * the generator demo. They are generated on the client — no stock imagery.
 * Referenced from layers as assetId "builtin:<id>".
 */

export interface BuiltinImage {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Dominant colours, used for palette suggestions. */
  palette: string[];
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng) => void;
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, amount: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function lin(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export const BUILTIN_IMAGES: BuiltinImage[] = [
  {
    id: "dune",
    label: "Red Dune",
    width: 1600,
    height: 2000,
    palette: ["#0E2A2C", "#C2361B", "#E2552A", "#1B1B1B"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, "#06191B"], [0.45, "#0F3436"], [0.62, "#1E4A47"]]);
      ctx.fillRect(0, 0, w, h);
      // dune ridges
      const ridges = [
        { y: 0.6, c0: "#8E2412", c1: "#C9401D", amp: 0.035 },
        { y: 0.68, c0: "#B23A1A", c1: "#E2582B", amp: 0.05 },
        { y: 0.8, c0: "#7C1F10", c1: "#B7341A", amp: 0.04 },
      ];
      for (const r of ridges) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        const base = r.y * h;
        const ph = rng() * 6;
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + Math.sin(x / w * 3.2 + ph) * r.amp * h + Math.sin(x / w * 11 + ph) * r.amp * 0.2 * h);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = lin(ctx, 0, base - r.amp * h, 0, h, [[0, r.c1], [1, r.c0]]);
        ctx.fill();
      }
      blob(ctx, w * 0.5, h * 0.6, w * 0.5, "rgba(255,120,60,0.18)");
      grain(ctx, w, h, rng, 22);
    },
  },
  {
    id: "horizon",
    label: "Pale Horizon",
    width: 2000,
    height: 1600,
    palette: ["#E9DAF5", "#F6C9A8", "#7E8DA6", "#2B3245"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, "#B7B9D6"], [0.4, "#E9DAF5"], [0.55, "#F6C9A8"], [0.56, "#6F7F9A"], [1, "#2B3245"]]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,240,225,0.9)";
      ctx.beginPath();
      ctx.arc(w * 0.62, h * 0.5, h * 0.07, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 160; i++) {
        const y = h * 0.57 + Math.pow(rng(), 1.6) * h * 0.43;
        ctx.fillStyle = `rgba(255,230,210,${0.05 + rng() * 0.12})`;
        ctx.fillRect(w * 0.62 - rng() * w * 0.2, y, rng() * w * 0.4, 2 + rng() * 3);
      }
      grain(ctx, w, h, rng, 16);
    },
  },
  {
    id: "concrete",
    label: "Concrete Facade",
    width: 1600,
    height: 2000,
    palette: ["#B9B4AA", "#8C877E", "#3F3D39", "#E6E1D6"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = "#D9D4C9";
      ctx.fillRect(0, 0, w, h);
      const cols = 6;
      const rows = 9;
      const cw = w / cols;
      const rh = h / rows;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = c * cw, y = r * rh;
          const tone = 150 + rng() * 40;
          ctx.fillStyle = `rgb(${tone},${tone - 4},${tone - 10})`;
          ctx.fillRect(x + 6, y + 6, cw - 12, rh - 12);
          ctx.fillStyle = lin(ctx, x, y, x + cw, y + rh, [[0, "rgba(30,28,25,0.75)"], [1, "rgba(30,28,25,0.2)"]]);
          ctx.fillRect(x + cw * 0.18, y + rh * 0.22, cw * 0.64, rh * 0.5);
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(x + 6, y + 6, cw - 12, 5);
        }
      ctx.fillStyle = lin(ctx, 0, 0, w, h, [[0, "rgba(255,250,240,0.15)"], [1, "rgba(0,0,0,0.35)"]]);
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, rng, 30);
    },
  },
  {
    id: "bloom",
    label: "Colour Bloom",
    width: 2000,
    height: 2000,
    palette: ["#FF4D00", "#E9DAF5", "#2A1B5F", "#FFB199"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = "#1B1340";
      ctx.fillRect(0, 0, w, h);
      const cs = ["rgba(255,77,0,0.85)", "rgba(233,218,245,0.8)", "rgba(255,177,153,0.7)", "rgba(110,60,255,0.6)"];
      for (let i = 0; i < 9; i++) blob(ctx, rng() * w, rng() * h, w * (0.25 + rng() * 0.35), cs[i % cs.length]);
      grain(ctx, w, h, rng, 26);
    },
  },
  {
    id: "orbit",
    label: "Orbit",
    width: 2000,
    height: 2000,
    palette: ["#0A0A0A", "#F0EDE5", "#FF4D00", "#3A3A3A"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = "#0B0B0C";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(240,237,229,${rng() * 0.7})`;
        const s = rng() * 2.4;
        ctx.fillRect(rng() * w, rng() * h, s, s);
      }
      const cx = w * 0.56, cy = h * 0.46, r = w * 0.26;
      const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
      g.addColorStop(0, "#FFD2B8");
      g.addColorStop(0.45, "#FF4D00");
      g.addColorStop(1, "#2A0A00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(240,237,229,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.7, r * 0.35, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      grain(ctx, w, h, rng, 18);
    },
  },
  {
    id: "chrome",
    label: "Liquid Chrome",
    width: 2000,
    height: 2000,
    palette: ["#DADADA", "#5B5B5B", "#121212", "#F7F7F7"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = "#151515";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        const y = (i / 26) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 10) ctx.lineTo(x, y + Math.sin(x / 180 + i * 0.6) * 90 + Math.sin(x / 47 + i) * 12);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const t = i / 26;
        ctx.fillStyle = lin(ctx, 0, y - 90, 0, y + 160, [[0, `rgba(250,250,250,${0.6 - t * 0.3})`], [0.4, "rgba(90,90,90,0.9)"], [1, "rgba(15,15,15,1)"]]);
        ctx.fill();
      }
      grain(ctx, w, h, rng, 14);
    },
  },
  {
    id: "ridges",
    label: "Mountain Ridges",
    width: 2000,
    height: 1500,
    palette: ["#E8E1D3", "#9AA59A", "#4E5E58", "#1F2A28"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, "#F2EDE3"], [1, "#D8D2C4"]]);
      ctx.fillRect(0, 0, w, h);
      const tones = ["#B7BEB3", "#9AA59A", "#7A897F", "#5C6C65", "#3E4C47", "#1F2A28"];
      tones.forEach((c, i) => {
        const base = h * (0.35 + i * 0.11);
        ctx.beginPath();
        ctx.moveTo(0, h);
        let y = base;
        for (let x = 0; x <= w; x += 12) {
          y += (rng() - 0.5) * 26;
          y = Math.max(base - h * 0.12, Math.min(base + h * 0.08, y));
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
      });
      grain(ctx, w, h, rng, 14);
    },
  },
  {
    id: "neon",
    label: "Night Bokeh",
    width: 1600,
    height: 2000,
    palette: ["#0A0E1A", "#FF4D00", "#3DD6F5", "#E9DAF5"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, "#05070E"], [1, "#141B2E"]]);
      ctx.fillRect(0, 0, w, h);
      const cs = ["255,77,0", "61,214,245", "233,218,245", "255,200,90"];
      for (let i = 0; i < 70; i++) {
        const r = 20 + rng() * 120;
        ctx.fillStyle = `rgba(${cs[i % 4]},${0.08 + rng() * 0.25})`;
        ctx.beginPath();
        ctx.arc(rng() * w, h * 0.3 + rng() * h * 0.7, r, 0, Math.PI * 2);
        ctx.fill();
      }
      grain(ctx, w, h, rng, 20);
    },
  },
  {
    id: "fold",
    label: "Paper Fold",
    width: 2000,
    height: 2000,
    palette: ["#F0EDE5", "#D8D3C8", "#B8B2A6", "#FFFFFF"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = "#ECE8DF";
      ctx.fillRect(0, 0, w, h);
      const pts: [number, number][] = [];
      for (let i = 0; i < 7; i++) pts.push([rng() * w, rng() * h]);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(i % 2 ? w : 0, i % 2 ? h : 0);
        ctx.closePath();
        ctx.fillStyle = `rgba(${i % 2 ? "255,255,255" : "120,112,100"},${0.08 + rng() * 0.12})`;
        ctx.fill();
      }
      grain(ctx, w, h, rng, 10);
    },
  },
  {
    id: "waves",
    label: "Signal Waves",
    width: 2000,
    height: 2000,
    palette: ["#171717", "#FF4D00", "#F0EDE5", "#292929"],
    paint(ctx, w, h, rng) {
      ctx.fillStyle = "#171717";
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 3;
      for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = i % 9 === 0 ? "rgba(255,77,0,0.9)" : `rgba(240,237,229,${0.15 + (i / 90) * 0.5})`;
        ctx.beginPath();
        const y0 = (i / 90) * h;
        for (let x = 0; x <= w; x += 8) {
          const env = Math.exp(-Math.pow((x - w / 2) / (w * 0.22), 2));
          ctx.lineTo(x, y0 + Math.sin(x / 60 + i * 0.3) * 60 * env * (0.5 + rng() * 0.02));
        }
        ctx.stroke();
      }
      grain(ctx, w, h, rng, 12);
    },
  },
];

const builtinCache = new Map<string, HTMLCanvasElement>();

export function getBuiltinImage(id: string): HTMLCanvasElement | null {
  const key = id.replace(/^builtin:/, "");
  const hit = builtinCache.get(key);
  if (hit) return hit;
  const def = BUILTIN_IMAGES.find((b) => b.id === key);
  if (!def || typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = def.width;
  c.height = def.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  def.paint(ctx, def.width, def.height, mulberry32(key.length * 7919 + key.charCodeAt(0)));
  builtinCache.set(key, c);
  return c;
}

export const isBuiltin = (assetId: string) => assetId.startsWith("builtin:");
