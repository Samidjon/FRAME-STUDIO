"use client";

import { clearMeasureCache } from "@/core/text/layout";

export type FontCategory = "Grotesk" | "Display" | "Serif" | "Mono" | "Japanese" | "Condensed" | "Custom";

export interface FontDef {
  family: string;
  category: FontCategory;
  weights: number[];
  italic: boolean;
  /** Google Fonts family slug; null for locally registered (user) fonts. */
  google: string | null;
  sample?: string;
}

/** Curated catalogue of typefaces suited to graphic composition. */
export const FONT_CATALOG: FontDef[] = [
  { family: "Inter", category: "Grotesk", weights: [300, 400, 500, 600, 700, 800, 900], italic: true, google: "Inter" },
  { family: "Space Grotesk", category: "Grotesk", weights: [300, 400, 500, 600, 700], italic: false, google: "Space Grotesk" },
  { family: "Hanken Grotesk", category: "Grotesk", weights: [300, 400, 500, 600, 700, 800, 900], italic: true, google: "Hanken Grotesk" },
  { family: "Familjen Grotesk", category: "Grotesk", weights: [400, 500, 600, 700], italic: true, google: "Familjen Grotesk" },
  { family: "Archivo", category: "Grotesk", weights: [300, 400, 500, 600, 700, 800, 900], italic: true, google: "Archivo" },
  { family: "Manrope", category: "Grotesk", weights: [300, 400, 500, 600, 700, 800], italic: false, google: "Manrope" },
  { family: "Syne", category: "Display", weights: [400, 500, 600, 700, 800], italic: false, google: "Syne" },
  { family: "Unbounded", category: "Display", weights: [300, 400, 500, 600, 700, 800, 900], italic: false, google: "Unbounded" },
  { family: "Archivo Black", category: "Display", weights: [400], italic: false, google: "Archivo Black" },
  { family: "Rubik Mono One", category: "Display", weights: [400], italic: false, google: "Rubik Mono One" },
  { family: "Major Mono Display", category: "Display", weights: [400], italic: false, google: "Major Mono Display" },
  { family: "Anton", category: "Condensed", weights: [400], italic: false, google: "Anton" },
  { family: "Bebas Neue", category: "Condensed", weights: [400], italic: false, google: "Bebas Neue" },
  { family: "Oswald", category: "Condensed", weights: [300, 400, 500, 600, 700], italic: false, google: "Oswald" },
  { family: "Big Shoulders Display", category: "Condensed", weights: [300, 400, 500, 600, 700, 800, 900], italic: false, google: "Big Shoulders Display" },
  { family: "Instrument Serif", category: "Serif", weights: [400], italic: true, google: "Instrument Serif" },
  { family: "DM Serif Display", category: "Serif", weights: [400], italic: true, google: "DM Serif Display" },
  { family: "Playfair Display", category: "Serif", weights: [400, 500, 600, 700, 800, 900], italic: true, google: "Playfair Display" },
  { family: "Fraunces", category: "Serif", weights: [300, 400, 500, 600, 700, 800, 900], italic: true, google: "Fraunces" },
  { family: "Bodoni Moda", category: "Serif", weights: [400, 500, 600, 700, 800, 900], italic: true, google: "Bodoni Moda" },
  { family: "Libre Caslon Text", category: "Serif", weights: [400, 700], italic: true, google: "Libre Caslon Text" },
  { family: "JetBrains Mono", category: "Mono", weights: [300, 400, 500, 600, 700, 800], italic: true, google: "JetBrains Mono" },
  { family: "IBM Plex Mono", category: "Mono", weights: [300, 400, 500, 600, 700], italic: true, google: "IBM Plex Mono" },
  { family: "Space Mono", category: "Mono", weights: [400, 700], italic: true, google: "Space Mono" },
  { family: "Noto Sans JP", category: "Japanese", weights: [300, 400, 500, 700, 900], italic: false, google: "Noto Sans JP", sample: "視覚言語 Visual" },
  { family: "Noto Serif JP", category: "Japanese", weights: [300, 400, 500, 700, 900], italic: false, google: "Noto Serif JP", sample: "編集 Editorial" },
  { family: "Zen Kaku Gothic New", category: "Japanese", weights: [300, 400, 500, 700, 900], italic: false, google: "Zen Kaku Gothic New", sample: "形と光 Form" },
];

const userFonts: FontDef[] = [];
const loaded = new Set<string>();
const loading = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

export function subscribeFonts(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function notify() {
  clearMeasureCache();
  listeners.forEach((l) => l());
}

export function allFonts(): FontDef[] {
  return [...FONT_CATALOG, ...userFonts];
}

export function findFont(family: string): FontDef | undefined {
  return allFonts().find((f) => f.family === family);
}

export function nearestWeight(family: string, weight: number): number {
  const def = findFont(family);
  if (!def) return weight;
  return def.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), def.weights[0]);
}

function googleCssUrl(def: FontDef) {
  const fam = def.google!.replace(/ /g, "+");
  const ws = def.weights.join(";");
  if (def.italic) {
    const axes = [...def.weights.map((w) => `0,${w}`), ...def.weights.map((w) => `1,${w}`)].join(";");
    return `https://fonts.googleapis.com/css2?family=${fam}:ital,wght@${axes}&display=swap`;
  }
  return def.weights.length > 1 || def.weights[0] !== 400
    ? `https://fonts.googleapis.com/css2?family=${fam}:wght@${ws}&display=swap`
    : `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
}

/** Load a catalogue font (all weights) and resolve when glyphs are usable on canvas. */
export function loadFont(family: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (loaded.has(family)) return Promise.resolve();
  const existing = loading.get(family);
  if (existing) return existing;
  const def = findFont(family);
  if (!def || !def.google) {
    loaded.add(family);
    return Promise.resolve();
  }
  const p = new Promise<void>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = googleCssUrl(def);
    link.dataset.font = family;
    link.onload = async () => {
      try {
        await Promise.all(
          def.weights.flatMap((w) => [
            document.fonts.load(`${w} 32px "${family}"`),
            ...(def.italic ? [document.fonts.load(`italic ${w} 32px "${family}"`)] : []),
          ]),
        );
      } catch {
        /* fall back silently */
      }
      loaded.add(family);
      notify();
      resolve();
    };
    link.onerror = () => {
      // Offline: canvas falls back to the next family in the stack.
      loaded.add(family);
      resolve();
    };
    document.head.appendChild(link);
  });
  loading.set(family, p);
  return p;
}

export async function loadFonts(families: Iterable<string>) {
  await Promise.all([...new Set(families)].map((f) => loadFont(f)));
  // Give a timeout-guard so exports never hang on a slow font CDN.
}

export function isFontLoaded(family: string) {
  return loaded.has(family);
}

/** File signature check for WOFF / WOFF2 / TTF / OTF. */
export function sniffFontFormat(buf: ArrayBuffer): "woff" | "woff2" | "truetype" | "opentype" | null {
  const b = new Uint8Array(buf.slice(0, 4));
  const tag = String.fromCharCode(...b);
  if (tag === "wOFF") return "woff";
  if (tag === "wOF2") return "woff2";
  if (tag === "OTTO") return "opentype";
  if (tag === "true" || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0)) return "truetype";
  return null;
}

/** Register an uploaded font with the FontFace API under a sanitised family name. */
export async function registerUserFont(family: string, data: ArrayBuffer): Promise<FontDef> {
  if (!sniffFontFormat(data)) throw new Error("Not a valid WOFF, WOFF2, TTF or OTF font file");
  const face = new FontFace(family, data);
  await face.load();
  document.fonts.add(face);
  const def: FontDef = { family, category: "Custom", weights: [400], italic: false, google: null };
  if (!userFonts.some((f) => f.family === family)) userFonts.push(def);
  loaded.add(family);
  notify();
  return def;
}

export function sanitizeFamilyName(fileName: string) {
  const base = fileName.replace(/\.(woff2?|ttf|otf)$/i, "").replace(/[^a-zA-Z0-9 _-]/g, " ").replace(/\s+/g, " ").trim();
  return (base || "Custom Font").slice(0, 48);
}
