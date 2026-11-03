import type { ImageEffects, TextureKind } from "@/types/layer";
import { bestContrast, colorDistance, contrastRatio, luminance, mix, parseColor } from "@/core/rendering/color";
import type { Rng } from "@/core/geometry/random";
import type { AlgorithmId } from "./types";

/**
 * Self-contained style table for the generator. Deliberately independent of
 * core/presets so the engine has no compile-time coupling to the preset UI.
 */

export interface GenPalette {
  background: string;
  ink: string;
  accent: string;
  muted: string;
  paper: string;
}

export interface GenStyle {
  id: string;
  name: string;
  palettes: GenPalette[];
  fonts: { display: string; heading: string; body: string; mono: string };
  weights: { display: number; heading: number; body: number; mono: number };
  /** Display type set in capitals. */
  uppercase: boolean;
  /** Display tracking, 1/1000 em. */
  tracking: number;
  displayLineHeight: number;
  /** Page margin as a fraction of the short side. */
  margin: number;
  /** Algorithms that express this style best, strongest first. */
  preferred: AlgorithmId[];
  texture: TextureKind | null;
  /** Image treatment applied to the hero image. */
  effects: (p: GenPalette) => Partial<ImageEffects>;
}

const none = () => ({});

export const GEN_STYLES: GenStyle[] = [
  {
    id: "swiss",
    name: "Swiss",
    palettes: [
      { background: "#F0EDE5", ink: "#171717", accent: "#FF4D00", muted: "#888888", paper: "#FFFFFF" },
      { background: "#FFFFFF", ink: "#171717", accent: "#E30613", muted: "#8A8A8A", paper: "#F0EDE5" },
      { background: "#171717", ink: "#F0EDE5", accent: "#FF4D00", muted: "#888888", paper: "#292929" },
    ],
    fonts: { display: "Inter", heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
    weights: { display: 700, heading: 600, body: 400, mono: 500 },
    uppercase: false,
    tracking: -45,
    displayLineHeight: 0.92,
    margin: 0.065,
    preferred: ["swiss", "modular-grid", "asymmetric-editorial", "type-top-image-bottom"],
    texture: null,
    effects: none,
  },
  {
    id: "brutalist",
    name: "Brutalist",
    palettes: [
      { background: "#D9D9D2", ink: "#0A0A0A", accent: "#FF4D00", muted: "#5C5C5C", paper: "#FFFFFF" },
      { background: "#0A0A0A", ink: "#F2F2F2", accent: "#C6FF00", muted: "#7A7A7A", paper: "#1C1C1C" },
    ],
    fonts: { display: "Archivo Black", heading: "Archivo", body: "Space Mono", mono: "Space Mono" },
    weights: { display: 400, heading: 800, body: 400, mono: 400 },
    uppercase: true,
    tracking: -20,
    displayLineHeight: 0.88,
    margin: 0.04,
    preferred: ["experimental-type", "type-top-image-bottom", "modular-grid", "magazine"],
    texture: "noise",
    effects: () => ({ grayscale: 100, contrast: 35 }),
  },
  {
    id: "minimal",
    name: "Minimal",
    palettes: [
      { background: "#F4F2EE", ink: "#1F1F1F", accent: "#9A8F80", muted: "#A3A3A3", paper: "#FFFFFF" },
      { background: "#FFFFFF", ink: "#222222", accent: "#C9C2B8", muted: "#B0B0B0", paper: "#F4F2EE" },
    ],
    fonts: { display: "Manrope", heading: "Manrope", body: "Manrope", mono: "IBM Plex Mono" },
    weights: { display: 300, heading: 500, body: 400, mono: 400 },
    uppercase: false,
    tracking: -30,
    displayLineHeight: 1.0,
    margin: 0.09,
    preferred: ["centered-minimal", "split", "asymmetric-editorial", "full-bleed"],
    texture: null,
    effects: () => ({ saturation: -25 }),
  },
  {
    id: "experimental",
    name: "Experimental",
    palettes: [
      { background: "#E9DAF5", ink: "#171717", accent: "#FF4D00", muted: "#7D6E8A", paper: "#F0EDE5" },
      { background: "#FF4D00", ink: "#171717", accent: "#E9DAF5", muted: "#7A2A00", paper: "#F0EDE5" },
    ],
    fonts: { display: "Syne", heading: "Syne", body: "Space Grotesk", mono: "JetBrains Mono" },
    weights: { display: 800, heading: 700, body: 400, mono: 500 },
    uppercase: true,
    tracking: -30,
    displayLineHeight: 0.86,
    margin: 0.05,
    preferred: ["experimental-type", "vertical-type", "asymmetric-editorial", "modular-grid"],
    texture: "film-grain",
    effects: (p) => ({ duotone: { enabled: true, shadow: p.ink, highlight: p.accent } }),
  },
  {
    id: "japanese",
    name: "Japanese",
    palettes: [
      { background: "#F2EFE8", ink: "#1A1A1A", accent: "#C8102E", muted: "#8C8A85", paper: "#FFFFFF" },
      { background: "#1A1A1A", ink: "#EDEAE3", accent: "#C8102E", muted: "#77746E", paper: "#262626" },
    ],
    fonts: { display: "Zen Kaku Gothic New", heading: "Noto Sans JP", body: "Noto Sans JP", mono: "IBM Plex Mono" },
    weights: { display: 900, heading: 700, body: 400, mono: 400 },
    uppercase: false,
    tracking: 0,
    displayLineHeight: 1.0,
    margin: 0.08,
    preferred: ["vertical-type", "centered-minimal", "split", "asymmetric-editorial"],
    texture: "paper",
    effects: () => ({ saturation: -15 }),
  },
  {
    id: "modernist",
    name: "Modernist",
    palettes: [
      { background: "#EFEBE3", ink: "#1C1C1C", accent: "#1D4ED8", muted: "#8B8B8B", paper: "#FFFFFF" },
      { background: "#1C2B3A", ink: "#F3EFE7", accent: "#F2B705", muted: "#8494A6", paper: "#24364A" },
    ],
    fonts: { display: "Hanken Grotesk", heading: "Hanken Grotesk", body: "Hanken Grotesk", mono: "IBM Plex Mono" },
    weights: { display: 800, heading: 700, body: 400, mono: 500 },
    uppercase: false,
    tracking: -35,
    displayLineHeight: 0.95,
    margin: 0.07,
    preferred: ["asymmetric-editorial", "swiss", "split", "magazine"],
    texture: null,
    effects: none,
  },
  {
    id: "bauhaus",
    name: "Bauhaus",
    palettes: [
      { background: "#F1E9D8", ink: "#1A1A1A", accent: "#D7261E", muted: "#2B59C3", paper: "#F5C518" },
      { background: "#1A1A1A", ink: "#F1E9D8", accent: "#F5C518", muted: "#2B59C3", paper: "#D7261E" },
    ],
    fonts: { display: "Unbounded", heading: "Familjen Grotesk", body: "Familjen Grotesk", mono: "Space Mono" },
    weights: { display: 700, heading: 700, body: 400, mono: 400 },
    uppercase: true,
    tracking: -10,
    displayLineHeight: 0.95,
    margin: 0.06,
    preferred: ["modular-grid", "swiss", "vertical-type", "split"],
    texture: "paper",
    effects: () => ({ contrast: 15 }),
  },
  {
    id: "retro-futurism",
    name: "Retro-Futurism",
    palettes: [
      { background: "#10131F", ink: "#F5E6C8", accent: "#FF6B35", muted: "#5D6B8A", paper: "#1B2033" },
      { background: "#F5E6C8", ink: "#10131F", accent: "#E8452C", muted: "#8A7B66", paper: "#FFF4DE" },
    ],
    fonts: { display: "Big Shoulders Display", heading: "Big Shoulders Display", body: "Space Grotesk", mono: "Space Mono" },
    weights: { display: 800, heading: 700, body: 400, mono: 400 },
    uppercase: true,
    tracking: 10,
    displayLineHeight: 0.88,
    margin: 0.06,
    preferred: ["magazine", "full-bleed", "split", "vertical-type"],
    texture: "scanlines",
    effects: (p) => ({ overlay: { enabled: true, color: p.accent, opacity: 0.22, blend: "soft-light" }, grain: 12 }),
  },
  {
    id: "monochrome",
    name: "Monochrome",
    palettes: [
      { background: "#EDEDED", ink: "#111111", accent: "#111111", muted: "#7A7A7A", paper: "#FFFFFF" },
      { background: "#111111", ink: "#EDEDED", accent: "#EDEDED", muted: "#6F6F6F", paper: "#1E1E1E" },
    ],
    fonts: { display: "Bodoni Moda", heading: "Bodoni Moda", body: "Libre Caslon Text", mono: "IBM Plex Mono" },
    weights: { display: 700, heading: 600, body: 400, mono: 400 },
    uppercase: false,
    tracking: -25,
    displayLineHeight: 0.95,
    margin: 0.075,
    preferred: ["magazine", "full-bleed", "centered-minimal", "asymmetric-editorial"],
    texture: "film-grain",
    effects: () => ({ grayscale: 100, contrast: 20 }),
  },
  {
    id: "acid",
    name: "Acid",
    palettes: [
      { background: "#0B0B0B", ink: "#D4FF00", accent: "#FF2BD6", muted: "#6A6A6A", paper: "#1A1A1A" },
      { background: "#D4FF00", ink: "#0B0B0B", accent: "#7A00FF", muted: "#5B6B00", paper: "#F2FFB3" },
    ],
    fonts: { display: "Unbounded", heading: "Unbounded", body: "Space Grotesk", mono: "JetBrains Mono" },
    weights: { display: 900, heading: 700, body: 400, mono: 500 },
    uppercase: true,
    tracking: -40,
    displayLineHeight: 0.85,
    margin: 0.05,
    preferred: ["experimental-type", "full-bleed", "vertical-type", "magazine"],
    texture: "halftone",
    effects: (p) => ({ duotone: { enabled: true, shadow: p.background, highlight: p.ink }, contrast: 20 }),
  },
];

export function getGenStyle(id: string): GenStyle {
  return GEN_STYLES.find((s) => s.id === id) ?? GEN_STYLES[0];
}

export function styleFontFamilies(id: string): string[] {
  const s = getGenStyle(id);
  return [...new Set([s.fonts.display, s.fonts.heading, s.fonts.body, s.fonts.mono])];
}

const isHex = (c: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());

function saturation(c: string) {
  const { r, g, b } = parseColor(c);
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  return mx === 0 ? 0 : (mx - mn) / mx;
}

/**
 * Resolve the working palette. With user colours, roles are derived from
 * luminance / saturation so the result always has a readable ink; otherwise
 * one of the style palettes is chosen by the seed.
 */
export function resolvePalette(style: GenStyle, user: string[], rng: Rng): GenPalette {
  const base = style.palettes[Math.floor(rng() * style.palettes.length) % style.palettes.length];
  const cols = [...new Set(user.filter(isHex).map((c) => c.toUpperCase()))];
  if (!cols.length) return { ...base };
  const byLum = [...cols].sort((a, b) => luminance(b) - luminance(a));
  const darkBg = luminance(base.background) < 0.2;
  const background = cols.length === 1 ? base.background : darkBg ? byLum[byLum.length - 1] : byLum[0];
  const rest = cols.filter((c) => c !== background);
  const inkCandidates = [...rest, "#171717", "#F0EDE5"];
  let ink = inkCandidates.reduce((best, c) => (contrastRatio(background, c) > contrastRatio(background, best) ? c : best), inkCandidates[0]);
  if (contrastRatio(background, ink) < 4.5) ink = bestContrast(background, ["#171717", "#F0EDE5", "#FFFFFF", "#000000"]);
  const accentPool = rest.filter((c) => c !== ink);
  const accent = accentPool.length
    ? accentPool.reduce((best, c) => (saturation(c) + colorDistance(c, background) / 441 > saturation(best) + colorDistance(best, background) / 441 ? c : best), accentPool[0])
    : cols.length === 1 && cols[0] !== background
      ? cols[0]
      : base.accent;
  return {
    background,
    ink,
    accent,
    muted: mix(ink, background, 0.5),
    paper: mix(background, luminance(background) > 0.5 ? "#FFFFFF" : "#000000", 0.35),
  };
}
