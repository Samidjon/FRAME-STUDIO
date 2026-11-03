import type { GridSettings, GridType, Rect } from "@/types/canvas";
import type { ImageLayer, Layer, ShapeKind, ShapeLayer, TextLayer, TextRole, TextureKind, TextureLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import {
  createDocument,
  createImageLayer,
  createShapeLayer,
  createTextLayer,
  createTextureLayer,
  defaultEffects,
  defaultGrid,
  TEXT_ROLE_SCALE,
} from "@/core/document/factory";
import { computeGrid, spanRect, type GridGeometry } from "@/core/geometry/grid";
import { approxMeasure, fitFontSize, layoutText, type MeasureFn } from "@/core/text/layout";
import { getStyle, supportedWeight, type PaletteRole, type StylePalette } from "@/core/presets/styles";

/**
 * Template construction kit. Templates are authored as real, editable layers
 * placed on a computed grid; this module keeps that authoring terse.
 */

/** Relative advance width of catalogue families versus the generic approximation. */
const WIDTH_K: Record<string, number> = {
  Inter: 1.06,
  "Space Grotesk": 1.02,
  "Hanken Grotesk": 1.0,
  "Familjen Grotesk": 0.98,
  Archivo: 1.04,
  Manrope: 1.06,
  Syne: 1.14,
  Unbounded: 1.38,
  "Archivo Black": 1.24,
  "Rubik Mono One": 1.5,
  "Major Mono Display": 1.4,
  Anton: 0.8,
  "Bebas Neue": 0.74,
  Oswald: 0.84,
  "Big Shoulders Display": 0.78,
  "Instrument Serif": 0.86,
  "DM Serif Display": 1.0,
  "Playfair Display": 1.0,
  Fraunces: 1.04,
  "Bodoni Moda": 1.0,
  "Libre Caslon Text": 1.06,
  "JetBrains Mono": 1.14,
  "IBM Plex Mono": 1.14,
  "Space Mono": 1.18,
  "Noto Sans JP": 1.04,
  "Noto Serif JP": 1.04,
  "Zen Kaku Gothic New": 1.04,
};

const CJK = /[　-ヿ㐀-鿿＀-￯]/;

/** Conservative measurer: approximate widths corrected per family, full-width CJK. */
export const kitMeasure: MeasureFn = (text, font) => {
  const fam = /"([^"]+)"/.exec(font)?.[1] ?? "Inter";
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "16");
  const k = WIDTH_K[fam] ?? 1.1;
  const bold = /\b([6-9]00)\b/.test(font) ? 1.05 : 1;
  let latin = "";
  let cjk = 0;
  for (const ch of text) {
    if (CJK.test(ch)) cjk++;
    else latin += ch;
  }
  return approxMeasure(latin, font) * k * bold + cjk * size * 1.0;
};

export const C = {
  warm: "#F0EDE5",
  black: "#171717",
  anth: "#292929",
  grey: "#888888",
  orange: "#FF4D00",
  lav: "#E9DAF5",
  white: "#FFFFFF",
};

export function paletteOf(styleId: string, index = 0): StylePalette {
  const s = getStyle(styleId);
  if (!s) throw new Error(`Unknown style ${styleId}`);
  return s.palettes[Math.min(index, s.palettes.length - 1)];
}

export interface GridSpec {
  type?: GridType;
  columns?: number;
  rows?: number;
  /** Margin as a fraction of the shorter side (uniform). */
  margin?: number;
  /** Per-side margin fractions of the shorter side; overrides `margin`. */
  margins?: { top: number; right: number; bottom: number; left: number };
  /** Gutter as a fraction of the shorter side. */
  gutter?: number;
  columnRatios?: number[];
  rowRatios?: number[];
}

export function makeGrid(w: number, h: number, s: GridSpec = {}): GridSettings {
  const base = defaultGrid(w, h);
  const u = Math.min(w, h);
  const m = s.margin ?? 0.06;
  const ms = s.margins ?? { top: m, right: m, bottom: m, left: m };
  return {
    ...base,
    type: s.type ?? "modular",
    columns: s.columns ?? base.columns,
    rows: s.rows ?? base.rows,
    gutter: Math.round(u * (s.gutter ?? 0.02)),
    margins: { top: Math.round(u * ms.top), right: Math.round(u * ms.right), bottom: Math.round(u * ms.bottom), left: Math.round(u * ms.left) },
    columnRatios: s.columnRatios ?? base.columnRatios,
    rowRatios: s.rowRatios ?? base.rowRatios,
    visible: false,
  };
}

export type TextOpts = Partial<Omit<TextLayer, "type" | "id">> & {
  role: TextRole;
  x: number;
  y: number;
  width: number;
};

export interface FitOpts {
  /** Maximum font size in px. */
  max: number;
  min?: number;
  /** Vertical anchoring of the fitted block inside the box. */
  anchor?: "top" | "bottom" | "center";
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export class Composer {
  readonly layers: Layer[] = [];
  readonly geo: GridGeometry;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly grid: GridSettings,
    readonly palette: StylePalette,
    readonly styleId: string,
  ) {
    this.geo = computeGrid(w, h, grid);
  }

  /** Shorter document side; a convenient unit for proportional sizes. */
  get u() {
    return Math.min(this.w, this.h);
  }

  get content(): Rect {
    return this.geo.content;
  }

  get page(): Rect {
    return { x: 0, y: 0, width: this.w, height: this.h };
  }

  span(c0: number, c1: number, r0: number, r1: number): Rect {
    return spanRect(this.geo, c0, c1, r0, r1);
  }

  col(i: number) {
    const c = this.geo.columns[Math.max(0, Math.min(this.geo.columns.length - 1, i))];
    return { x: c.start, width: c.size, right: c.start + c.size };
  }

  row(i: number) {
    const r = this.geo.rows[Math.max(0, Math.min(this.geo.rows.length - 1, i))];
    return { y: r.start, height: r.size, bottom: r.start + r.size };
  }

  color(role: PaletteRole): string {
    return this.palette[role];
  }

  private push<T extends Layer>(l: T): T {
    this.layers.push(l);
    return l;
  }

  /** Measured height of a text layer at its current settings. */
  measure(l: TextLayer): number {
    return layoutText({ ...l, autoHeight: true }, kitMeasure).height;
  }

  private buildText(text: string, o: TextOpts): TextLayer {
    const role = o.role;
    const r = TEXT_ROLE_SCALE[role];
    const fillRole = o.fillRole ?? "ink";
    const family = o.fontFamily ?? "Inter";
    const layer = createTextLayer(
      {
        lineHeight: r.lineHeight,
        letterSpacing: r.tracking,
        uppercase: r.uppercase,
        ...o,
        text,
        name: o.name ?? text.split("\n")[0].slice(0, 28),
        fontFamily: family,
        fontWeight: supportedWeight(family, o.fontWeight ?? r.weight),
        fill: o.fill ?? (fillRole === "none" ? C.black : this.palette[fillRole]),
        fillRole,
        x: r2(o.x),
        y: r2(o.y),
        width: r2(o.width),
      },
      this.w,
    );
    if (!layer.vertical) layer.height = Math.ceil(this.measure(layer));
    else {
      const lay = layoutText(layer, kitMeasure);
      layer.width = Math.ceil(lay.width);
      layer.height = Math.ceil(lay.height);
    }
    return layer;
  }

  text(text: string, o: TextOpts): TextLayer {
    return this.push(this.buildText(text, o));
  }

  /** Text whose size is fitted to a box (largest size ≤ max that fits). */
  fit(text: string, box: Rect, o: Omit<TextOpts, "x" | "y" | "width"> & FitOpts): TextLayer {
    const { max, min, anchor, ...rest } = o;
    const probe = this.buildText(text, { ...rest, x: box.x, y: box.y, width: box.width, fontSize: max });
    const size = fitFontSize(probe, { width: box.width * 0.97, height: box.height }, kitMeasure, max, min ?? 8);
    const layer = this.buildText(text, { ...rest, x: box.x, y: box.y, width: box.width, fontSize: size });
    if (anchor === "bottom") layer.y = r2(box.y + box.height - layer.height);
    else if (anchor === "center") layer.y = r2(box.y + (box.height - layer.height) / 2);
    return this.push(layer);
  }

  /** Mono micro-label (index numbers, coordinates, catalogue numbers). */
  meta(text: string, x: number, y: number, width: number, o: Partial<TextOpts> = {}): TextLayer {
    return this.text(text, {
      role: "metadata",
      x,
      y,
      width,
      fontFamily: "JetBrains Mono",
      fontSize: Math.round(this.u * 0.0135),
      fontWeight: 500,
      letterSpacing: 80,
      lineHeight: 1.35,
      uppercase: true,
      name: `Meta — ${text.split("\n")[0].slice(0, 20)}`,
      ...o,
    });
  }

  /** Running text. */
  body(text: string, x: number, y: number, width: number, o: Partial<TextOpts> = {}): TextLayer {
    return this.text(text, {
      role: "body",
      x,
      y,
      width,
      fontFamily: "Inter",
      fontSize: Math.round(this.u * 0.02),
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: 1.4,
      name: `Body — ${text.slice(0, 18)}`,
      ...o,
    });
  }

  /** Move a layer so its bottom edge sits at `bottom`. */
  bottomAt<T extends Layer>(l: T, bottom: number): T {
    l.y = r2(bottom - l.height);
    return l;
  }

  shape(kind: ShapeKind, r: Rect, o: Partial<ShapeLayer> = {}): ShapeLayer {
    const fillRole = o.fillRole ?? (kind === "line" ? "none" : "accent");
    const strokeRole = o.strokeRole ?? (kind === "line" ? "ink" : "none");
    return this.push(
      createShapeLayer(kind, {
        ...o,
        x: r2(r.x),
        y: r2(r.y),
        width: r2(r.width),
        height: r2(r.height),
        fill: o.fill !== undefined ? o.fill : fillRole === "none" ? null : this.palette[fillRole],
        fillRole,
        stroke: o.stroke !== undefined ? o.stroke : strokeRole === "none" ? null : this.palette[strokeRole],
        strokeRole,
      }),
    );
  }

  rect(r: Rect, o: Partial<ShapeLayer> = {}): ShapeLayer {
    return this.shape("rect", r, { name: "Block", ...o });
  }

  /** Horizontal hairline / rule. `weight` is the stroke thickness. */
  rule(x: number, y: number, width: number, weight = 2, o: Partial<ShapeLayer> = {}): ShapeLayer {
    return this.shape("line", { x, y: y - weight / 2, width, height: weight }, { name: "Rule", ...o });
  }

  /** Vertical rule, drawn as a thin rectangle so it stays axis aligned. */
  vrule(x: number, y: number, height: number, weight = 2, o: Partial<ShapeLayer> = {}): ShapeLayer {
    return this.shape("rect", { x: x - weight / 2, y, width: weight, height }, { name: "Vertical rule", fillRole: "ink", ...o });
  }

  image(assetId: string, r: Rect, o: Omit<Partial<ImageLayer>, "effects"> & { effects?: Partial<ImageLayer["effects"]> } = {}): ImageLayer {
    const { effects, ...rest } = o;
    return this.push(
      createImageLayer(assetId.startsWith("builtin:") ? assetId : `builtin:${assetId}`, {
        name: "Image",
        ...rest,
        x: r2(r.x),
        y: r2(r.y),
        width: r2(r.width),
        height: r2(r.height),
        effects: { ...defaultEffects(), ...effects },
      }),
    );
  }

  texture(kind: TextureKind, o: Partial<TextureLayer> & { seed: number }, r: Rect = this.page): TextureLayer {
    return this.push(createTextureLayer(kind, r.width, r.height, { ...o, x: r.x, y: r.y }));
  }

  doc(): DesignDocument {
    return createDocument(this.w, this.h, {
      background: { color: this.palette.background, transparent: false },
      layers: this.layers,
      grid: this.grid,
      styleId: this.styleId,
    });
  }
}

export function compose(
  w: number,
  h: number,
  grid: GridSpec,
  styleId: string,
  paletteIndex = 0,
  overrides: Partial<StylePalette> = {},
): Composer {
  return new Composer(w, h, makeGrid(w, h, grid), { ...paletteOf(styleId, paletteIndex), ...overrides }, styleId);
}

/** Zero-padded index, e.g. pad(7) → "07". */
export const pad = (n: number, len = 2) => String(n).padStart(len, "0");
