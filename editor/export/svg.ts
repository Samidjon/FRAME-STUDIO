import type { ImageLayer, Layer, ShapeLayer, TextLayer, TextureLayer } from "@/types/layer";
import type { DesignDocument } from "@/types/project";
import { browserMeasure, layoutText, type MeasureFn } from "@/core/text/layout";
import { pathToSvgD, shapePath } from "@/core/rendering/paths";
import { imageOutputSize } from "@/core/rendering/draw";
import { processImage, type ImageSource } from "@/core/rendering/image-pipeline";
import { renderTexture } from "@/core/rendering/textures";
import { parseColor } from "@/core/rendering/color";
import { findFont, nearestWeight } from "@/lib/fonts/catalog";

/**
 * SVG export. Shapes are true vector paths, text is live <text> positioned with
 * the exact same layout engine as the canvas, and raster content (images with
 * their baked effects/masks, textures) is embedded as PNG data URLs.
 *
 * `buildSvg` is synchronous and pure given injected measure / source / encoder,
 * so it can be unit-tested without real fonts or images.
 */

export interface SvgBuildOptions {
  /** Do not paint the document background. Defaults to doc.background.transparent. */
  transparent?: boolean;
  /** Text measurer; defaults to the browser canvas measurer used by the editor. */
  measure?: MeasureFn;
  /** Image source lookup; images without a source are skipped (and noted). */
  getSource?: (assetId: string) => ImageSource | null;
  /** Output px per document px for embedded rasters (images, textures). Default 1. */
  imageScale?: number;
  /** Canvas → data URL encoder (injectable for tests). Defaults to PNG toDataURL. */
  encodeCanvas?: (c: HTMLCanvasElement) => string | null;
  /** Extra CSS placed in <style> (e.g. embedded @font-face rules). */
  fontCss?: string;
}

export interface SvgExportOptions extends Omit<SvgBuildOptions, "fontCss"> {
  embedFonts?: boolean;
  /** Fetch implementation (injectable for tests). */
  fetchFn?: typeof fetch;
}

export interface SvgResult {
  svg: string;
  /** Human readable notes about anything that could not be represented exactly. */
  notes: string[];
}

/* ------------------------------------------------------------------ helpers */

// Strip characters that are illegal in XML 1.0.
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(s: string): string {
  return s
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const n = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : r.toString();
};

/** Paint attributes; splits rgba / #rrggbbaa into colour + opacity for broad tool support. */
function paintAttrs(prop: "fill" | "stroke" | "flood-color", color: string | null | undefined): string {
  if (!color) return prop === "flood-color" ? "" : ` ${prop}="none"`;
  const s = color.trim();
  const opacityProp = prop === "flood-color" ? "flood-opacity" : `${prop}-opacity`;
  if (/^#|^rgba?\(/i.test(s)) {
    const c = parseColor(s);
    const hex = `#${[c.r, c.g, c.b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`;
    const a = Math.max(0, Math.min(1, c.a));
    return ` ${prop}="${hex}"${a < 1 ? ` ${opacityProp}="${n(a)}"` : ""}`;
  }
  return ` ${prop}="${escapeXml(s)}"`;
}

function groupOpen(l: Layer, extra = ""): string {
  const t = [`translate(${n(l.x)} ${n(l.y)})`];
  if (l.rotation) t.push(`rotate(${n(l.rotation)})`);
  const attrs = [`id="${escapeXml(svgId(l.id))}"`, `transform="${t.join(" ")}"`];
  if (l.opacity < 1) attrs.push(`opacity="${n(l.opacity)}"`);
  if (l.blendMode && l.blendMode !== "normal") attrs.push(`style="mix-blend-mode:${l.blendMode}"`);
  if (l.name) attrs.push(`data-name="${escapeXml(l.name)}"`);
  return `<g ${attrs.join(" ")}${extra}>`;
}

function svgId(id: string) {
  const s = id.replace(/[^A-Za-z0-9_-]/g, "_");
  return /^[A-Za-z_]/.test(s) ? s : `l_${s}`;
}

function fontFamilyAttr(family: string): string {
  if (family.includes(",")) return family.replace(/"/g, "'");
  return `'${family.replace(/'/g, "")}', 'Inter', sans-serif`;
}

/* ------------------------------------------------------------------ layers */

export function shapeToSvg(l: ShapeLayer): string {
  const d = pathToSvgD(shapePath(l));
  if (!d) return "";
  const dash = l.dash?.length ? ` stroke-dasharray="${l.dash.map(n).join(" ")}"` : "";
  let body: string;
  if (l.shape === "line") {
    body = `<path d="${d}" fill="none"${paintAttrs("stroke", l.stroke ?? l.fill ?? "#171717")} stroke-width="${n(Math.max(0.5, l.height))}" stroke-linecap="butt"${dash}/>`;
  } else {
    const stroke = l.stroke && l.strokeWidth > 0 ? `${paintAttrs("stroke", l.stroke)} stroke-width="${n(l.strokeWidth)}" stroke-linejoin="miter" stroke-miterlimit="10"${dash}` : "";
    body = `<path d="${d}"${paintAttrs("fill", l.fill)}${stroke}/>`;
  }
  return `${groupOpen(l)}${body}</g>`;
}

export function textToSvg(l: TextLayer, measure: MeasureFn, defs: string[]): string {
  const layout = layoutText(l, measure);
  const h = l.autoHeight ? layout.height : l.height;
  const w = l.vertical ? layout.width : l.width;
  const parts: string[] = [];
  if (l.backgroundColor) parts.push(`<rect x="0" y="0" width="${n(w)}" height="${n(h)}"${paintAttrs("fill", l.backgroundColor)}/>`);

  let filter = "";
  if (l.shadow.enabled) {
    const fid = `shadow-${svgId(l.id)}`;
    // Canvas shadowBlur ≈ 2 × Gaussian standard deviation.
    defs.push(
      `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feDropShadow dx="${n(l.shadow.offsetX)}" dy="${n(l.shadow.offsetY)}" stdDeviation="${n(Math.max(0, l.shadow.blur) / 2)}"${paintAttrs("flood-color", l.shadow.color)}/></filter>`,
    );
    filter = ` filter="url(#${fid})"`;
  }

  const attrs = [
    `font-family="${escapeXml(fontFamilyAttr(l.fontFamily))}"`,
    `font-size="${n(Math.max(1, l.fontSize))}"`,
    `font-weight="${l.fontWeight}"`,
  ];
  if (l.italic) attrs.push(`font-style="italic"`);
  if (layout.letterSpacingPx) attrs.push(`letter-spacing="${n(layout.letterSpacingPx)}"`);
  attrs.push(paintAttrs("fill", l.fill).trim());
  if (l.stroke && l.strokeWidth > 0) {
    attrs.push(`${paintAttrs("stroke", l.stroke).trim()} stroke-width="${n(l.strokeWidth * 2)}" stroke-linejoin="round" paint-order="stroke"`);
  }
  if (layout.glyphs) attrs.push(`text-anchor="middle"`);

  const spans: string[] = [];
  if (layout.glyphs) {
    for (const g of layout.glyphs) {
      if (!g.char.trim()) continue;
      spans.push(`<tspan x="${n(g.x)}" y="${n(g.y)}">${escapeXml(g.char)}</tspan>`);
    }
  } else {
    for (const line of layout.lines)
      for (const word of line.words) {
        if (!word.text) continue;
        spans.push(`<tspan x="${n(word.x)}" y="${n(line.baseline)}">${escapeXml(word.text)}</tspan>`);
      }
  }
  if (spans.length) parts.push(`<text ${attrs.join(" ")} xml:space="preserve"${filter}>${spans.join("")}</text>`);
  return `${groupOpen(l)}${parts.join("")}</g>`;
}

function defaultEncode(c: HTMLCanvasElement): string | null {
  try {
    const url = c.toDataURL("image/png");
    return url.startsWith("data:image/png") ? url : null;
  } catch {
    return null;
  }
}

function imageTag(href: string, w: number, h: number) {
  return `<image x="0" y="0" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none" xlink:href="${href}"/>`;
}

export function imageToSvg(l: ImageLayer, opts: Required<Pick<SvgBuildOptions, "imageScale" | "encodeCanvas">> & Pick<SvgBuildOptions, "getSource">, notes: string[]): string {
  const src = opts.getSource?.(l.assetId) ?? null;
  if (!src) {
    notes.push(`Image “${l.name}” could not be loaded and was skipped.`);
    return "";
  }
  const { w, h } = imageOutputSize(l, src, opts.imageScale, 16384);
  const url = opts.encodeCanvas(processImage(src, l, w, h));
  if (!url) {
    notes.push(`Image “${l.name}” could not be encoded and was skipped.`);
    return "";
  }
  return `${groupOpen(l)}${imageTag(url, l.width, l.height)}</g>`;
}

export function textureToSvg(l: TextureLayer, opts: Required<Pick<SvgBuildOptions, "imageScale" | "encodeCanvas">>, notes: string[]): string {
  const unit = Math.min(2, Math.max(0.25, opts.imageScale));
  const maxSide = 4096;
  let w = l.width * unit;
  let h = l.height * unit;
  const k = Math.max(w, h) > maxSide ? maxSide / Math.max(w, h) : 1;
  w *= k;
  h *= k;
  const url = opts.encodeCanvas(renderTexture(l, w, h, unit * k));
  if (!url) {
    notes.push(`Texture “${l.name}” could not be encoded and was skipped.`);
    return "";
  }
  return `${groupOpen(l)}${imageTag(url, l.width, l.height)}</g>`;
}

/* ------------------------------------------------------------------ document */

export function buildSvg(doc: DesignDocument, opts: SvgBuildOptions = {}, notes: string[] = []): string {
  const measure = opts.measure ?? browserMeasure;
  const raster = { imageScale: opts.imageScale ?? 1, encodeCanvas: opts.encodeCanvas ?? defaultEncode, getSource: opts.getSource };
  const transparent = opts.transparent ?? doc.background.transparent;
  const defs: string[] = [];
  const body: string[] = [];

  if (!transparent) body.push(`<rect id="background" x="0" y="0" width="${n(doc.width)}" height="${n(doc.height)}"${paintAttrs("fill", doc.background.color)}/>`);

  for (const l of doc.layers) {
    if (!l.visible || l.opacity <= 0) continue;
    switch (l.type) {
      case "shape":
        body.push(shapeToSvg(l));
        break;
      case "text":
        body.push(textToSvg(l, measure, defs));
        break;
      case "image":
        body.push(imageToSvg(l, raster, notes));
        break;
      case "texture":
        body.push(textureToSvg(l, raster, notes));
        break;
    }
  }

  const style = opts.fontCss ? `<style>\n${opts.fontCss.replace(INVALID_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}\n</style>` : "";
  const defsXml = defs.length || style ? `<defs>${style}${defs.join("")}</defs>` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${n(doc.width)}" height="${n(doc.height)}" viewBox="0 0 ${n(doc.width)} ${n(doc.height)}">` +
    `<title>Senitukang Studio export</title>` +
    defsXml +
    `<g id="artwork" style="isolation:isolate">${body.join("")}</g>` +
    `</svg>\n`
  );
}

/* ------------------------------------------------------------------ fonts */

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function parseUnicodeRange(range: string): [number, number][] {
  return range
    .split(",")
    .map((r) => r.trim().replace(/^U\+/i, ""))
    .filter(Boolean)
    .map((r) => {
      if (r.includes("?")) return [parseInt(r.replace(/\?/g, "0"), 16), parseInt(r.replace(/\?/g, "F"), 16)] as [number, number];
      const [a, b] = r.split("-");
      const lo = parseInt(a, 16);
      return [lo, b ? parseInt(b, 16) : lo] as [number, number];
    });
}

interface FontUse {
  family: string;
  styles: Set<string>; // "ital,wght" tuples e.g. "0,400"
  chars: Set<number>;
}

function collectFontUses(doc: DesignDocument): Map<string, FontUse> {
  const uses = new Map<string, FontUse>();
  for (const l of doc.layers) {
    if (l.type !== "text" || !l.visible) continue;
    const u = uses.get(l.fontFamily) ?? { family: l.fontFamily, styles: new Set<string>(), chars: new Set<number>() };
    const def = findFont(l.fontFamily);
    const italic = l.italic && !!def?.italic;
    u.styles.add(`${italic ? 1 : 0},${nearestWeight(l.fontFamily, l.fontWeight)}`);
    const text = l.uppercase ? l.text.toUpperCase() : l.text;
    for (const ch of text) u.chars.add(ch.codePointAt(0) ?? 0);
    uses.set(l.fontFamily, u);
  }
  return uses;
}

/** Fetch Google Fonts CSS for the used weights/styles and inline every needed woff2 as a data URL. */
export async function buildEmbeddedFontCss(doc: DesignDocument, notes: string[], fetchFn: typeof fetch = fetch): Promise<string> {
  const out: string[] = [];
  for (const use of collectFontUses(doc).values()) {
    const def = findFont(use.family);
    if (!def || !def.google) {
      notes.push(`Font “${use.family}” is a local/user font and was not embedded; the SVG references it by name.`);
      continue;
    }
    const tuples = [...use.styles].map((s) => s.split(",").map(Number) as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const fam = def.google.replace(/ /g, "+");
    const url = `https://fonts.googleapis.com/css2?family=${fam}:ital,wght@${tuples.map((t) => t.join(",")).join(";")}&display=swap`;
    try {
      const res = await fetchFn(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const css = await res.text();
      const blocks = css.match(/@font-face\s*{[^}]*}/g) ?? [];
      for (const block of blocks) {
        const range = /unicode-range:\s*([^;]+);/i.exec(block);
        if (range) {
          const ranges = parseUnicodeRange(range[1]);
          const needed = [...use.chars].some((cp) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi));
          if (!needed) continue;
        }
        const srcMatch = /url\(([^)]+)\)\s*format\(['"]?([a-z0-9]+)['"]?\)/i.exec(block);
        if (!srcMatch) continue;
        const fontUrl = srcMatch[1].replace(/['"]/g, "");
        const fmt = srcMatch[2].toLowerCase();
        const fr = await fetchFn(fontUrl);
        if (!fr.ok) throw new Error(`font file HTTP ${fr.status}`);
        const data = bufferToBase64(await fr.arrayBuffer());
        const mime = fmt === "woff2" ? "font/woff2" : fmt === "woff" ? "font/woff" : fmt === "truetype" ? "font/ttf" : "font/otf";
        out.push(block.replace(srcMatch[0], `url(data:${mime};base64,${data}) format('${fmt}')`));
      }
    } catch (e) {
      notes.push(`Font “${use.family}” could not be embedded (${e instanceof Error ? e.message : "network error"}); it is referenced by name.`);
    }
  }
  return out.join("\n");
}

/* ------------------------------------------------------------------ entry */

export async function exportSvgDetailed(doc: DesignDocument, opts: SvgExportOptions = {}): Promise<SvgResult> {
  const notes: string[] = [];
  let getSourceFn = opts.getSource;
  if (!getSourceFn && typeof document !== "undefined") {
    const [{ prepareDocument }, resources] = await Promise.all([import("@/lib/image/thumbnail"), import("@/lib/image/resources")]);
    await prepareDocument(doc);
    getSourceFn = resources.getSource;
  }
  const fontCss = opts.embedFonts ? await buildEmbeddedFontCss(doc, notes, opts.fetchFn ?? fetch) : "";
  const svg = buildSvg(doc, { ...opts, getSource: getSourceFn, fontCss }, notes);
  return { svg, notes };
}

export async function exportSvg(doc: DesignDocument, opts: SvgExportOptions = {}): Promise<string> {
  return (await exportSvgDetailed(doc, opts)).svg;
}
