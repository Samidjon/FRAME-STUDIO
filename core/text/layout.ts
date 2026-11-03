import type { TextLayer } from "@/types/layer";

/**
 * Deterministic text layout shared by the canvas renderer, SVG/PDF export and
 * the composition generator. Measurement is injected so the engine can run in
 * tests and on any 2D context.
 */

export type MeasureFn = (text: string, font: string) => number;

export interface LaidWord {
  text: string;
  x: number;
  width: number;
}

export interface LaidLine {
  words: LaidWord[];
  /** Baseline y relative to the box top. */
  baseline: number;
  top: number;
  width: number;
  text: string;
}

export interface LaidGlyph {
  char: string;
  /** Centre x, baseline y. */
  x: number;
  y: number;
}

export interface TextLayout {
  font: string;
  lines: LaidLine[];
  glyphs: LaidGlyph[] | null;
  width: number;
  height: number;
  lineAdvance: number;
  letterSpacingPx: number;
  overflow: boolean;
}

type TextProps = Pick<
  TextLayer,
  | "text"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "italic"
  | "align"
  | "lineHeight"
  | "letterSpacing"
  | "wordSpacing"
  | "uppercase"
  | "width"
  | "height"
  | "vertical"
  | "autoHeight"
  | "backgroundPadding"
>;

export function fontString(p: Pick<TextLayer, "fontFamily" | "fontSize" | "fontWeight" | "italic">): string {
  const fam = p.fontFamily.includes(",") ? p.fontFamily : `"${p.fontFamily}", "Inter", sans-serif`;
  return `${p.italic ? "italic " : ""}${p.fontWeight} ${Math.max(1, p.fontSize)}px ${fam}`;
}

/** Ratio from line-box centre to alphabetic baseline, roughly half the cap height. */
export const BASELINE_SHIFT = 0.34;

export function displayText(p: Pick<TextLayer, "text" | "uppercase">) {
  return p.uppercase ? p.text.toUpperCase() : p.text;
}

export function layoutText(p: TextProps, measure: MeasureFn): TextLayout {
  const font = fontString(p);
  const size = Math.max(1, p.fontSize);
  const ls = (p.letterSpacing / 1000) * size;
  const extraWord = (p.wordSpacing / 1000) * size;
  const lineAdvance = size * p.lineHeight;
  const pad = p.backgroundPadding || 0;
  const text = displayText(p);
  const measureWord = (w: string) => (w ? measure(w, font) + ls * [...w].length : 0);

  if (p.vertical) {
    const columns = text.split("\n");
    const charAdvance = size * Math.max(0.6, 1 + p.letterSpacing / 1000);
    const colAdvance = Math.max(size, lineAdvance);
    const glyphs: LaidGlyph[] = [];
    let maxChars = 0;
    columns.forEach((col, ci) => {
      const chars = [...col];
      maxChars = Math.max(maxChars, chars.length);
      chars.forEach((ch, i) => {
        glyphs.push({ char: ch, x: pad + ci * colAdvance + colAdvance / 2, y: pad + i * charAdvance + charAdvance / 2 + size * BASELINE_SHIFT });
      });
    });
    const width = columns.length * colAdvance + pad * 2;
    const height = maxChars * charAdvance + pad * 2;
    return { font, lines: [], glyphs, width, height, lineAdvance: colAdvance, letterSpacingPx: ls, overflow: false };
  }

  const boxWidth = Math.max(1, p.width - pad * 2);
  const space = measure(" ", font) + ls + extraWord;
  const lines: { words: { text: string; width: number }[]; paraEnd: boolean }[] = [];
  let overflow = false;

  for (const para of text.split("\n")) {
    const tokens = para.split(/ +/).filter((t, i, arr) => t.length || arr.length === 1);
    let current: { text: string; width: number }[] = [];
    let currentW = 0;
    const flush = () => {
      lines.push({ words: current, paraEnd: false });
      current = [];
      currentW = 0;
    };
    for (const tok of tokens) {
      let w = measureWord(tok);
      if (w > boxWidth && [...tok].length > 1) {
        // Break overlong words by characters.
        overflow = true;
        let chunk = "";
        for (const ch of [...tok]) {
          const next = chunk + ch;
          if (measureWord(next) > boxWidth && chunk) {
            if (current.length) flush();
            current.push({ text: chunk, width: measureWord(chunk) });
            flush();
            chunk = ch;
          } else chunk = next;
        }
        if (chunk) {
          w = measureWord(chunk);
          if (current.length && currentW + space + w > boxWidth) flush();
          currentW += (current.length ? space : 0) + w;
          current.push({ text: chunk, width: w });
        }
        continue;
      }
      if (current.length && currentW + space + w > boxWidth + 0.01) flush();
      currentW += (current.length ? space : 0) + w;
      current.push({ text: tok, width: w });
    }
    flush();
    lines[lines.length - 1].paraEnd = true;
  }

  const laid: LaidLine[] = lines.map((ln, i) => {
    // Trailing tracking after the last glyph should not affect alignment.
    const natural = ln.words.reduce((s, w, wi) => s + w.width + (wi ? space : 0), 0) - (ln.words.length ? ls : 0);
    let x = pad;
    let gap = space;
    if (p.align === "center") x = pad + (boxWidth - natural) / 2;
    else if (p.align === "right") x = pad + boxWidth - natural;
    else if (p.align === "justify" && ln.words.length > 1 && !ln.paraEnd) gap = space + (boxWidth - natural) / (ln.words.length - 1);
    const words: LaidWord[] = [];
    for (const w of ln.words) {
      words.push({ text: w.text, x, width: w.width });
      x += w.width + gap;
    }
    const top = pad + i * lineAdvance;
    return { words, top, baseline: top + lineAdvance / 2 + size * BASELINE_SHIFT, width: natural, text: ln.words.map((w) => w.text).join(" ") };
  });

  const contentHeight = laid.length * lineAdvance + pad * 2;
  const height = p.autoHeight ? contentHeight : Math.max(p.height, 1);
  if (!p.autoHeight && contentHeight > p.height + 0.5) overflow = true;
  return { font, lines: laid, glyphs: null, width: p.width, height, lineAdvance, letterSpacingPx: ls, overflow };
}

let sharedCtx: CanvasRenderingContext2D | null = null;
const measureCache = new Map<string, number>();

/** Browser measurer backed by an offscreen 2D context with a small LRU-ish cache. */
export const browserMeasure: MeasureFn = (text, font) => {
  const key = font + "\u0000" + text;
  const hit = measureCache.get(key);
  if (hit !== undefined) return hit;
  if (!sharedCtx) {
    const c = document.createElement("canvas");
    sharedCtx = c.getContext("2d");
  }
  if (!sharedCtx) return text.length * 10;
  sharedCtx.font = font;
  const w = sharedCtx.measureText(text).width;
  if (measureCache.size > 20000) measureCache.clear();
  measureCache.set(key, w);
  return w;
};

/** Called after web fonts load so stale measurements are discarded. */
export function clearMeasureCache() {
  measureCache.clear();
}

/** Approximate measurer for non-DOM environments (tests, server). */
export const approxMeasure: MeasureFn = (text, font) => {
  const m = /(\d+(?:\.\d+)?)px/.exec(font);
  const size = m ? parseFloat(m[1]) : 16;
  let w = 0;
  for (const ch of text) w += /[il.,:;'|!]/.test(ch) ? 0.28 : /[mwMW@]/.test(ch) ? 0.85 : /[A-Z]/.test(ch) ? 0.66 : ch === " " ? 0.28 : 0.54;
  return w * size;
};

/** Find the largest font size (≤ max) whose layout fits within the box. */
export function fitFontSize(
  p: TextProps,
  box: { width: number; height: number },
  measure: MeasureFn,
  max: number,
  min = 8,
): number {
  let lo = min;
  let hi = Math.max(min, max);
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const l = layoutText({ ...p, fontSize: mid, width: box.width, autoHeight: true }, measure);
    const tooWide = l.lines.some((ln) => ln.words.length === 1 && ln.width > box.width - (p.backgroundPadding || 0) * 2 + 0.5);
    const fits = l.height <= box.height && !tooWide && !l.overflow;
    if (fits) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}
