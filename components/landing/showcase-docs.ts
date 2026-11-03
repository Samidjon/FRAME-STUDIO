/**
 * Landing-page showcase. Every visual on the marketing site is a real
 * DesignDocument rendered by the product's own renderer — no stock imagery.
 * Coordinates are composed on explicit grids (noted per document).
 */
import {
  createDocument,
  createImageLayer,
  createShapeLayer,
  createTextLayer,
  createTextureLayer,
  defaultEffects,
  defaultGrid,
} from "@/core/document/factory";
import { computeGrid, spanRect } from "@/core/geometry/grid";
import type { GridSettings } from "@/types/canvas";
import type { ImageEffects, ImageLayer, Layer, ShapeLayer, TextLayer, TextureKind, TextureLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";

export const INK = "#171717";
export const PAPER = "#F0EDE5";
export const ANTH = "#292929";
export const GREY = "#888888";
export const SIGNAL = "#FF4D00";
export const LAV = "#E9DAF5";

/* ---------------------------------------------------------------- helpers */

function txt(W: number, text: string, x: number, y: number, width: number, fontSize: number, o: Partial<TextLayer> = {}): TextLayer {
  return createTextLayer(
    {
      role: "body",
      fontFamily: "Inter",
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: 0,
      uppercase: false,
      fill: INK,
      ...o,
      text,
      x,
      y,
      width,
      fontSize,
    },
    W,
  );
}

function mono(W: number, text: string, x: number, y: number, width: number, size: number, fill: string, o: Partial<TextLayer> = {}) {
  return txt(W, text, x, y, width, size, { role: "metadata", fontFamily: "JetBrains Mono", fontWeight: 500, letterSpacing: 40, uppercase: true, lineHeight: 1.45, fill, ...o });
}

function display(W: number, text: string, x: number, y: number, width: number, size: number, o: Partial<TextLayer> = {}) {
  return txt(W, text, x, y, width, size, { role: "display", fontFamily: "Space Grotesk", fontWeight: 700, lineHeight: 0.88, letterSpacing: -40, ...o });
}

function rect(x: number, y: number, width: number, height: number, fill: string, o: Partial<ShapeLayer> = {}) {
  return createShapeLayer("rect", { x, y, width, height, fill, fillRole: "none", stroke: null, strokeRole: "none", ...o });
}

function circle(x: number, y: number, d: number, fill: string, o: Partial<ShapeLayer> = {}) {
  return createShapeLayer("circle", { x, y, width: d, height: d, fill, fillRole: "none", stroke: null, strokeRole: "none", ...o });
}

function fx(p: Partial<ImageEffects> = {}): ImageEffects {
  return { ...defaultEffects(), ...p };
}
const duo = (shadow: string, highlight: string) => ({ enabled: true, shadow, highlight });

function img(id: string, x: number, y: number, width: number, height: number, effects: Partial<ImageEffects> = {}, o: Partial<ImageLayer> = {}) {
  return createImageLayer(`builtin:${id}`, { x, y, width, height, effects: fx(effects), name: id, ...o });
}

function tex(kind: TextureKind, w: number, h: number, o: Partial<TextureLayer> = {}) {
  return createTextureLayer(kind, w, h, { seed: 7, ...o });
}

function grid(W: number, H: number, g: Partial<GridSettings>): GridSettings {
  return { ...defaultGrid(W, H), ...g };
}

function doc(W: number, H: number, bg: string, g: Partial<GridSettings>, layers: Layer[]): DesignDocument {
  return createDocument(W, H, { background: { color: bg, transparent: false }, grid: grid(W, H, g), layers });
}

/* ------------------------------------------------------------- documents */

/** 01 — Swiss poster. A-series ratio, 12 columns, 60px margins, 20px gutter. */
function swiss(): DesignDocument {
  const W = 1240,
    H = 1754;
  const m = 60;
  const c = (i: number) => m + i * 95; // column i start (75 + 20)
  return doc(W, H, PAPER, { type: "column", columns: 12, gutter: 20, margins: { top: m, right: m, bottom: m, left: m } }, [
    circle(380, 150, 900, SIGNAL, { name: "Sun" }),
    rect(m, m, 1120, 3, INK, { name: "Rule top" }),
    mono(W, "Nº 07\n2027", c(0), 84, 300, 20, INK),
    txt(W, "Internationale\nTypografische\nAusstellung", c(4), 84, 380, 26, { fontWeight: 500, lineHeight: 1.2, letterSpacing: -10 }),
    mono(W, "Zürich\nBasel\nWien", 880, 84, 300, 20, INK, { align: "right" }),
    rect(m, 600, 1120, 2, INK, { name: "Horizon" }),
    txt(W, "Form folgt\nRaster.", c(8), 624, 360, 44, { fontFamily: "Space Grotesk", fontWeight: 500, lineHeight: 1.05, letterSpacing: -20 }),
    display(W, "Raster\nSystem", 48, 1000, 1180, 300, { letterSpacing: -55, lineHeight: 0.84 }),
    rect(m, 1580, 1120, 3, INK, { name: "Rule bottom" }),
    mono(W, "14.03 —\n28.06.2027", c(0), 1604, 340, 20, INK),
    txt(W, "Kunstgewerbemuseum\nAusstellungsstrasse 60, Zürich", c(4), 1604, 440, 22, { lineHeight: 1.3 }),
    mono(W, "Eintritt\nfrei", 880, 1604, 300, 20, INK, { align: "right" }),
  ]);
}

/** 02 — Japanese editorial on the red dune. 1080×1350, 48px margins. */
function dune(): DesignDocument {
  const W = 1080,
    H = 1350;
  return doc(W, H, INK, { type: "modular", columns: 6, rows: 8, gutter: 24, margins: { top: 48, right: 48, bottom: 48, left: 48 } }, [
    img("dune", 0, 0, W, H, { grain: 16, contrast: 6 }),
    mono(W, "Cat. Nº 0417—B\n24°45′12″N  55°19′48″E\nElev. 212 m", 48, 52, 520, 15, PAPER),
    circle(700, 300, 54, PAPER, { name: "Sun" }),
    txt(W, "砂丘の記憶", 960, 52, 72, 64, { fontFamily: "Noto Serif JP", fontWeight: 600, vertical: true, letterSpacing: 150, lineHeight: 1, fill: PAPER }),
    txt(W, "第七号・二〇二七", 922, 58, 24, 20, { fontFamily: "Noto Sans JP", fontWeight: 500, vertical: true, letterSpacing: 300, lineHeight: 1, fill: PAPER }),
    rect(48, 900, 16, 16, SIGNAL, { name: "Signal" }),
    display(W, "Sand\nMemory", 44, 930, 900, 168, { fontWeight: 600, letterSpacing: -45, fill: PAPER }),
    rect(48, 1268, 984, 1.5, PAPER, { opacity: 0.6 }),
    mono(W, "Edition 07 — Rub al Khali", 48, 1284, 600, 14, PAPER),
    mono(W, "2027 / 04", 780, 1284, 252, 14, PAPER, { align: "right" }),
  ]);
}

/** 03 — Album cover, square. Halftone disc over duotone chrome. */
function album(): DesignDocument {
  const W = 1500,
    H = 1500;
  return doc(W, H, INK, { type: "modular", columns: 4, rows: 4, gutter: 32, margins: { top: 64, right: 64, bottom: 64, left: 64 } }, [
    img("chrome", 0, 0, W, H, { duotone: duo("#0E0E0E", LAV), contrast: 10, brightness: -32 }),
    img("chrome", 370, 330, 760, 760, { contrast: 20, halftone: { enabled: true, size: 7, angle: 30, color: INK } }, { mask: "circle", flipX: true }),
    display(W, "KAIRO", 60, 56, 900, 190, { letterSpacing: -50, fill: PAPER }),
    mono(W, "LP—012\nSide A / B\n33 RPM", 1036, 68, 400, 22, PAPER, { align: "right" }),
    txt(W, "Liquid State", 60, 1240, 900, 120, { fontFamily: "Instrument Serif", italic: true, lineHeight: 1, letterSpacing: -10, fill: PAPER }),
    mono(W, "01 Mercury\n02 Surface Tension\n03 Reflow\n04 Coldplate", 1036, 1284, 400, 18, PAPER, { align: "right", lineHeight: 1.6 }),
    rect(64, 1404, 28, 28, SIGNAL, { name: "Signal" }),
  ]);
}

/** 04 — Brutalist type poster. Condensed caps set solid. */
function brutal(): DesignDocument {
  const W = 1080,
    H = 1350;
  return doc(W, H, SIGNAL, { type: "column", columns: 4, gutter: 24, margins: { top: 36, right: 36, bottom: 36, left: 36 } }, [
    img("concrete", 0, 900, W, 450, { duotone: duo(INK, SIGNAL), contrast: 20 }),
    tex("halftone", W, H, { opacity: 0.16, blendMode: "multiply", color: INK, scale: 1.2 }),
    txt(W, "Make\nit\nlouder", 36, 36, 1010, 320, { fontFamily: "Anton", uppercase: true, lineHeight: 0.84, letterSpacing: -5 }),
    mono(W, "Manifesto Nº 3\nBrutalist type series\n2027", 600, 340, 420, 20, INK),
    rect(36, 868, 1008, 8, INK),
    mono(W, "No decoration without function", 36, 1290, 700, 18, PAPER),
    mono(W, "FS—003", 760, 1290, 284, 18, PAPER, { align: "right" }),
  ]);
}

/** 05 — Desktop wallpaper, 16:9. */
function ridges(): DesignDocument {
  const W = 1920,
    H = 1080;
  return doc(W, H, INK, { type: "column", columns: 12, gutter: 24, margins: { top: 56, right: 64, bottom: 56, left: 64 } }, [
    img("ridges", 0, 0, W, H, { grain: 8 }),
    mono(W, "46.5583° N / 8.5611° E", 64, 56, 700, 18, INK),
    mono(W, "Alt. 3 454 m", 1256, 56, 600, 18, INK, { align: "right" }),
    display(W, "Altitude", 56, 850, 1000, 160, { fontWeight: 500, letterSpacing: -45, lineHeight: 0.9, fill: PAPER }),
    mono(W, "Frame/WP—03\n3840 × 2160", 1256, 950, 600, 18, PAPER, { align: "right" }),
  ]);
}

/** 06 — Event poster on lavender. */
function event(): DesignDocument {
  const W = 1080,
    H = 1350;
  const rows = [
    ["19:00", "Opening — The Grid as Ethic", "Hall A"],
    ["20:15", "Type Specimens, Live", "Hall B"],
    ["21:30", "Night Composition", "Roof"],
  ];
  const programme: Layer[] = rows.flatMap(([t, n, v], i) => {
    const y = 1110 + i * 54;
    return [
      ...(i ? [rect(48, y - 8, 984, 1, INK, { opacity: 0.35 })] : []),
      mono(W, t, 48, y + 6, 160, 17, INK),
      txt(W, n, 220, y, 520, 24, { fontWeight: 500, letterSpacing: -10 }),
      mono(W, v, 760, y + 6, 272, 17, INK, { align: "right" }),
    ];
  });
  return doc(W, H, LAV, { type: "modular", columns: 6, rows: 8, gutter: 24, margins: { top: 48, right: 48, bottom: 48, left: 48 } }, [
    img("orbit", 440, 120, 600, 600, { duotone: duo(INK, SIGNAL), contrast: 10 }, { mask: "circle" }),
    mono(W, "Vol. 09 — Fri 12.11.2027 — 19:00", 48, 48, 640, 17, INK),
    mono(W, "Free entry", 760, 48, 272, 17, INK, { align: "right" }),
    rect(48, 84, 984, 2, INK),
    txt(W, "文字の夜", 52, 130, 80, 72, { fontFamily: "Noto Sans JP", fontWeight: 900, vertical: true, letterSpacing: 100, lineHeight: 1 }),
    display(W, "Typo\nNight", 40, 660, 1000, 240, { letterSpacing: -55, lineHeight: 0.84 }),
    rect(48, 1092, 984, 2, INK),
    ...programme,
  ]);
}

/** 07 — Smartphone wallpaper. */
function neon(): DesignDocument {
  const W = 1179,
    H = 2556;
  return doc(W, H, INK, { type: "column", columns: 4, gutter: 24, margins: { top: 90, right: 90, bottom: 90, left: 90 } }, [
    img("neon", 0, 0, W, H, { grain: 18, contrast: 10 }),
    tex("film-grain", W, H, { opacity: 0.3, blendMode: "overlay", color: INK, seed: 11 }),
    mono(W, "Wed 03 Nov — Shibuya", 90, 250, 800, 30, PAPER),
    txt(W, "21:47", 76, 300, 1020, 280, { fontFamily: "Space Grotesk", fontWeight: 300, letterSpacing: -40, lineHeight: 1, fill: PAPER }),
    txt(W, "渋谷夜景", 1000, 1500, 100, 96, { fontFamily: "Noto Sans JP", fontWeight: 700, vertical: true, letterSpacing: 100, lineHeight: 1, fill: PAPER }),
    rect(90, 2360, 48, 6, SIGNAL),
    mono(W, "FS/PH—11   1179 × 2556", 90, 2400, 900, 24, PAPER),
  ]);
}

/** 08 — Typographic study, square. Baseline computed from the text layout model. */
function typeStudy(): DesignDocument {
  const W = 1080,
    H = 1080;
  const size = 760;
  const top = 80;
  const baseline = top + (size * 1) / 2 + size * 0.34; // layoutText: top + lineAdvance/2 + size·BASELINE_SHIFT
  return doc(W, H, PAPER, { type: "baseline", columns: 6, gutter: 24, baseline: 24, margins: { top: 48, right: 48, bottom: 48, left: 48 } }, [
    mono(W, "Typographic study Nº 12", 48, 48, 600, 16, INK),
    mono(W, "Instrument Serif — Italic", 532, 48, 500, 16, INK, { align: "right" }),
    rect(48, 80, 984, 2, INK),
    txt(W, "Ag", 70, top, 960, size, { fontFamily: "Instrument Serif", italic: true, lineHeight: 1, letterSpacing: -20 }),
    rect(48, baseline - 1, 984, 2, SIGNAL, { name: "Baseline" }),
    mono(W, "Baseline", 912, baseline + 10, 120, 13, SIGNAL, { align: "right" }),
    rect(48, 950, 984, 1, INK, { opacity: 0.4 }),
    txt(W, "abcdefghijklmnopqrstuvwxyz 0123456789 — ÆØ &", 48, 966, 984, 22, { lineHeight: 1.3 }),
    mono(W, "Size 760 / Leading 1.00 / Tracking −20", 48, 1008, 984, 14, GREY),
  ]);
}

/** 09 — Campaign post, paper fold. */
function fold(): DesignDocument {
  const W = 1080,
    H = 1350;
  return doc(W, H, PAPER, { type: "modular", columns: 6, rows: 8, gutter: 24, margins: { top: 48, right: 48, bottom: 48, left: 48 } }, [
    img("fold", 0, 0, W, H, { contrast: 10 }),
    txt(W, "Paper\nWorks.", 44, 60, 1000, 190, { fontFamily: "Archivo Black", lineHeight: 0.9, letterSpacing: -30 }),
    txt(W, "New collection", 48, 440, 214, 22, { fontWeight: 600, fill: PAPER, backgroundColor: SIGNAL, backgroundPadding: 12 }),
    mono(W, "Spring / Summer 2027 — 12 objects in folded paper", 48, 1270, 800, 16, INK),
    mono(W, "FS—C04", 800, 1270, 232, 16, INK, { align: "right" }),
  ]);
}

/** 10 — Campaign story, 9:16. */
function bloom(): DesignDocument {
  const W = 1080,
    H = 1920;
  return doc(W, H, PAPER, { type: "modular", columns: 6, rows: 12, gutter: 24, margins: { top: 56, right: 56, bottom: 56, left: 56 } }, [
    img("bloom", 0, 0, W, 1180, { grain: 14 }),
    mono(W, "Campaign — 2027", 56, 56, 600, 22, PAPER),
    display(W, "Colour is\na signal.", 52, 1240, 980, 150, { letterSpacing: -45, lineHeight: 0.9 }),
    txt(W, "A seasonal identity built from one gradient, one typeface and one rule.", 56, 1580, 640, 30, { lineHeight: 1.35, letterSpacing: -5 }),
    rect(56, 1780, 968, 2, INK),
    mono(W, "FS/ST—09", 56, 1800, 400, 20, INK),
    mono(W, "1080 × 1920", 624, 1800, 400, 20, INK, { align: "right" }),
  ]);
}

/* -------------------------------------------------------------- registry */

export interface ShowcaseItem {
  id: string;
  title: string;
  kind: string;
  format: string;
  dims: string;
  grid: string;
  fonts: string;
  alt: string;
  build: () => DesignDocument;
}

export const SHOWCASE: ShowcaseItem[] = [
  { id: "swiss", title: "Raster System", kind: "Poster", format: "A3 Poster", dims: "3508 × 4961", grid: "12 col · column", fonts: "Space Grotesk / Inter / JetBrains Mono", alt: "Swiss poster with a large orange circle, a horizon rule and the words Raster System set huge in black.", build: swiss },
  { id: "dune", title: "Sand Memory", kind: "Editorial", format: "Portrait 4:5", dims: "1080 × 1350", grid: "6 × 8 · modular", fonts: "Space Grotesk / Noto Serif JP", alt: "Editorial cover: a red dune under a teal sky with vertical Japanese type and catalogue coordinates.", build: dune },
  { id: "album", title: "Liquid State", kind: "Album cover", format: "Album 1:1", dims: "3000 × 3000", grid: "4 × 4 · modular", fonts: "Space Grotesk / Instrument Serif", alt: "Album cover: a halftone chrome disc on a dark lavender duotone field, titled KAIRO, Liquid State.", build: album },
  { id: "brutal", title: "Make It Louder", kind: "Type poster", format: "Portrait 4:5", dims: "1080 × 1350", grid: "4 col · column", fonts: "Anton / JetBrains Mono", alt: "Brutalist orange poster with condensed black capitals reading Make it louder over a duotone concrete strip.", build: brutal },
  { id: "ridges", title: "Altitude", kind: "Wallpaper", format: "Desktop 16:9", dims: "3840 × 2160", grid: "12 col · column", fonts: "Space Grotesk / JetBrains Mono", alt: "Desktop wallpaper of layered mountain ridges with coordinates and the word Altitude.", build: ridges },
  { id: "event", title: "Typo Night", kind: "Event poster", format: "Portrait 4:5", dims: "1080 × 1350", grid: "6 × 8 · modular", fonts: "Space Grotesk / Noto Sans JP / Inter", alt: "Lavender event poster with an orange duotone orbit disc, vertical Japanese type and a programme table.", build: event },
  { id: "neon", title: "Shibuya 21:47", kind: "Phone wallpaper", format: "Smartphone", dims: "1179 × 2556", grid: "4 col · column", fonts: "Space Grotesk / Noto Sans JP", alt: "Phone wallpaper of night bokeh with a large thin clock and vertical Japanese characters.", build: neon },
  { id: "type", title: "Study Nº 12", kind: "Typographic study", format: "Square 1:1", dims: "1080 × 1080", grid: "24px baseline", fonts: "Instrument Serif / Inter", alt: "Typographic study: a giant italic Ag with an orange baseline rule and a specimen line.", build: typeStudy },
  { id: "fold", title: "Paper Works", kind: "Campaign", format: "Portrait 4:5", dims: "1080 × 1350", grid: "6 × 8 · modular", fonts: "Archivo Black / Inter", alt: "Campaign post: folded white paper with heavy black type Paper Works and an orange tag.", build: fold },
  { id: "bloom", title: "Colour Is a Signal", kind: "Campaign story", format: "Story 9:16", dims: "1080 × 1920", grid: "6 × 12 · modular", fonts: "Space Grotesk / Inter", alt: "Vertical campaign story: an orange and lavender colour bloom above the headline Colour is a signal.", build: bloom },
];

const cache = new Map<string, DesignDocument>();
/** Memoised document for a showcase id (stable object identity keeps DocPreview effects quiet). */
export function showcaseDoc(id: string): DesignDocument {
  let d = cache.get(id);
  if (!d) {
    const item = SHOWCASE.find((s) => s.id === id) ?? SHOWCASE[0];
    d = item.build();
    cache.set(id, d);
  }
  return d;
}
export const showcaseItem = (id: string) => SHOWCASE.find((s) => s.id === id) ?? SHOWCASE[0];

/* ------------------------------------------------- composition generator */

export interface Palette {
  id: string;
  name: string;
  bg: string;
  ink: string;
  accent: string;
}

export const PALETTES: Palette[] = [
  { id: "paper", name: "Paper / Signal", bg: PAPER, ink: INK, accent: SIGNAL },
  { id: "night", name: "Ink / Lavender", bg: INK, ink: PAPER, accent: LAV },
  { id: "lavender", name: "Lavender / Ink", bg: LAV, ink: INK, accent: SIGNAL },
  { id: "concrete", name: "Sunken / Anthracite", bg: "#E6E2D8", ink: ANTH, accent: SIGNAL },
];

export const VARIANT_NAMES = ["Image top", "Rotated spine", "Centred disc", "Ink block", "Bleed left", "Duotone field"];

const GW = 1080;
const GH = 1350;
const GEN_GRID: GridSettings = grid(GW, GH, { type: "modular", columns: 6, rows: 8, gutter: 24, margins: { top: 60, right: 60, bottom: 60, left: 60 } });

/**
 * Six algorithmic layouts of identical content. Every block is placed by
 * spanRect() on the same computed 6 × 8 modular grid.
 */
export function generatorDoc(variant: number, pal: Palette): DesignDocument {
  const geo = computeGrid(GW, GH, GEN_GRID);
  const s = (c0: number, c1: number, r0: number, r1: number) => spanRect(geo, c0, c1, r0, r1);
  const { content } = geo;
  const title = "Horizon";
  const sub = "Studies in light";
  const meta = "Nº 04 — 2027";
  const darkInk = pal.ink === PAPER ? INK : pal.ink;
  let bg = pal.bg;
  let layers: Layer[] = [];

  switch (variant % 6) {
    case 0: {
      const im = s(0, 5, 0, 4);
      const t = s(0, 5, 5, 6);
      const f = s(0, 5, 7, 7);
      layers = [
        img("horizon", im.x, im.y, im.width, im.height, { grain: 8 }),
        display(GW, title, t.x - 6, t.y + 10, t.width + 12, 200, { fill: pal.ink, letterSpacing: -50 }),
        mono(GW, meta, f.x, f.y + f.height - 24, 400, 18, pal.ink),
        mono(GW, sub, s(3, 3, 7, 7).x, f.y + f.height - 24, 460, 18, pal.ink),
        rect(f.x, f.y + f.height - 48, f.width, 2, pal.accent),
      ];
      break;
    }
    case 1: {
      const im = s(2, 5, 0, 7);
      const top = s(0, 1, 0, 0);
      layers = [
        img("horizon", im.x, im.y, im.width, im.height, { grain: 8, contrast: 6 }),
        display(GW, title, content.x - 8, content.y + content.height, content.height, 200, { rotation: -90, fill: pal.ink, letterSpacing: -50 }),
        mono(GW, `${meta}\n${sub}`, top.x, top.y, top.width, 16, pal.ink),
        rect(top.x, top.y + 72, 40, 40, pal.accent),
      ];
      break;
    }
    case 2: {
      const area = s(1, 4, 1, 5);
      const d = Math.min(area.width, area.height);
      const cx0 = GW / 2 - d / 2;
      layers = [
        display(GW, title, content.x, content.y, content.width, 120, { align: "center", fill: pal.ink, letterSpacing: -40 }),
        img("horizon", cx0, area.y + (area.height - d) / 2, d, d, { grain: 10, contrast: 8 }, { mask: "circle" }),
        txt(GW, sub, content.x, s(0, 5, 6, 6).y + 16, content.width, 40, { align: "center", fontFamily: "Instrument Serif", italic: true, fill: pal.ink }),
        rect(GW / 2 - 1, s(0, 5, 7, 7).y, 2, 56, pal.accent),
        mono(GW, meta, content.x, content.y + content.height - 24, content.width, 18, pal.ink, { align: "center" }),
      ];
      break;
    }
    case 3: {
      bg = darkInk;
      const light = pal.ink === PAPER ? PAPER : pal.bg;
      const im = s(3, 5, 0, 2);
      const t = s(0, 5, 5, 7);
      layers = [
        img("horizon", im.x, im.y, im.width, im.height, { duotone: duo(darkInk, pal.accent), grain: 6 }),
        mono(GW, `${sub}\n${meta}`, content.x, content.y, s(0, 2, 0, 0).width, 18, light),
        display(GW, title, t.x - 8, t.y + t.height - 220, t.width + 16, 230, { fill: light, letterSpacing: -55 }),
        rect(content.x, t.y - 24, content.width, 2, light, { opacity: 0.5 }),
      ];
      break;
    }
    case 4: {
      const right = s(3, 5, 0, 7);
      layers = [
        img("horizon", 0, 0, GW / 2, GH, { grain: 8, contrast: 6 }),
        display(GW, title, right.x - 4, right.y, right.width, 110, { fill: pal.ink, letterSpacing: -45 }),
        txt(GW, sub, right.x, s(3, 5, 2, 2).y, right.width, 34, { fontFamily: "Instrument Serif", italic: true, fill: pal.ink }),
        rect(right.x, s(3, 5, 6, 6).y, 24, 24, pal.accent),
        mono(GW, meta, right.x, right.y + right.height - 24, right.width, 18, pal.ink),
      ];
      break;
    }
    default: {
      const t = s(0, 5, 6, 7);
      const lines: Layer[] = geo.columns.slice(1).map((c) => rect(c.start - 12, 0, 1, GH, pal.bg === INK ? PAPER : pal.bg, { opacity: 0.35 }));
      layers = [
        img("horizon", 0, 0, GW, GH, { duotone: duo(darkInk, pal.accent), contrast: 12, grain: 10 }),
        ...lines,
        mono(GW, meta, content.x, content.y, 400, 18, PAPER),
        mono(GW, sub, s(3, 5, 0, 0).x, content.y, s(3, 5, 0, 0).width, 18, PAPER, { align: "right" }),
        display(GW, title, t.x - 8, t.y + t.height - 230, t.width + 16, 240, { fill: PAPER, letterSpacing: -55 }),
      ];
    }
  }
  return createDocument(GW, GH, { background: { color: bg, transparent: false }, grid: GEN_GRID, layers });
}
