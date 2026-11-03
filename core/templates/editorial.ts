import { compose } from "./kit";
import { FORMATS, type Template } from "./types";

/** Japanese Editorial, Minimalism and Experimental Typography. */

const ma: Template = {
  id: "jp-ma-a4",
  name: "間 — The Aesthetics of Ma",
  category: "Japanese Editorial",
  description: "A4 editorial spread-poster: vertical serif kanji, a duotone landscape, bilingual text columns and a single vermilion circle.",
  tags: ["japanese", "vertical", "bilingual", "duotone", "A4"],
  ...FORMATS.a4,
  featured: 2,
  styleId: "japanese-editorial",
  build() {
    const k = compose(2480, 3508, { type: "modular", columns: 8, rows: 12, margin: 0.07, gutter: 0.012 }, "japanese-editorial", 0);
    const { content } = k;
    const mono = { fontFamily: "IBM Plex Mono", fontSize: 32, letterSpacing: 120 };
    k.meta("第三号 — Vol.03", content.x, content.y, 700, { ...mono, name: "Issue" });
    k.meta("FS—005 · 2026.11", k.col(5).x, content.y, k.col(7).right - k.col(5).x, { ...mono, align: "right", name: "Catalogue" });
    k.rule(content.x, content.y + 70, content.width, 2, { name: "Header hairline" });

    const img = k.span(0, 4, 1, 6);
    k.image("ridges", img, { name: "Landscape — ridges", effects: { duotone: { enabled: true, shadow: k.color("ink"), highlight: k.color("paper") }, grain: 14 } });

    const vSize = 380;
    const vx = k.col(6).x + (k.col(7).right - k.col(6).x - vSize) / 2;
    k.text("間の美学", {
      role: "display",
      name: "Vertical title — 間の美学",
      x: vx,
      y: k.row(1).y,
      width: vSize,
      vertical: true,
      fontFamily: "Noto Serif JP",
      fontSize: vSize,
      fontWeight: 500,
      letterSpacing: 60,
      lineHeight: 1,
    });
    k.meta("Ma no bigaku", k.col(5).x, k.row(1).y, k.col(5).width, { ...mono, name: "Romanisation", fillRole: "muted", vertical: false });

    const d = k.col(5).width;
    k.shape("circle", { x: k.col(5).x, y: k.row(6).bottom - d, width: d, height: d }, { name: "Vermilion circle", fillRole: "accent" });

    const head = k.span(0, 4, 7, 8);
    k.fit("The Aesthetics\nof Negative Space", head, {
      role: "heading",
      name: "Heading",
      fontFamily: "Noto Serif JP",
      fontWeight: 500,
      letterSpacing: -10,
      lineHeight: 1.05,
      max: 230,
      anchor: "top",
    });
    const jp = k.span(0, 2, 9, 10);
    k.text("余白は沈黙ではない。 形が呼吸するための空間であり、 見る者が想像を置く場所である。", {
      role: "body",
      name: "Body — Japanese",
      x: jp.x,
      y: jp.y,
      width: jp.width,
      fontFamily: "Noto Sans JP",
      fontSize: 44,
      fontWeight: 400,
      lineHeight: 1.8,
      letterSpacing: 40,
    });
    const en = k.span(3, 5, 9, 10);
    k.body("Empty space is not silence. It is the room in which form breathes and where the viewer places imagination — the interval between things, called ma.", en.x, en.y, en.width, {
      fontFamily: "Noto Sans JP",
      fontSize: 46,
      lineHeight: 1.55,
      name: "Body — English",
    });
    k.vrule(k.col(6).x - k.grid.gutter / 2, k.row(7).y, k.row(11).bottom - k.row(7).y, 2, { name: "Column hairline" });
    k.meta("Editorial\nSeries\n編集", k.col(6).x + 20, k.row(9).y, k.col(7).right - k.col(6).x - 20, { ...mono, name: "Series" });
    const r11 = k.row(11);
    k.rule(content.x, r11.bottom - 70, k.col(5).right - content.x, 2, { name: "Footer hairline" });
    k.meta("京都 Kyoto — 35.0116° N, 135.7681° E", content.x, r11.bottom - 40, k.col(5).right - content.x, { ...mono, name: "Coordinates" });
    k.texture("paper", { seed: 505, opacity: 0.45, blendMode: "multiply", color: k.color("ink"), name: "Washi paper" });
    return k.doc();
  },
};

const tokyo: Template = {
  id: "jp-tokyo-nocturne",
  name: "東京夜景 Tokyo Nocturne",
  category: "Japanese Editorial",
  description: "Night-series story: bokeh photograph, stacked vertical gothic kanji, vermilion marker and coordinate marginalia.",
  tags: ["japanese", "story", "night", "vertical", "photo"],
  ...FORMATS.story,
  featured: 9,
  styleId: "japanese-editorial",
  build() {
    const k = compose(1080, 1920, { type: "modular", columns: 6, rows: 12, margin: 0.06, gutter: 0.015 }, "japanese-editorial", 1);
    const { content } = k;
    k.meta("夜 / Night Series 04", content.x, content.y, 520, { fontFamily: "IBM Plex Mono", name: "Series" });
    k.meta("FS—006", k.col(4).x, content.y, k.col(5).right - k.col(4).x, { fontFamily: "IBM Plex Mono", align: "right", name: "Catalogue" });
    k.rule(content.x, content.y + 36, content.width, 1.5, { name: "Header hairline" });

    const img = k.span(0, 3, 1, 8);
    k.image("neon", img, { name: "Photograph — night bokeh", effects: { grain: 28, contrast: 10 } });
    const size = 150;
    k.text("東京夜景", {
      role: "display",
      name: "Vertical title — 東京夜景",
      x: k.col(4).x + (k.col(5).right - k.col(4).x - size) / 2,
      y: k.row(1).y,
      width: size,
      vertical: true,
      fontFamily: "Zen Kaku Gothic New",
      fontSize: size,
      fontWeight: 900,
      letterSpacing: 20,
      lineHeight: 1,
    });
    k.rect({ x: k.col(4).x, y: k.row(7).y, width: 14, height: k.row(8).bottom - k.row(7).y }, { name: "Vermilion bar", fillRole: "accent" });
    k.meta("Shinjuku\n23:47\n2026.11.03", k.col(4).x + 36, k.row(7).y, k.col(5).right - k.col(4).x - 36, { fontFamily: "IBM Plex Mono", name: "Timestamp", fillRole: "muted" });

    const head = k.span(0, 5, 9, 10);
    k.fit("Tokyo\nNocturne", head, { role: "heading", name: "Heading", fontFamily: "Zen Kaku Gothic New", fontWeight: 700, letterSpacing: -20, lineHeight: 0.95, max: 200, anchor: "top" });
    const r11 = k.row(11);
    k.body("光の粒が街を描く。 Light particles draw the city.", content.x, r11.y, k.col(3).right - content.x, { fontFamily: "Noto Sans JP", fontSize: 24, lineHeight: 1.6, name: "Caption — bilingual", role: "caption" });
    k.meta("35.6938° N\n139.7034° E", k.col(4).x, r11.y, k.col(5).right - k.col(4).x, { fontFamily: "IBM Plex Mono", align: "right", name: "Coordinates" });
    k.texture("film-grain", { seed: 606, opacity: 0.3, blendMode: "overlay", color: "#EFEAE0", name: "Film grain" });
    return k.doc();
  },
};

const horizon: Template = {
  id: "minimal-horizon-desktop",
  name: "Horizon 06:12",
  category: "Minimalism",
  description: "Desktop wallpaper built on thirds: one small photograph in the centre column, four corner micro-labels and a hairline.",
  tags: ["wallpaper", "desktop", "quiet", "thirds"],
  ...FORMATS.desktop,
  featured: 7,
  styleId: "minimal",
  build() {
    const k = compose(1920, 1080, { type: "thirds", columns: 3, rows: 3, margin: 0.08, gutter: 0 }, "minimal", 0);
    const { content } = k;
    const c1 = k.col(1);
    const iw = c1.width * 0.78;
    const ih = iw * 0.72;
    const ix = c1.x + (c1.width - iw) / 2;
    const iy = (1080 - ih) / 2 - 40;
    k.image("horizon", { x: ix, y: iy, width: iw, height: ih }, { name: "Photograph — horizon", effects: { saturation: -20, grain: 8 } });
    k.text("Horizon, 06:12", { role: "caption", name: "Caption", x: ix, y: iy + ih + 22, width: iw * 0.7, fontFamily: "Manrope", fontSize: 20, fontWeight: 500, letterSpacing: -5 });
    k.meta("Fig. 01", ix + iw * 0.7, iy + ih + 26, iw * 0.3, { fontFamily: "IBM Plex Mono", align: "right", fillRole: "muted", fontSize: 13, letterSpacing: 120 });
    const mono = { fontFamily: "IBM Plex Mono", fontSize: 13, letterSpacing: 120, fillRole: "muted" as const };
    k.meta("FS—009", content.x, content.y, 300, { ...mono, name: "Catalogue" });
    k.meta("Quiet Series", content.x + content.width - 300, content.y, 300, { ...mono, align: "right", name: "Series" });
    k.meta("1920 × 1080", content.x, content.y + content.height - 18, 300, { ...mono, name: "Format" });
    k.meta("46.2044° N 6.1432° E", content.x + content.width - 360, content.y + content.height - 18, 360, { ...mono, align: "right", name: "Coordinates" });
    k.rule(content.x, content.y + content.height - 40, content.width, 1, { name: "Hairline", strokeRole: "muted" });
    k.texture("paper", { seed: 707, opacity: 0.3, blendMode: "multiply", color: k.color("ink"), name: "Paper grain" });
    return k.doc();
  },
};

const stillness: Template = {
  id: "minimal-stillness-square",
  name: "Stillness",
  category: "Minimalism",
  description: "Square post with one disc, one word and a measured amount of nothing. Lavender haze palette.",
  tags: ["square", "circle", "calm", "lavender"],
  ...FORMATS.square,
  featured: 12,
  styleId: "minimal",
  build() {
    const k = compose(1080, 1080, { type: "thirds", columns: 3, rows: 3, margin: 0.09, gutter: 0 }, "minimal", 2);
    const { content } = k;
    const d = k.col(1).width * 0.92;
    k.shape("circle", { x: 540 - d / 2, y: k.row(1).y - d * 0.35, width: d, height: d }, { name: "Disc", fillRole: "accent" });
    const t = k.text("Stillness", { role: "display", name: "Title", x: content.x, y: k.row(2).y, width: content.width, align: "center", fontFamily: "Manrope", fontSize: 76, fontWeight: 400, letterSpacing: -30, lineHeight: 1 });
    k.rule(540 - 30, t.y + t.height + 26, 60, 1.5, { name: "Short rule" });
    k.text("An exercise in less.", { role: "caption", name: "Caption", x: content.x, y: t.y + t.height + 48, width: content.width, align: "center", fontFamily: "Inter", fontSize: 19, fontWeight: 400, letterSpacing: 0, fillRole: "muted" });
    const mono = { fontFamily: "IBM Plex Mono", fontSize: 13, letterSpacing: 140 };
    k.meta("No. 010", content.x, content.y, 240, { ...mono, name: "Index" });
    k.meta("2026", content.x + content.width - 240, content.y, 240, { ...mono, align: "right", name: "Year" });
    k.meta("FRAME STUDIO — Minimal Series", content.x, content.y + content.height - 18, content.width, { ...mono, align: "center", fillRole: "muted", name: "Credit" });
    k.texture("paper", { seed: 808, opacity: 0.25, blendMode: "multiply", color: k.color("ink"), name: "Paper grain" });
    return k.doc();
  },
};

const formStack: Template = {
  id: "exp-form-follows-feeling",
  name: "Form Follows Feeling",
  category: "Experimental Typography",
  description: "Stacked display words at shifting scales, an outlined echo, a rotated sidebar line and a halftone screen.",
  tags: ["stack", "outline", "orange", "rotated"],
  ...FORMATS.portrait,
  featured: 5,
  styleId: "experimental",
  build() {
    const k = compose(1080, 1350, { type: "asymmetrical", columns: 3, rows: 10, columnRatios: [1, 3, 1], margin: 0.045, gutter: 0.012 }, "experimental", 1);
    const { content } = k;
    const word = { role: "display" as const, fontFamily: "Syne", fontWeight: 800, letterSpacing: -60, lineHeight: 0.82, uppercase: true };
    const w = content.width - 70;
    k.fit("Form", { x: content.x, y: k.row(0).y + 40, width: w, height: k.row(2).bottom - k.row(0).y - 40 }, { ...word, name: "Word 1 — Form", max: 420, anchor: "top" });
    k.fit("Form", { x: content.x, y: k.row(3).y, width: w, height: k.row(4).bottom - k.row(3).y }, {
      ...word,
      name: "Word 2 — Form outline",
      fillRole: "background",
      stroke: k.color("ink"),
      strokeWidth: 2.5,
      max: 420,
      anchor: "top",
    });
    k.fit("Follows", { x: content.x, y: k.row(5).y, width: w * 0.8, height: k.row(5).height * 1.2 }, { ...word, name: "Word 3 — Follows", max: 200, anchor: "top" });
    k.fit("Feeling", { x: content.x + w * 0.18, y: k.row(6).y + 10, width: w * 0.82, height: k.row(7).bottom - k.row(6).y }, { ...word, name: "Word 4 — Feeling", fillRole: "accent", max: 300, anchor: "top" });
    k.text("Type is image — image is type", {
      role: "caption",
      name: "Rotated sidebar",
      x: 1080 - 28,
      y: content.y,
      width: 760,
      rotation: 90,
      fontFamily: "JetBrains Mono",
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: 60,
      uppercase: true,
    });
    k.shape("circle", { x: k.col(2).x, y: k.row(8).y - 20, width: 110, height: 110 }, { name: "Black dot", fillRole: "ink" });
    const r9 = k.row(9);
    k.rule(content.x, r9.y, content.width, 3, { name: "Footer rule" });
    k.meta("FS—011", content.x, r9.y + 20, k.col(0).width, { name: "Catalogue" });
    k.meta("Experimental Typography\nSyne 800 / Ratio 1:1.25", k.col(1).x, r9.y + 20, k.col(1).width, { name: "Specimen" });
    k.meta("№ 11", k.col(2).x, r9.y + 20, k.col(2).width, { align: "right", name: "Number" });
    k.texture("halftone", { seed: 909, opacity: 0.18, blendMode: "multiply", color: k.color("ink"), name: "Halftone", scale: 1.4 });
    return k.doc();
  },
};

const az: Template = {
  id: "exp-a-to-z-a4",
  name: "A—Z Specimen",
  category: "Experimental Typography",
  description: "Dark A4 type specimen: colliding monumental letters, a chrome disc, stacked vertical caps and a four-column data foot.",
  tags: ["specimen", "dark", "A4", "letters", "chrome"],
  ...FORMATS.a4,
  featured: 14,
  styleId: "experimental",
  build() {
    const k = compose(2480, 3508, { type: "modular", columns: 4, rows: 10, margin: 0.05, gutter: 0.015 }, "experimental", 2);
    const { content } = k;
    const big = { role: "display" as const, fontFamily: "Syne", fontWeight: 800, letterSpacing: 0, lineHeight: 0.8, uppercase: true };
    k.fit("A", { ...k.span(0, 2, 0, 4), y: k.row(0).y + 120, height: k.span(0, 2, 0, 4).height - 120 }, { ...big, name: "Letter A", max: 2600, anchor: "top" });
    const disc = k.span(2, 3, 3, 4);
    const d = Math.min(disc.width, disc.height * 1.4);
    k.image("chrome", { x: disc.x + disc.width - d, y: disc.y, width: d, height: d }, { name: "Chrome disc", mask: "circle", effects: { grayscale: 100, contrast: 20 } });
    k.fit("Z", k.span(1, 3, 4, 8), {
      ...big,
      name: "Letter Z — outline",
      fillRole: "background",
      stroke: k.color("accent"),
      strokeWidth: 8,
      max: 2600,
      anchor: "bottom",
    });
    k.text("TYPE\nIS\nIMAGE", {
      role: "heading",
      name: "Vertical caps",
      x: content.x,
      y: k.row(5).y,
      width: 360,
      vertical: true,
      fontFamily: "Space Grotesk",
      fontSize: 100,
      fontWeight: 700,
      letterSpacing: 0,
      lineHeight: 1.2,
      fillRole: "accent",
    });
    k.meta("FS—012", content.x, content.y, 600, { fontSize: 34, name: "Catalogue" });
    k.meta("Specimen / Syne Extra Bold", k.col(2).x, content.y, k.col(3).right - k.col(2).x, { fontSize: 34, align: "right", name: "Specimen" });
    const r9 = k.row(9);
    k.rule(content.x, r9.y, content.width, 4, { name: "Footer rule" });
    const labels = ["Weight\n800", "Tracking\n0 / 1000", "Leading\n0.80", "Glyphs\nA—Z 0—9"];
    labels.forEach((t, i) => k.meta(t, k.col(i).x, r9.y + 40, k.col(i).width, { fontSize: 36, name: `Spec ${i + 1}` }));
    k.texture("film-grain", { seed: 1010, opacity: 0.3, blendMode: "overlay", color: "#E9DAF5", name: "Film grain" });
    return k.doc();
  },
};

export const EDITORIAL_TEMPLATES: Template[] = [ma, tokyo, horizon, stillness, formStack, az];
