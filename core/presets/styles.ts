import type { GridSettings } from "@/types/canvas";
import type { ColorRole, Layer, TextRole } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import { colorDistance, luminance } from "@/core/rendering/color";

/**
 * Style presets: a controlled vocabulary of palettes, typefaces, grids and
 * composition tendencies. `applyStyle` remaps an existing document onto a
 * preset without moving anything.
 */

export type PaletteRole = Exclude<ColorRole, "none">;

export interface StylePalette {
  name: string;
  background: string;
  ink: string;
  accent: string;
  muted: string;
  paper: string;
}

export type CompositionId =
  | "type-top-image-bottom"
  | "full-bleed"
  | "asymmetric-editorial"
  | "modular-grid"
  | "centered-minimal"
  | "vertical-type"
  | "split"
  | "experimental-type"
  | "swiss-international"
  | "magazine-cover";

export interface StyleFonts {
  display: string;
  heading: string;
  body: string;
  mono: string;
}

export interface StyleProportions {
  /** Preferred aspect ratios (width / height). */
  ratios: number[];
  /** Margin as a fraction of the shorter document side. */
  marginFactor: number;
  /** Display size as a fraction of the document width. */
  titleScale: number;
  /** Fraction of the canvas left intentionally empty (0..1). */
  whitespace: number;
}

export interface StyleGridRecommendation extends Partial<Omit<GridSettings, "margins">> {
  /** Margin as a fraction of the shorter document side. */
  marginFactor: number;
}

export interface StyleTypography {
  uppercaseDisplay: boolean;
  /** 1/1000 em. */
  displayLetterSpacing: number;
  displayLineHeight: number;
  displayWeight: number;
  headingWeight: number;
  /** Metadata tracking, 1/1000 em. */
  metadataLetterSpacing: number;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  palettes: StylePalette[];
  fonts: StyleFonts;
  compositions: CompositionId[];
  proportions: StyleProportions;
  grid: StyleGridRecommendation;
  typography: StyleTypography;
  /** Texture hints for generators. */
  textures: string[];
}

const WARM = "#F0EDE5";
const BLACK = "#171717";
const ANTH = "#292929";
const GREY = "#888888";
const ORANGE = "#FF4D00";
const LAV = "#E9DAF5";

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "swiss",
    name: "Swiss International",
    description: "Objective typography on a strict modular grid. Flush-left grotesk, asymmetric balance and a single signal colour.",
    palettes: [
      { name: "Signal", background: WARM, ink: BLACK, accent: ORANGE, muted: GREY, paper: "#FFFFFF" },
      { name: "Red Plate", background: "#E30613", ink: "#FFFFFF", accent: BLACK, muted: "#F3A3A3", paper: "#FFFFFF" },
      { name: "Night", background: BLACK, ink: WARM, accent: ORANGE, muted: "#6B6B6B", paper: ANTH },
    ],
    fonts: { display: "Inter", heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
    compositions: ["swiss-international", "modular-grid", "asymmetric-editorial", "type-top-image-bottom"],
    proportions: { ratios: [0.8, 0.707, 1], marginFactor: 0.06, titleScale: 0.15, whitespace: 0.35 },
    grid: { type: "modular", columns: 6, rows: 8, marginFactor: 0.06, gutter: 20 },
    typography: { uppercaseDisplay: false, displayLetterSpacing: -45, displayLineHeight: 0.88, displayWeight: 700, headingWeight: 600, metadataLetterSpacing: 60 },
    textures: ["grid", "paper"],
  },
  {
    id: "brutalist",
    name: "Brutalist",
    description: "Raw, heavy and unapologetic. Oversized condensed type, hard blocks, visible structure and no ornament.",
    palettes: [
      { name: "Concrete", background: "#D9D6CF", ink: "#0A0A0A", accent: ORANGE, muted: "#7A7770", paper: "#FFFFFF" },
      { name: "Hazard", background: "#FFE500", ink: "#0A0A0A", accent: "#0047FF", muted: "#6E6400", paper: "#FFFFFF" },
      { name: "Terminal", background: "#0A0A0A", ink: "#E8E8E8", accent: "#39FF14", muted: "#5A5A5A", paper: "#1F1F1F" },
    ],
    fonts: { display: "Anton", heading: "Archivo Black", body: "Archivo", mono: "Space Mono" },
    compositions: ["experimental-type", "split", "full-bleed", "modular-grid"],
    proportions: { ratios: [0.8, 1, 0.5625], marginFactor: 0.03, titleScale: 0.24, whitespace: 0.1 },
    grid: { type: "column", columns: 4, rows: 1, marginFactor: 0.03, gutter: 8 },
    typography: { uppercaseDisplay: true, displayLetterSpacing: -10, displayLineHeight: 0.84, displayWeight: 400, headingWeight: 400, metadataLetterSpacing: 40 },
    textures: ["noise", "halftone", "scanlines"],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Generous whitespace, one quiet focal point and restrained hierarchy. Everything earns its place.",
    palettes: [
      { name: "Bone", background: "#F4F2ED", ink: "#1C1C1C", accent: "#B8B2A6", muted: "#9A968E", paper: "#FFFFFF" },
      { name: "Graphite", background: "#202020", ink: "#EDEDED", accent: "#8C8C8C", muted: "#5E5E5E", paper: "#2B2B2B" },
      { name: "Haze", background: LAV, ink: "#26203A", accent: "#7A6A9E", muted: "#9C92B2", paper: "#F7F2FB" },
    ],
    fonts: { display: "Manrope", heading: "Manrope", body: "Inter", mono: "IBM Plex Mono" },
    compositions: ["centered-minimal", "full-bleed", "type-top-image-bottom"],
    proportions: { ratios: [0.8, 1, 0.5625], marginFactor: 0.1, titleScale: 0.07, whitespace: 0.7 },
    grid: { type: "thirds", columns: 3, rows: 3, marginFactor: 0.1, gutter: 0 },
    typography: { uppercaseDisplay: false, displayLetterSpacing: -20, displayLineHeight: 1.05, displayWeight: 400, headingWeight: 500, metadataLetterSpacing: 120 },
    textures: ["paper"],
  },
  {
    id: "experimental",
    name: "Experimental",
    description: "Typography as image. Collisions, extreme scale contrasts, rotated and stacked letterforms.",
    palettes: [
      { name: "Lavender Acid", background: LAV, ink: BLACK, accent: ORANGE, muted: "#9B87B0", paper: "#FFFFFF" },
      { name: "Burn", background: ORANGE, ink: BLACK, accent: WARM, muted: "#B33600", paper: "#FFE3D6" },
      { name: "Void", background: "#0D0D0D", ink: LAV, accent: ORANGE, muted: "#4C4458", paper: "#1E1A24" },
    ],
    fonts: { display: "Syne", heading: "Unbounded", body: "Space Grotesk", mono: "JetBrains Mono" },
    compositions: ["experimental-type", "vertical-type", "asymmetric-editorial", "full-bleed"],
    proportions: { ratios: [0.8, 0.5625, 1], marginFactor: 0.04, titleScale: 0.22, whitespace: 0.25 },
    grid: { type: "asymmetrical", columns: 3, rows: 6, columnRatios: [1, 3, 1], marginFactor: 0.04, gutter: 12 },
    typography: { uppercaseDisplay: true, displayLetterSpacing: -60, displayLineHeight: 0.82, displayWeight: 800, headingWeight: 700, metadataLetterSpacing: 100 },
    textures: ["film-grain", "halftone"],
  },
  {
    id: "japanese-editorial",
    name: "Japanese Editorial",
    description: "Calm vertical rhythm, mixed Latin and Japanese type, hairline rules and precise marginalia.",
    palettes: [
      { name: "Washi", background: "#EFEAE0", ink: "#1A1A1A", accent: "#C8371E", muted: "#8E877A", paper: "#FAF7F1" },
      { name: "Sumi", background: "#141414", ink: "#EFEAE0", accent: "#C8371E", muted: "#6E6A62", paper: "#232220" },
      { name: "Fuji", background: "#E7E3EE", ink: "#1E1B26", accent: "#3B4BC8", muted: "#8F8A9C", paper: "#F6F4FA" },
    ],
    fonts: { display: "Noto Serif JP", heading: "Zen Kaku Gothic New", body: "Noto Sans JP", mono: "IBM Plex Mono" },
    compositions: ["vertical-type", "asymmetric-editorial", "magazine-cover", "centered-minimal"],
    proportions: { ratios: [0.707, 0.8, 0.5625], marginFactor: 0.07, titleScale: 0.11, whitespace: 0.5 },
    grid: { type: "modular", columns: 8, rows: 12, marginFactor: 0.07, gutter: 12 },
    typography: { uppercaseDisplay: false, displayLetterSpacing: 40, displayLineHeight: 1.1, displayWeight: 500, headingWeight: 500, metadataLetterSpacing: 120 },
    textures: ["paper", "vintage"],
  },
  {
    id: "modernist",
    name: "Modernist",
    description: "Rational mid-century clarity. Clean geometric sans, primary geometry and ordered columns.",
    palettes: [
      { name: "Gallery", background: "#F2F0EB", ink: "#1D1D1B", accent: "#1F4FD8", muted: "#8A8880", paper: "#FFFFFF" },
      { name: "Ochre", background: "#E9C46A", ink: "#1D1D1B", accent: "#C8371E", muted: "#9C7E3A", paper: "#FFF6DD" },
      { name: "Ink Blue", background: "#14213D", ink: "#F2F0EB", accent: "#FCA311", muted: "#5C6784", paper: "#22304F" },
    ],
    fonts: { display: "Hanken Grotesk", heading: "Hanken Grotesk", body: "Hanken Grotesk", mono: "IBM Plex Mono" },
    compositions: ["modular-grid", "swiss-international", "split", "type-top-image-bottom"],
    proportions: { ratios: [0.707, 0.8, 1], marginFactor: 0.07, titleScale: 0.12, whitespace: 0.4 },
    grid: { type: "column", columns: 5, rows: 1, marginFactor: 0.07, gutter: 18 },
    typography: { uppercaseDisplay: false, displayLetterSpacing: -30, displayLineHeight: 0.95, displayWeight: 700, headingWeight: 600, metadataLetterSpacing: 60 },
    textures: ["paper", "lines"],
  },
  {
    id: "bauhaus",
    name: "Bauhaus Inspired",
    description: "Circle, square, triangle. Primary colours, geometric construction and bold sans set at right angles.",
    palettes: [
      { name: "Primary", background: "#EFE8D8", ink: "#141414", accent: "#E1251B", muted: "#2052A6", paper: "#F6C326" },
      { name: "Weimar", background: "#141414", ink: "#EFE8D8", accent: "#F6C326", muted: "#E1251B", paper: "#2052A6" },
      { name: "Dessau", background: "#2052A6", ink: "#EFE8D8", accent: "#F6C326", muted: "#141414", paper: "#E1251B" },
    ],
    fonts: { display: "Archivo", heading: "Archivo", body: "Archivo", mono: "Space Mono" },
    compositions: ["modular-grid", "split", "centered-minimal", "experimental-type"],
    proportions: { ratios: [0.707, 1, 0.8], marginFactor: 0.06, titleScale: 0.14, whitespace: 0.3 },
    grid: { type: "modular", columns: 4, rows: 6, marginFactor: 0.06, gutter: 0 },
    typography: { uppercaseDisplay: true, displayLetterSpacing: -20, displayLineHeight: 0.9, displayWeight: 800, headingWeight: 700, metadataLetterSpacing: 80 },
    textures: ["paper", "geometric"],
  },
  {
    id: "retro-futurism",
    name: "Retro Futurism",
    description: "Space-age optimism: wide display faces, orbital geometry, gradients of dusk and chrome.",
    palettes: [
      { name: "Dusk", background: "#1B1340", ink: "#FFE8D0", accent: ORANGE, muted: "#7C6BB0", paper: "#2B2060" },
      { name: "Chrome", background: "#DADADA", ink: "#121212", accent: "#3DD6F5", muted: "#7B7B7B", paper: "#F7F7F7" },
      { name: "Sunset Strip", background: "#FFB199", ink: "#2A1B5F", accent: ORANGE, muted: "#C27A7A", paper: "#FFE3D6" },
    ],
    fonts: { display: "Unbounded", heading: "Syne", body: "Space Grotesk", mono: "Space Mono" },
    compositions: ["centered-minimal", "full-bleed", "magazine-cover", "experimental-type"],
    proportions: { ratios: [1, 0.5625, 0.8], marginFactor: 0.06, titleScale: 0.12, whitespace: 0.35 },
    grid: { type: "symmetrical", columns: 6, rows: 8, marginFactor: 0.06, gutter: 16 },
    typography: { uppercaseDisplay: true, displayLetterSpacing: -10, displayLineHeight: 0.95, displayWeight: 700, headingWeight: 600, metadataLetterSpacing: 140 },
    textures: ["scanlines", "film-grain"],
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Black, white and every grey between. Photographic contrast and strict typographic economy.",
    palettes: [
      { name: "Silver Gelatin", background: "#EDEDED", ink: "#111111", accent: "#555555", muted: "#999999", paper: "#FFFFFF" },
      { name: "Darkroom", background: "#0E0E0E", ink: "#F2F2F2", accent: "#BDBDBD", muted: "#5C5C5C", paper: "#1C1C1C" },
    ],
    fonts: { display: "Familjen Grotesk", heading: "Familjen Grotesk", body: "Inter", mono: "IBM Plex Mono" },
    compositions: ["full-bleed", "type-top-image-bottom", "split", "centered-minimal"],
    proportions: { ratios: [0.8, 0.5625, 1], marginFactor: 0.05, titleScale: 0.13, whitespace: 0.4 },
    grid: { type: "column", columns: 6, rows: 1, marginFactor: 0.05, gutter: 16 },
    typography: { uppercaseDisplay: false, displayLetterSpacing: -35, displayLineHeight: 0.92, displayWeight: 600, headingWeight: 500, metadataLetterSpacing: 80 },
    textures: ["film-grain", "noise"],
  },
  {
    id: "acid",
    name: "Acid Graphic",
    description: "Rave-flyer energy: acid greens, chrome, distorted type, stars and noise at full volume.",
    palettes: [
      { name: "Acid", background: "#0A0A0A", ink: "#C6FF00", accent: "#FF2BD6", muted: "#4A4A4A", paper: "#1A1A1A" },
      { name: "Toxic Lavender", background: LAV, ink: "#0A0A0A", accent: "#C6FF00", muted: "#8C7BA5", paper: "#FFFFFF" },
      { name: "Infra", background: "#FF2BD6", ink: "#0A0A0A", accent: "#C6FF00", muted: "#A3108A", paper: "#FFD6F6" },
    ],
    fonts: { display: "Rubik Mono One", heading: "Unbounded", body: "Space Grotesk", mono: "Major Mono Display" },
    compositions: ["experimental-type", "full-bleed", "vertical-type", "centered-minimal"],
    proportions: { ratios: [0.8, 1, 0.5625], marginFactor: 0.04, titleScale: 0.16, whitespace: 0.2 },
    grid: { type: "symmetrical", columns: 4, rows: 6, marginFactor: 0.04, gutter: 10 },
    typography: { uppercaseDisplay: true, displayLetterSpacing: -40, displayLineHeight: 0.9, displayWeight: 400, headingWeight: 700, metadataLetterSpacing: 100 },
    textures: ["noise", "halftone", "film-grain"],
  },
];

export function getStyle(id: string | null | undefined): StylePreset | undefined {
  if (!id) return undefined;
  return STYLE_PRESETS.find((s) => s.id === id);
}

/**
 * Supported weights per catalogue family. Replicated from lib/fonts/catalog.ts
 * (a client module) so this pure core module stays importable anywhere.
 */
const FAMILY_WEIGHTS: Record<string, number[]> = {
  Inter: [300, 400, 500, 600, 700, 800, 900],
  "Space Grotesk": [300, 400, 500, 600, 700],
  "Hanken Grotesk": [300, 400, 500, 600, 700, 800, 900],
  "Familjen Grotesk": [400, 500, 600, 700],
  Archivo: [300, 400, 500, 600, 700, 800, 900],
  Manrope: [300, 400, 500, 600, 700, 800],
  Syne: [400, 500, 600, 700, 800],
  Unbounded: [300, 400, 500, 600, 700, 800, 900],
  "Archivo Black": [400],
  "Rubik Mono One": [400],
  "Major Mono Display": [400],
  Anton: [400],
  "Bebas Neue": [400],
  Oswald: [300, 400, 500, 600, 700],
  "Big Shoulders Display": [300, 400, 500, 600, 700, 800, 900],
  "Instrument Serif": [400],
  "DM Serif Display": [400],
  "Playfair Display": [400, 500, 600, 700, 800, 900],
  Fraunces: [300, 400, 500, 600, 700, 800, 900],
  "Bodoni Moda": [400, 500, 600, 700, 800, 900],
  "Libre Caslon Text": [400, 700],
  "JetBrains Mono": [300, 400, 500, 600, 700, 800],
  "IBM Plex Mono": [300, 400, 500, 600, 700],
  "Space Mono": [400, 700],
  "Noto Sans JP": [300, 400, 500, 700, 900],
  "Noto Serif JP": [300, 400, 500, 700, 900],
  "Zen Kaku Gothic New": [300, 400, 500, 700, 900],
};

const ITALIC_FAMILIES = new Set([
  "Inter",
  "Hanken Grotesk",
  "Familjen Grotesk",
  "Archivo",
  "Instrument Serif",
  "DM Serif Display",
  "Playfair Display",
  "Fraunces",
  "Bodoni Moda",
  "Libre Caslon Text",
  "JetBrains Mono",
  "IBM Plex Mono",
  "Space Mono",
]);

const JAPANESE_FAMILIES =new Set(["Noto Sans JP", "Noto Serif JP", "Zen Kaku Gothic New"]);

/** Closest supported weight for a family; unknown families keep the requested weight. */
export function supportedWeight(family: string, weight: number): number {
  const ws = FAMILY_WEIGHTS[family];
  if (!ws || !ws.length) return weight;
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]);
}

const HAS_CJK = /[　-ヿ㐀-鿿＀-￯]/;

function fontForRole(fonts: StyleFonts, role: TextRole): string {
  switch (role) {
    case "display":
      return fonts.display;
    case "heading":
    case "subheading":
      return fonts.heading;
    case "body":
    case "caption":
      return fonts.body;
    case "metadata":
      return fonts.mono;
  }
}

const ROLES: PaletteRole[] = ["background", "ink", "accent", "muted", "paper"];

/**
 * Infer which palette role an un-tagged colour plays by comparing it with the
 * document's current palette (background/ink plus the colours that tagged
 * layers carry). Falls back to luminance against the background.
 */
function inferRole(color: string, reference: Partial<Record<PaletteRole, string>>, bg: string): PaletteRole {
  let best: PaletteRole | null = null;
  let bestD = Infinity;
  for (const r of ROLES) {
    const ref = reference[r];
    if (!ref) continue;
    const d = colorDistance(color, ref);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  if (best && bestD < 60) return best;
  const lc = luminance(color);
  const lb = luminance(bg);
  return Math.abs(lc - lb) < 0.15 ? "background" : "ink";
}

function isOpaqueHex(c: string | null | undefined): c is string {
  return !!c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
}

/**
 * Non-destructive style remap: positions, sizes, text and ids are kept; only
 * colours, font families and (clamped) weights change.
 */
export function applyStyle(
  doc: DesignDocument,
  styleId: string,
  paletteIndex = 0,
  opts: { fonts?: boolean; colors?: boolean } = {},
): DesignDocument {
  const style = getStyle(styleId);
  if (!style) return structuredClone(doc);
  const palette = style.palettes[Math.max(0, Math.min(style.palettes.length - 1, paletteIndex))];
  const doFonts = opts.fonts ?? true;
  const doColors = opts.colors ?? true;

  // Reference palette of the current document, learnt from tagged layers.
  const reference: Partial<Record<PaletteRole, string>> = { background: doc.background.color };
  for (const l of doc.layers) {
    if (l.type === "text" && l.fillRole && l.fillRole !== "none" && !reference[l.fillRole]) reference[l.fillRole] = l.fill;
    if (l.type === "shape") {
      if (l.fillRole && l.fillRole !== "none" && l.fill && !reference[l.fillRole]) reference[l.fillRole] = l.fill;
      if (l.strokeRole && l.strokeRole !== "none" && l.stroke && !reference[l.strokeRole]) reference[l.strokeRole] = l.stroke;
    }
  }
  const bg = doc.background.color;

  const remap = (color: string | null, role: ColorRole | undefined): string | null => {
    if (!color) return color;
    if (role === "none") return color;
    if (role) return palette[role];
    if (!isOpaqueHex(color)) return color;
    return palette[inferRole(color, reference, bg)];
  };

  const layers: Layer[] = doc.layers.map((src) => {
    const l = structuredClone(src);
    if (l.type === "text") {
      if (doColors) {
        l.fill = remap(l.fill, l.fillRole) ?? l.fill;
        if (l.backgroundColor) l.backgroundColor = remap(l.backgroundColor, undefined);
        if (l.stroke) l.stroke = remap(l.stroke, undefined);
      }
      if (doFonts) {
        let family = fontForRole(style.fonts, l.role);
        // Keep Japanese glyph coverage: only swap to another Japanese family.
        if (HAS_CJK.test(l.text) && !JAPANESE_FAMILIES.has(family)) {
          family = JAPANESE_FAMILIES.has(l.fontFamily) ? l.fontFamily : "Noto Sans JP";
        }
        l.fontFamily = family;
        l.fontWeight = supportedWeight(family, l.fontWeight);
        if (FAMILY_WEIGHTS[family] && !ITALIC_FAMILIES.has(family)) l.italic = false;
      }
    } else if (l.type === "shape") {
      if (doColors) {
        l.fill = remap(l.fill, l.fillRole);
        l.stroke = remap(l.stroke, l.strokeRole);
      }
    } else if (l.type === "texture") {
      if (doColors && isOpaqueHex(l.color)) {
        // Textures read best in ink on light grounds and paper on dark ones.
        l.color = luminance(palette.background) > 0.35 ? palette.ink : palette.paper;
      }
    } else if (l.type === "image") {
      if (doColors) {
        if (l.effects.duotone.enabled) {
          l.effects.duotone = { ...l.effects.duotone, shadow: palette.ink, highlight: palette.accent };
          if (luminance(palette.ink) > luminance(palette.accent)) {
            l.effects.duotone = { ...l.effects.duotone, shadow: palette.accent, highlight: palette.ink };
          }
        }
        if (l.effects.overlay.enabled) l.effects.overlay = { ...l.effects.overlay, color: palette.accent };
        if (l.effects.halftone.enabled) l.effects.halftone = { ...l.effects.halftone, color: palette.ink };
        if (l.border.width > 0) l.border = { ...l.border, color: remap(l.border.color, undefined) ?? l.border.color };
      }
    }
    return l;
  });

  return {
    ...structuredClone(doc),
    layers,
    background: doColors ? { ...doc.background, color: palette.background } : { ...doc.background },
    styleId: style.id,
  };
}
