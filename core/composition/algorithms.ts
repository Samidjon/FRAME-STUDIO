import type { Rect } from "@/types/canvas";
import { PHI, spanRect } from "@/core/geometry/grid";
import { luminance } from "@/core/rendering/color";
import type { AlgorithmId } from "./types";
import {
  accentOn,
  addImage,
  addLogo,
  addRect,
  addRule,
  addTexture,
  fitText,
  inkOn,
  makeGrid,
  marginPx,
  metaRow,
  paint,
  rectBottom,
  rectRight,
  scrimFor,
  sizes,
  textStack,
  type Comp,
  type Ctx,
} from "./kit";

/**
 * The ten composition algorithms. Each one builds its own grid, places
 * elements by spanning modules, applies a type hierarchy and picks colours by
 * contrast against whatever is beneath. All randomness comes from ctx.rng.
 */

const R = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Split body copy into two balanced halves at a sentence or word boundary. */
function splitCopy(text: string): [string, string] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  if (sentences.length > 1) {
    const half = text.length / 2;
    let acc = "";
    let i = 0;
    while (i < sentences.length - 1 && acc.length + sentences[i].length <= half + 20) acc += sentences[i++];
    if (acc.trim()) return [acc.trim(), sentences.slice(i).join("").trim()];
  }
  const words = text.split(/\s+/);
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

// 01 ─ Large typography top / image bottom ───────────────────────────────────
export function typeTopImageBottom(c: Ctx): Comp {
  const S = sizes(c);
  const land = c.orientation === "landscape";
  const cols = land ? 12 : 6;
  const rows = land ? 6 : c.variant ? 10 : 8;
  const { settings, geo } = makeGrid(c, { type: "modular", columns: cols, rows });
  const ct = geo.content;
  const bg = c.pal.background;
  const g = settings.gutter;

  const hb = Math.ceil(S.meta * (c.logo ? 2.6 : 1.5));
  metaRow(c, R(ct.x, ct.y, c.logo ? ct.width * 0.72 : ct.width, hb), c.meta.slice(0, c.logo ? 2 : 3), bg);
  addLogo(c, R(ct.x + ct.width * 0.8, ct.y, ct.width * 0.2, hb), "right", "center");
  addRule(c, ct.x, ct.y + hb + g / 2, ct.width, paint(c, "ink"), S.hair, "Header rule");

  const titleRows = land ? 3 : Math.max(3, Math.round(rows * (0.36 + 0.1 * (1 - c.density))));
  const tEnd = spanRect(geo, 0, cols - 1, 0, titleRows - 1);
  const titleBox = R(ct.x, ct.y + hb + g, ct.width, rectBottom(tEnd) - (ct.y + hb + g));
  fitText(c, { name: "Title", text: c.title, role: "display", kind: "display", box: titleBox, maxSize: S.display, minSize: S.minDisplay, vAlign: "bottom", under: bg });

  const half = Math.floor(cols / 2);
  const subBox = spanRect(geo, 0, half - 1, titleRows, titleRows);
  const bodyBox = spanRect(geo, half, cols - 1, titleRows, titleRows);
  // A short accent bar marks the start of the reading row.
  const bar = Math.max(2, Math.round(S.hair * 3));
  addRect(c, R(subBox.x, subBox.y, subBox.width * 0.18, bar), accentOn(c, bg), { name: "Accent bar" });
  fitText(c, { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "heading", box: R(subBox.x, subBox.y + bar * 3, subBox.width, subBox.height - bar * 3), maxSize: S.sub, minSize: S.minSub, under: bg });
  fitText(c, { name: "Body", text: c.body, role: "body", kind: "body", box: bodyBox, maxSize: S.body, minSize: S.minBody, under: bg });

  const imgR = spanRect(geo, 0, cols - 1, titleRows + 1, rows - 1);
  const bleed = c.rng() < 0.3 + 0.5 * c.asymmetry;
  addImage(c, bleed ? R(0, imgR.y, c.W, c.H - imgR.y) : imgR, { name: "Hero image" });
  addTexture(c, 0.4);
  return { grid: settings, background: bg };
}

// 02 ─ Full-bleed image ───────────────────────────────────────────────────────
export function fullBleed(c: Ctx): Comp {
  const S = sizes(c);
  const land = c.orientation === "landscape";
  const cols = land ? 8 : 4;
  const rows = land ? 4 : 8;
  const { settings, geo } = makeGrid(c, { type: "modular", columns: cols, rows });
  const ct = geo.content;
  addImage(c, R(0, 0, c.W, c.H), { name: "Full-bleed image" });

  const top = c.variant === 1 || c.rng() < 0.25 * c.asymmetry;
  const zoneRows = land ? 2 : c.density > 0.6 ? 4 : 3;
  const zoneCols = land ? 5 : cols - 1;
  const zone = top ? spanRect(geo, 0, zoneCols - 1, 1, zoneRows) : spanRect(geo, 0, zoneCols - 1, rows - zoneRows, rows - 1);
  const sc = scrimFor(c);
  const pad = marginPx(c, 0.6);
  const scrimRect = top ? R(0, 0, c.W, rectBottom(zone) + pad) : R(0, zone.y - pad, c.W, c.H - zone.y + pad);
  addRect(c, scrimRect, sc.paint, { name: "Scrim", opacity: sc.opacity });

  const fill = inkOn(c, sc.effective, ["paper", "background", "ink"]);
  textStack(
    c,
    zone,
    [
      { name: "Title", text: c.title, role: "display", kind: "display", maxSize: S.display, minSize: S.minDisplay, under: sc.effective, fill, share: 3 },
      { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "heading", maxSize: S.sub, minSize: S.minSub, under: sc.effective, fill, share: 1 },
      { name: "Body", text: c.density > 0.25 ? c.body : "", role: "body", kind: "body", maxSize: S.body, minSize: S.minBody, under: sc.effective, fill, share: 1 },
    ],
    { vAlign: top ? "top" : "bottom" },
  );

  // Metadata as label chips — legible on any image.
  const chip = { ...paint(c, luminance(c.pal.paper) > 0.5 ? "paper" : "ink"), padding: Math.round(S.meta * 0.5) };
  const chipH = Math.ceil(S.meta * 2.4);
  const chipY = top ? ct.y + ct.height - chipH : ct.y;
  fitText(c, { name: "Meta 1", text: c.meta[0], role: "metadata", kind: "mono", box: R(ct.x, chipY, ct.width * 0.45, chipH), maxSize: S.meta, minSize: S.minMeta, under: chip.color, chip, hug: true, vAlign: "center" });
  fitText(c, { name: "Meta 2", text: c.meta[1], role: "metadata", kind: "mono", box: R(ct.x + ct.width * 0.55, chipY, ct.width * 0.45, chipH), maxSize: S.meta, minSize: S.minMeta, under: chip.color, chip, hug: true, align: "right", vAlign: "center" });

  const logoCol = spanRect(geo, cols - 1, cols - 1, top ? 1 : rows - 1, top ? 1 : rows - 1);
  addLogo(c, R(logoCol.x, logoCol.y, logoCol.width, Math.min(logoCol.height, c.unit * 0.09)), "right", top ? "top" : "bottom");
  return { grid: settings, background: c.pal.ink };
}

// 03 ─ Asymmetric editorial ──────────────────────────────────────────────────
export function asymmetricEditorial(c: Ctx): Comp {
  const S = sizes(c);
  const land = c.orientation === "landscape";
  const ratio = c.asymmetry > 0.55 ? PHI * PHI : PHI;
  const narrowRight = c.variant === 1 || c.rng() < 0.3 * c.asymmetry;
  const columnRatios = narrowRight ? [ratio, 1] : [1, ratio];
  const rows = land ? 6 : 12;
  const { settings, geo } = makeGrid(c, { type: "asymmetrical", columns: 2, rows, columnRatios });
  const bg = c.pal.background;
  const n = narrowRight ? 1 : 0;
  const w = narrowRight ? 0 : 1;

  const imgRows = land ? 4 : c.density > 0.5 ? 6 : 7;
  const img = spanRect(geo, w, w, 0, imgRows - 1);
  addImage(c, img, { name: "Editorial image" });
  const titleBox = spanRect(geo, w, w, imgRows, rows - 1);
  fitText(c, { name: "Title", text: c.title, role: "display", kind: "display", box: titleBox, maxSize: S.display, minSize: S.minDisplay, vAlign: "bottom", under: bg });

  const col = spanRect(geo, n, n, 0, rows - 1);
  const metaH = Math.ceil(S.meta * 3.2);
  textStack(
    c,
    R(col.x, col.y, col.width, metaH),
    [
      { name: "Meta 1", text: c.meta[0], role: "metadata", kind: "mono", maxSize: S.meta, minSize: S.minMeta, under: bg, share: 1, fill: accentOn(c, bg) },
      { name: "Meta 2", text: c.meta[1], role: "metadata", kind: "mono", maxSize: S.meta, minSize: S.minMeta, under: bg, share: 1 },
    ],
    { gap: Math.round(S.meta * 0.3) },
  );
  const barY = col.y + metaH + S.gap;
  addRect(c, R(col.x, barY, Math.max(4, col.width * 0.35), Math.max(2, S.hair * 4)), accentOn(c, bg), { name: "Accent bar" });
  const logoH = c.logo ? Math.min(col.width * 0.6, c.unit * 0.09) : 0;
  const stackTop = barY + S.gap * 2;
  const stackBottom = rectBottom(col) - (logoH ? logoH + S.gap * 2 : 0);
  textStack(
    c,
    R(col.x, stackTop, col.width, stackBottom - stackTop),
    [
      { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "heading", maxSize: S.sub, minSize: S.minSub, under: bg, share: 1.2 },
      { name: "Body", text: c.body, role: "body", kind: "body", maxSize: S.body, minSize: S.minBody, under: bg, share: 2 },
    ],
    { vAlign: c.asymmetry > 0.5 ? "bottom" : "top", gap: S.gap * 1.5 },
  );
  if (logoH) addLogo(c, R(col.x, rectBottom(col) - logoH, col.width, logoH), "left", "bottom");
  return { grid: settings, background: bg };
}

// 04 ─ Modular grid composition ───────────────────────────────────────────────
type Cell = [number, number, number, number]; // c0, c1, r0, r1 in portrait 4 × 6 space
interface Pattern {
  image: Cell;
  title: Cell;
  subtitle: Cell;
  body: Cell;
  accent: Cell;
}
const MODULAR_PATTERNS: Pattern[] = [
  { image: [1, 3, 0, 2], accent: [0, 0, 0, 1], title: [0, 3, 3, 4], subtitle: [0, 1, 5, 5], body: [2, 3, 5, 5] },
  { title: [0, 3, 0, 1], image: [0, 1, 2, 5], accent: [2, 3, 2, 2], subtitle: [2, 3, 3, 3], body: [2, 3, 4, 5] },
  { image: [0, 3, 0, 3], title: [0, 2, 4, 4], accent: [3, 3, 4, 5], subtitle: [0, 1, 5, 5], body: [2, 2, 5, 5] },
];

export function modularGrid(c: Ctx): Comp {
  const S = sizes(c);
  const land = c.orientation === "landscape";
  const cols = land ? 6 : 4;
  const rows = land ? 4 : 6;
  const { settings, geo } = makeGrid(c, { type: "modular", columns: cols, rows, margin: 0.9 });
  const bg = c.pal.background;
  const p = MODULAR_PATTERNS[(Math.floor(c.rng() * MODULAR_PATTERNS.length) + c.variant) % MODULAR_PATTERNS.length];
  // Landscape transposes the portrait pattern (columns ↔ rows).
  const at = (cell: Cell) => (land ? spanRect(geo, cell[2], cell[3], cell[0], cell[1]) : spanRect(geo, cell[0], cell[1], cell[2], cell[3]));

  addImage(c, at(p.image), { name: "Module image" });
  const acc = at(p.accent);
  addRect(c, acc, paint(c, "accent"), { name: "Accent module" });
  const inner = Math.round(S.gap * 0.8);
  metaRow(c, R(acc.x + inner, acc.y + inner, acc.width - inner * 2, Math.ceil(S.meta * 1.6)), [c.meta[0]], c.pal.accent);
  if (c.logo) addLogo(c, R(acc.x + inner, rectBottom(acc) - inner - Math.min(acc.height * 0.35, c.unit * 0.08), acc.width - inner * 2, Math.min(acc.height * 0.35, c.unit * 0.08)), "left", "bottom");
  else metaRow(c, R(acc.x + inner, rectBottom(acc) - inner - Math.ceil(S.meta * 1.6), acc.width - inner * 2, Math.ceil(S.meta * 1.6)), [c.meta[2]], c.pal.accent);

  fitText(c, { name: "Title", text: c.title, role: "display", kind: "display", box: at(p.title), maxSize: S.display, minSize: S.minDisplay, vAlign: "top", under: bg });
  fitText(c, { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "heading", box: at(p.subtitle), maxSize: S.sub, minSize: S.minSub, under: bg });
  fitText(c, { name: "Body", text: c.body, role: "body", kind: "body", box: at(p.body), maxSize: S.body, minSize: S.minBody, under: bg });
  // Hairline module frame on the remaining empty modules: makes the grid legible.
  if (c.density > 0.45) {
    const ct = geo.content;
    addRect(c, ct, paint(c, "ink"), { name: "Grid frame", noFill: true, stroke: { ...paint(c, "muted"), width: S.hair } });
  }
  return { grid: settings, background: bg };
}

// 05 ─ Centered minimalism ────────────────────────────────────────────────────
export function centeredMinimal(c: Ctx): Comp {
  const S = sizes(c);
  const land = c.orientation === "landscape";
  const { settings, geo } = makeGrid(c, { type: "symmetrical", columns: land ? 8 : 6, rows: land ? 6 : 9, margin: 1.35 });
  const ct = geo.content;
  const bg = c.pal.background;
  const metaH = Math.ceil(S.meta * 1.6);
  metaRow(c, R(ct.x, ct.y, ct.width, metaH), [c.meta[1]], bg).forEach((l) => {
    l.align = "center";
    l.x = c.W / 2 - l.width / 2;
  });
  const footer = R(ct.x, rectBottom(ct) - metaH, ct.width, metaH);
  if (c.logo) addLogo(c, R(c.W / 2 - ct.width * 0.1, rectBottom(ct) - c.unit * 0.06, ct.width * 0.2, c.unit * 0.06), "center", "bottom");
  else
    metaRow(c, footer, [c.meta[0]], bg).forEach((l) => {
      l.x = c.W / 2 - l.width / 2;
    });
  const footH = c.logo ? c.unit * 0.06 : metaH;
  const mid = R(ct.x, ct.y + metaH + S.gap * 2, ct.width, ct.height - metaH - footH - S.gap * 4);

  const circle = c.rng() < (c.style.id === "japanese" || c.style.id === "minimal" ? 0.5 : 0.2);
  const imgH = mid.height * (land ? 0.52 : 0.5);
  const imgW = circle ? imgH : Math.min(ct.width * (land ? 0.42 : 0.62), land ? imgH * 1.3 : imgH * 0.8);
  const ih = circle ? imgW : imgH;
  // Variant 1 inverts the reading order: type above, image below.
  const textFirst = c.variant === 1;
  const imgY = textFirst ? rectBottom(mid) - ih : mid.y;
  addImage(c, R(c.W / 2 - imgW / 2, imgY, imgW, ih), { name: "Centered image", mask: circle ? "circle" : "none" });
  const textTop = textFirst ? mid.y : mid.y + ih + S.gap * 2.5;
  const textBottom = textFirst ? imgY - S.gap * 2.5 : rectBottom(mid);
  const textW = ct.width * (land ? 0.6 : 0.86);
  textStack(
    c,
    R(c.W / 2 - textW / 2, textTop, textW, textBottom - textTop),
    [
      { name: "Title", text: c.title, role: "display", kind: "display", maxSize: S.display * 0.6, minSize: S.minDisplay, align: "center", under: bg, share: 2.2, weight: Math.min(700, c.style.weights.display) },
      { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "heading", maxSize: S.sub * 0.85, minSize: S.minSub, align: "center", under: bg, share: 1, fill: inkOn(c, bg, ["muted", "ink"]) },
      { name: "Body", text: c.density > 0.4 ? c.body : "", role: "body", kind: "body", maxSize: S.body, minSize: S.minBody, align: "center", under: bg, share: 1.2 },
    ],
    { vAlign: textFirst ? "bottom" : "top", gap: S.gap * 1.2 },
  );
  return { grid: settings, background: bg };
}

// 06 ─ Vertical typography ────────────────────────────────────────────────────
export function verticalType(c: Ctx): Comp {
  const S = sizes(c);
  const land = c.orientation === "landscape";
  const cols = land ? 12 : 6;
  const rows = land ? 6 : 8;
  const { settings, geo } = makeGrid(c, { type: "modular", columns: cols, rows });
  const bg = c.pal.background;
  const right = c.variant === 1 || c.rng() < 0.35 * c.asymmetry;
  const tCols = land ? 3 : 2;
  const titleCol = right ? spanRect(geo, cols - tCols, cols - 1, 0, rows - 1) : spanRect(geo, 0, tCols - 1, 0, rows - 1);
  const rot: -90 | 90 = c.style.id === "japanese" || c.style.id === "retro-futurism" ? 90 : -90;
  fitText(c, { name: "Title (vertical)", text: c.title, role: "display", kind: "display", box: titleCol, maxSize: S.display, minSize: S.minDisplay, rotation: rot, vAlign: right ? "bottom" : "top", under: bg });

  const c0 = right ? 0 : tCols;
  const c1 = right ? cols - tCols - 1 : cols - 1;
  const imgRows = land ? 4 : 5;
  const img = spanRect(geo, c0, c1, 0, imgRows - 1);
  addImage(c, img, { name: "Image" });
  // Accent strip on the image edge next to the vertical title.
  addRect(c, R(right ? rectRight(img) - Math.max(3, S.hair * 5) : img.x, img.y, Math.max(3, S.hair * 5), img.height * 0.4), paint(c, "accent"), { name: "Accent strip" });
  const below = spanRect(geo, c0, c1, imgRows, rows - 1);
  const metaH = Math.ceil(S.meta * (c.logo ? 3 : 1.6));
  textStack(
    c,
    R(below.x, below.y, below.width, below.height - metaH - S.gap),
    [
      { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "heading", maxSize: S.sub, minSize: S.minSub, under: bg, share: 1 },
      { name: "Body", text: c.body, role: "body", kind: "body", maxSize: S.body, minSize: S.minBody, under: bg, share: 1.6 },
    ],
    { vAlign: "top" },
  );
  const foot = R(below.x, rectBottom(below) - metaH, below.width, metaH);
  addRule(c, foot.x, foot.y - S.gap * 0.5, foot.width, paint(c, "ink"));
  if (c.logo) {
    metaRow(c, R(foot.x, foot.y, foot.width * 0.6, metaH), [c.meta[0]], bg);
    addLogo(c, R(foot.x + foot.width * 0.65, foot.y, foot.width * 0.35, metaH), "right", "center");
  } else metaRow(c, foot, [c.meta[0], c.meta[2]], bg);
  addTexture(c, 0.5);
  return { grid: settings, background: bg };
}

// 07 ─ Split layout ───────────────────────────────────────────────────────────
export function splitLayout(c: Ctx): Comp {
  const S = sizes(c);
  const side = c.orientation === "landscape" || (c.orientation === "square" && c.rng() < 0.5);
  const flip = c.variant === 1 || c.rng() < 0.35 * c.asymmetry;
  const ratio = 0.5 + (c.asymmetry - 0.5) * 0.16;
  const m = marginPx(c);
  const panelPaint = c.rng() < 0.45 ? paint(c, "accent") : paint(c, "paper");
  const panelBg = panelPaint.color;
  let imgR: Rect;
  let panel: Rect;
  if (side) {
    const iw = Math.round(c.W * ratio);
    imgR = flip ? R(c.W - iw, 0, iw, c.H) : R(0, 0, iw, c.H);
    panel = flip ? R(0, 0, c.W - iw, c.H) : R(iw, 0, c.W - iw, c.H);
  } else {
    const ih = Math.round(c.H * ratio);
    imgR = flip ? R(0, c.H - ih, c.W, ih) : R(0, 0, c.W, ih);
    panel = flip ? R(0, 0, c.W, c.H - ih) : R(0, ih, c.W, c.H - ih);
  }
  const { settings } = makeGrid(c, side ? { type: "column", columns: 2, rows: 1, gutter: 0 } : { type: "modular", columns: 1, rows: 2, gutter: 0 });
  addRect(c, panel, panelPaint, { name: "Text panel" });
  addImage(c, imgR, { name: "Split image" });
  const area = R(panel.x + m, panel.y + m, panel.width - m * 2, panel.height - m * 2);
  const metaH = Math.ceil(S.meta * 1.6);
  metaRow(c, R(area.x, area.y, area.width, metaH), [c.meta[0], c.meta[1]], panelBg);
  addRule(c, area.x, area.y + metaH + S.gap * 0.5, area.width, inkOn(c, panelBg));
  const logoH = c.logo ? Math.min(area.height * 0.12, c.unit * 0.08) : 0;
  const stackTop = area.y + metaH + S.gap * 2;
  textStack(
    c,
    R(area.x, stackTop, area.width, rectBottom(area) - stackTop - (logoH ? logoH + S.gap * 2 : 0)),
    [
      { name: "Title", text: c.title, role: "display", kind: "display", maxSize: S.display, minSize: S.minDisplay, under: panelBg, share: 3 },
      { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "heading", maxSize: S.sub, minSize: S.minSub, under: panelBg, share: 1 },
      { name: "Body", text: c.body, role: "body", kind: "body", maxSize: S.body, minSize: S.minBody, under: panelBg, share: 1.4 },
    ],
    { vAlign: c.asymmetry > 0.4 ? "bottom" : "top", gap: S.gap * 1.4 },
  );
  if (logoH) addLogo(c, R(area.x, rectBottom(area) - logoH, area.width, logoH), "left", "bottom");
  return { grid: settings, background: c.pal.background };
}

// 08 ─ Experimental typography ────────────────────────────────────────────────
export function experimentalType(c: Ctx): Comp {
  const S = sizes(c);
  const land = c.orientation === "landscape";
  const chars = [...c.title.replace(/\s+/g, "")].slice(0, land ? 10 : 9);
  if (chars.length < 2) chars.push(...[..."FS"].slice(0, 2 - chars.length));
  const n = chars.length;
  const cols = land ? Math.min(n, Math.max(3, Math.ceil(n / 2))) : n <= 4 ? 2 : 3;
  const letterRows = Math.ceil(n / cols);
  const band = land ? 0.9 : 1.1;
  const rowRatios = [...new Array(letterRows).fill(1), band];
  const columnRatios = new Array(cols).fill(1);
  const { settings, geo } = makeGrid(c, { type: "custom", columns: cols, rows: letterRows + 1, columnRatios, rowRatios, margin: 0.8 });
  const bg = c.pal.background;
  const field = spanRect(geo, 0, cols - 1, 0, letterRows - 1);

  // Image block behind part of the letter field (rule: spans ⌈cols/2⌉ columns from a seeded edge).
  const span = Math.max(1, Math.ceil(cols / 2));
  const fromRight = c.variant === 1 || c.rng() < 0.5;
  const ib = fromRight ? spanRect(geo, cols - span, cols - 1, 0, Math.max(0, letterRows - 1)) : spanRect(geo, 0, span - 1, 0, Math.max(0, letterRows - 1));
  addImage(c, ib, { name: "Image block", opacity: 0.92 });

  const rotEvery = c.asymmetry > 0.25 ? (c.asymmetry > 0.65 ? 2 : 3) : 0;
  const oversize = 1 + 0.35 * c.asymmetry;
  const shift = Math.floor(c.rng() * 3);
  chars.forEach((ch, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cell = spanRect(geo, col, col, row, row);
    // Oversize by rule, clamped to the letter field.
    const gw = cell.width * oversize;
    const gh = cell.height * oversize;
    let x = cell.x + cell.width / 2 - gw / 2;
    let y = cell.y + cell.height / 2 - gh / 2;
    x = Math.max(field.x, Math.min(rectRight(field) - gw, x));
    y = Math.max(field.y, Math.min(rectBottom(field) - gh, y));
    const box = R(x, y, Math.min(gw, field.width), Math.min(gh, field.height));
    const rotated = rotEvery > 0 && (i + shift) % rotEvery === 0;
    const ov = Math.max(0, Math.min(rectRight(box), rectRight(ib)) - Math.max(box.x, ib.x)) * Math.max(0, Math.min(rectBottom(box), rectBottom(ib)) - Math.max(box.y, ib.y));
    const onImage = ov > box.width * box.height * 0.5;
    const under = onImage ? c.imageTone : bg;
    const fill = (i + shift) % 2 === 0 ? accentOn(c, under) : inkOn(c, under);
    fitText(c, {
      name: `Glyph ${ch.toUpperCase()}`,
      text: ch,
      role: "display",
      kind: "display",
      box,
      maxSize: Math.max(box.width, box.height) * 1.2,
      minSize: S.minDisplay,
      align: "center",
      vAlign: "center",
      lineHeight: 0.82,
      under,
      fill,
      rotation: rotated ? -90 : 0,
      intentional: true,
      truncate: false,
    });
  });
  if (c.density > 0.35) {
    for (let i = 0; i < n; i++) {
      const cell = spanRect(geo, i % cols, i % cols, Math.floor(i / cols), Math.floor(i / cols));
      addRect(c, cell, paint(c, "ink"), { name: `Module ${i + 1}`, noFill: true, stroke: { ...paint(c, "muted"), width: S.hair } });
    }
  }
  const bandR = spanRect(geo, 0, cols - 1, letterRows, letterRows);
  const leftW = bandR.width * 0.62;
  textStack(
    c,
    R(bandR.x, bandR.y, leftW - S.gap, bandR.height),
    [
      { name: "Title", text: c.title, role: "heading", kind: "heading", maxSize: S.heading, minSize: S.minSub, under: bg, share: 1.4, uppercase: true, weight: c.style.weights.heading },
      { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "body", maxSize: S.sub * 0.7, minSize: S.minBody, under: bg, share: 1 },
    ],
    { vAlign: "bottom" },
  );
  const rightBox = R(bandR.x + leftW, bandR.y, bandR.width - leftW, bandR.height);
  const metaH = Math.ceil(S.meta * 1.6);
  textStack(
    c,
    R(rightBox.x, rightBox.y, rightBox.width, rightBox.height - metaH - S.gap - (c.logo ? c.unit * 0.06 + S.gap : 0)),
    [{ name: "Body", text: c.body, role: "body", kind: "body", maxSize: S.body * 0.9, minSize: S.minBody, under: bg, share: 1 }],
    { vAlign: "top" },
  );
  if (c.logo) addLogo(c, R(rightBox.x, rectBottom(rightBox) - metaH - S.gap - c.unit * 0.06, rightBox.width, c.unit * 0.06), "right", "bottom");
  metaRow(c, R(rightBox.x, rectBottom(rightBox) - metaH, rightBox.width, metaH), [c.meta[0]], bg).forEach((l) => {
    l.align = "right";
    l.x = rectRight(rightBox) - l.width;
  });
  addTexture(c, 0.7);
  return { grid: settings, background: bg };
}

// 09 ─ Swiss International layout ─────────────────────────────────────────────
export function swissLayout(c: Ctx): Comp {
  const S = sizes(c);
  const land = c.orientation === "landscape";
  const cols = land ? 12 : 8;
  const rows = land ? 8 : 12;
  const { settings, geo } = makeGrid(c, { type: "modular", columns: cols, rows });
  const ct = geo.content;
  const bg = c.pal.background;
  const ink = paint(c, "ink");

  addRule(c, ct.x, ct.y, ct.width, ink, Math.max(2, S.hair * 2), "Top rule");
  const metaH = Math.ceil(S.meta * (c.logo ? 2.6 : 1.6));
  const metaY = ct.y + S.gap * 0.6;
  const q = Math.floor(cols / 4);
  const h2 = Math.floor(cols / 2);
  const thirds = [spanRect(geo, 0, q, 0, 0), spanRect(geo, q + 1, h2, 0, 0), spanRect(geo, h2 + 1, cols - 1, 0, 0)];
  metaRow(c, R(thirds[0].x, metaY, thirds[0].width, metaH), [c.meta[0]], bg);
  metaRow(c, R(thirds[1].x, metaY, thirds[1].width, metaH), [c.meta[1]], bg);
  if (c.logo) addLogo(c, R(thirds[2].x, metaY, thirds[2].width, metaH), "right", "center");
  else metaRow(c, R(thirds[2].x, metaY, thirds[2].width, metaH), [c.meta[2]], bg).forEach((l) => {
    l.align = "right";
    l.x = rectRight(thirds[2]) - l.width;
  });

  const shapeKind = c.variant === 1 || c.rng() < 0.4 ? "bars" : "circle";
  if (land) {
    const zone = spanRect(geo, 7, cols - 1, 1, rows - 1);
    const d = Math.min(zone.width, zone.height);
    if (shapeKind === "circle") addRect(c, R(rectRight(zone) - d, zone.y + (zone.height - d) / 2, d, d), paint(c, "accent"), { name: "Circle", shape: "circle" });
    else for (let i = 0; i < 4; i++) addRect(c, R(zone.x + (zone.width / 4) * i, zone.y + zone.height * (0.15 * i), zone.width / 4 - S.hair * 3, zone.height * (1 - 0.15 * i)), i % 2 ? ink : paint(c, "accent"), { name: `Bar ${i + 1}` });
    addImage(c, spanRect(geo, 0, 3, 1, 4), { name: "Image" });
    fitText(c, { name: "Title", text: c.title, role: "display", kind: "display", box: spanRect(geo, 4, 6, 1, 4), maxSize: S.display, minSize: S.minDisplay, vAlign: "top", under: bg });
    fitText(c, { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "heading", box: spanRect(geo, 0, 3, 5, rows - 1), maxSize: S.sub, minSize: S.minSub, vAlign: "top", under: bg });
    fitText(c, { name: "Body", text: c.body, role: "body", kind: "body", box: spanRect(geo, 4, 6, 5, rows - 1), maxSize: S.body, minSize: S.minBody, vAlign: "top", under: bg });
  } else {
    const zone = spanRect(geo, 3, cols - 1, 1, 6);
    const d = Math.min(zone.width, zone.height);
    if (shapeKind === "circle") addRect(c, R(rectRight(zone) - d, zone.y, d, d), paint(c, "accent"), { name: "Circle", shape: "circle" });
    else for (let i = 0; i < 5; i++) addRect(c, R(zone.x + (zone.width / 5) * i, zone.y + zone.height * 0.12 * i, zone.width / 5 - S.hair * 3, zone.height * (1 - 0.12 * i)), i % 2 ? ink : paint(c, "accent"), { name: `Bar ${i + 1}` });
    addImage(c, spanRect(geo, 0, 2, 2, 6), { name: "Image" });
    fitText(c, { name: "Title", text: c.title, role: "display", kind: "display", box: spanRect(geo, 0, cols - 1, 7, 9), maxSize: S.display, minSize: S.minDisplay, vAlign: "top", under: bg });
    fitText(c, { name: "Subtitle", text: c.subtitle, role: "subheading", kind: "heading", box: spanRect(geo, 0, 3, 10, 11), maxSize: S.sub, minSize: S.minSub, vAlign: "top", under: bg });
    const [a, b] = c.body ? splitCopy(c.body) : ["", ""];
    const twoCols = c.body.length > 140 && c.density > 0.35;
    if (twoCols) {
      fitText(c, { name: "Body 1", text: a, role: "body", kind: "body", box: spanRect(geo, 4, 5, 10, 11), maxSize: S.body, minSize: S.minBody, under: bg });
      fitText(c, { name: "Body 2", text: b, role: "body", kind: "body", box: spanRect(geo, 6, 7, 10, 11), maxSize: S.body, minSize: S.minBody, under: bg });
    } else fitText(c, { name: "Body", text: c.body, role: "body", kind: "body", box: spanRect(geo, 4, 7, 10, 11), maxSize: S.body, minSize: S.minBody, under: bg });
  }
  return { grid: settings, background: bg };
}

// 10 ─ Magazine cover ─────────────────────────────────────────────────────────
export function magazineCover(c: Ctx): Comp {
  const S = sizes(c);
  const land = c.orientation === "landscape";
  const cols = land ? 8 : 4;
  const rows = land ? 6 : 10;
  const { settings, geo } = makeGrid(c, { type: "modular", columns: cols, rows, margin: 0.8 });
  const ct = geo.content;
  addImage(c, R(0, 0, c.W, c.H), { name: "Cover image" });

  const mastRows = land ? 2 : 2;
  const mast = spanRect(geo, 0, cols - 1, 0, mastRows - 1);
  const sc = scrimFor(c, c.imageIsUser ? 0.55 : undefined);
  addRect(c, R(0, 0, c.W, rectBottom(mast) + S.gap * 3 + S.meta * 2), sc.paint, { name: "Masthead scrim", opacity: sc.opacity });
  const fill = inkOn(c, sc.effective, ["paper", "background", "ink"]);
  fitText(c, { name: "Masthead", text: c.title, role: "display", kind: "display", box: mast, maxSize: S.display, minSize: S.minDisplay, vAlign: "top", under: sc.effective, fill, uppercase: true, lineHeight: 0.86 });
  metaRow(c, R(ct.x, rectBottom(mast) + S.gap, ct.width, Math.ceil(S.meta * 1.6)), [`${c.meta[0]} — ${c.meta[1]}`, c.meta[3]], sc.effective, fill);

  // Cover lines as chips, left column, lower half.
  const lineCol = land ? spanRect(geo, 0, 3, 3, rows - 2) : spanRect(geo, 0, 2, 5, rows - 2);
  const accentChip = { ...paint(c, "accent"), padding: Math.round(S.sub * 0.25) };
  const paperChip = { ...paint(c, "paper"), padding: Math.round(S.body * 0.45) };
  const h1 = lineCol.height * 0.45;
  fitText(c, { name: "Cover line", text: c.subtitle, role: "subheading", kind: "heading", box: R(lineCol.x, lineCol.y, lineCol.width, h1), maxSize: S.sub * 1.1, minSize: S.minSub, under: accentChip.color, chip: accentChip, hug: true, vAlign: "top" });
  fitText(c, { name: "Body", text: c.density > 0.2 ? c.body : "", role: "body", kind: "body", box: R(lineCol.x, lineCol.y + h1 + S.gap, lineCol.width * 0.85, lineCol.height - h1 - S.gap), maxSize: S.body, minSize: S.minBody, under: paperChip.color, chip: paperChip, hug: true, vAlign: "top" });

  // Barcode block bottom-right — pure geometry.
  const bw = c.unit * 0.17;
  const bh = c.unit * 0.1;
  const bx = rectRight(ct) - bw;
  const by = rectBottom(ct) - bh;
  addRect(c, R(bx, by, bw, bh), paint(c, "paper"), { name: "Barcode label" });
  const ip = bw * 0.08;
  let x = bx + ip;
  let k = 0;
  const barInk = inkOn(c, c.pal.paper, ["ink", "background"]);
  while (x < bx + bw - ip - 1 && k < 40) {
    const w = Math.max(1, Math.round((1 + Math.floor(c.rng() * 3)) * c.unit * 0.0016));
    if (x + w > bx + bw - ip) break;
    if (k % 2 === 0) addRect(c, R(x, by + ip, w, bh - ip * 2.2), barInk, { name: "Barcode bar" });
    x += w + Math.max(1, Math.round(c.unit * 0.0016 * (1 + (k % 3))));
    k++;
  }
  if (c.logo) addLogo(c, R(ct.x, rectBottom(ct) - c.unit * 0.07, ct.width * 0.3, c.unit * 0.07), "left", "bottom");
  return { grid: settings, background: c.pal.ink };
}

export interface AlgorithmDef {
  id: AlgorithmId;
  label: string;
  n: string;
  build: (c: Ctx) => Comp;
  /** Affinity 0..1 per direction. */
  affinity: { typographic: number; "image-led": number; balanced: number };
}

export const ALGORITHMS: AlgorithmDef[] = [
  { id: "type-top-image-bottom", n: "01", label: "Large Type / Image Below", build: typeTopImageBottom, affinity: { typographic: 0.8, "image-led": 0.5, balanced: 0.9 } },
  { id: "full-bleed", n: "02", label: "Full Bleed Image", build: fullBleed, affinity: { typographic: 0.2, "image-led": 1, balanced: 0.6 } },
  { id: "asymmetric-editorial", n: "03", label: "Asymmetric Editorial", build: asymmetricEditorial, affinity: { typographic: 0.6, "image-led": 0.7, balanced: 1 } },
  { id: "modular-grid", n: "04", label: "Modular Grid", build: modularGrid, affinity: { typographic: 0.5, "image-led": 0.6, balanced: 0.9 } },
  { id: "centered-minimal", n: "05", label: "Centered Minimalism", build: centeredMinimal, affinity: { typographic: 0.5, "image-led": 0.6, balanced: 0.7 } },
  { id: "vertical-type", n: "06", label: "Vertical Typography", build: verticalType, affinity: { typographic: 0.9, "image-led": 0.4, balanced: 0.6 } },
  { id: "split", n: "07", label: "Split Layout", build: splitLayout, affinity: { typographic: 0.5, "image-led": 0.8, balanced: 0.9 } },
  { id: "experimental-type", n: "08", label: "Experimental Typography", build: experimentalType, affinity: { typographic: 1, "image-led": 0.2, balanced: 0.4 } },
  { id: "swiss", n: "09", label: "Swiss International", build: swissLayout, affinity: { typographic: 0.8, "image-led": 0.4, balanced: 0.8 } },
  { id: "magazine", n: "10", label: "Magazine Cover", build: magazineCover, affinity: { typographic: 0.4, "image-led": 0.9, balanced: 0.6 } },
];

export function getAlgorithm(id: AlgorithmId): AlgorithmDef {
  return ALGORITHMS.find((a) => a.id === id) ?? ALGORITHMS[0];
}
