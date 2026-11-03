import { compose } from "./kit";
import { FORMATS, type Template } from "./types";

/** Swiss / International Style and Modern Posters. */

const konkrete: Template = {
  id: "swiss-konkrete",
  name: "Konkrete Gestaltung",
  category: "Swiss / International Style",
  description: "Exhibition poster on a 6×8 modular grid: a single signal circle, flush-left grotesk and a three-column information band.",
  tags: ["grid", "exhibition", "grotesk", "circle"],
  ...FORMATS.portrait,
  featured: 1,
  styleId: "swiss",
  build() {
    const k = compose(1080, 1350, { type: "modular", columns: 6, rows: 8, margin: 0.06, gutter: 0.018 }, "swiss", 0);
    const { content } = k;
    const c2 = k.col(2);
    const c5 = k.col(5);
    const d = c5.right - c2.x;
    k.shape("circle", { x: c2.x, y: k.row(1).y, width: d, height: d }, { name: "Signal circle", fillRole: "accent" });
    k.rect({ x: k.col(0).x, y: k.row(1).y, width: k.col(0).width, height: k.col(0).width }, { name: "Index square", fillRole: "ink" });
    k.meta("01", k.col(0).x, k.row(1).y + k.col(0).width + 14, k.col(0).width, { name: "Index number", fillRole: "accent" });

    k.meta("FS—001", k.col(0).x, content.y, k.col(1).right - k.col(0).x);
    k.meta("Typografie · Raster · Farbe", k.col(2).x, content.y, k.col(3).right - k.col(2).x);
    k.meta("No. 01 / 2026", k.col(4).x, content.y, k.col(5).right - k.col(4).x, { align: "right" });
    k.rule(content.x, content.y + 34, content.width, 2, { name: "Header rule" });

    const titleBox = k.span(0, 5, 4, 6);
    k.fit("Konkrete\nGestaltung", titleBox, {
      role: "display",
      name: "Title",
      fontFamily: "Inter",
      fontWeight: 700,
      letterSpacing: -45,
      lineHeight: 0.88,
      max: 230,
      anchor: "bottom",
    });

    const r7 = k.row(7);
    k.rule(content.x, r7.y, content.width, 3, { name: "Footer rule" });
    const infoY = r7.y + 20;
    const w2 = k.col(1).right - k.col(0).x;
    k.text("Ausstellung\nMuseum für Gestaltung", { role: "subheading", name: "Venue", x: k.col(0).x, y: infoY, width: w2, fontFamily: "Inter", fontSize: 22, fontWeight: 600, letterSpacing: -10, lineHeight: 1.2 });
    k.text("12.03 — 28.06\n2026", { role: "subheading", name: "Dates", x: k.col(2).x, y: infoY, width: w2, fontFamily: "Inter", fontSize: 22, fontWeight: 600, letterSpacing: -10, lineHeight: 1.2 });
    k.body("Di–So 10–18 Uhr\nAusstellungsstrasse 60, Zürich", k.col(4).x, infoY, w2, { role: "caption", fontSize: 17, name: "Opening hours", fillRole: "muted" });
    k.texture("paper", { seed: 101, opacity: 0.4, blendMode: "multiply", color: k.color("ink"), name: "Paper grain" });
    return k.doc();
  },
};

const raster: Template = {
  id: "swiss-raster-a4",
  name: "Systeme der Ordnung",
  category: "Swiss / International Style",
  description: "A4 lecture poster in red and white: oversized numeral, monochrome photograph on the grid and a disciplined text column.",
  tags: ["A4", "lecture", "red", "photograph", "numeral"],
  ...FORMATS.a4,
  featured: 6,
  styleId: "swiss",
  build() {
    const k = compose(2480, 3508, { type: "modular", columns: 4, rows: 6, margin: 0.07, gutter: 0.02 }, "swiss", 1);
    const { content } = k;
    k.meta("FS—002", content.x, content.y, k.col(0).width, { fontSize: 34 });
    k.meta("Vortragsreihe\nGestaltung & System", k.col(1).x, content.y, k.col(1).width * 1.6, { fontSize: 34 });
    k.meta("Zürich\n47.3769° N\n8.5417° E", k.col(3).x, content.y, k.col(3).width, { fontSize: 34, align: "right" });

    const numBox = { ...k.span(0, 2, 0, 2), y: k.row(0).y + 160, height: k.span(0, 2, 0, 2).height - 160 };
    k.fit("24", numBox, { role: "display", name: "Numeral", fontFamily: "Inter", fontWeight: 800, letterSpacing: -70, lineHeight: 0.8, max: 1600, fillRole: "accent", anchor: "top" });

    const img = k.span(2, 3, 2, 4);
    k.image("concrete", img, { name: "Photograph — facade", effects: { grayscale: 100, contrast: 25 } });
    k.rect({ x: img.x, y: img.y + img.height - 36, width: img.width * 0.25, height: 36 }, { name: "Photo tab", fillRole: "ink" });

    const c3 = k.span(0, 1, 3, 3);
    k.fit("Systeme\nder Ordnung", c3, { role: "heading", name: "Heading", fontFamily: "Inter", fontWeight: 700, letterSpacing: -30, lineHeight: 0.95, max: 220, anchor: "top" });
    const textBox = k.span(0, 1, 4, 4);
    k.body(
      "Eine Vortragsreihe über Raster, Proportion und objektive Gestaltung. Sechs Abende, sechs Positionen — von der Buchtypografie bis zum Leitsystem.",
      textBox.x,
      textBox.y,
      textBox.width * 0.92,
      { fontSize: 50, lineHeight: 1.3, name: "Intro text" },
    );
    const r5 = k.row(5);
    k.rule(content.x, r5.y, content.width, 6, { name: "Footer rule", strokeRole: "ink" });
    const dates = ["07.10", "14.10", "21.10", "28.10"];
    dates.forEach((d, i) => {
      const c = k.col(i);
      k.text(d, { role: "subheading", name: `Date ${i + 1}`, x: c.x, y: r5.y + 50, width: c.width, fontFamily: "Inter", fontSize: 96, fontWeight: 700, letterSpacing: -30, lineHeight: 1 });
      k.meta(`Abend ${String(i + 1).padStart(2, "0")} · 19:00`, c.x, r5.y + 175, c.width, { fontSize: 32 });
    });
    k.texture("grid", { seed: 202, opacity: 0.08, blendMode: "normal", color: k.color("ink"), name: "Construction grid", scale: 3 });
    return k.doc();
  },
};

const signal: Template = {
  id: "modern-signal-story",
  name: "Signal / Noise",
  category: "Modern Posters",
  description: "Vertical story poster: wave image across the top two-thirds, tight display stack and a live badge.",
  tags: ["story", "dark", "live", "waves"],
  ...FORMATS.story,
  featured: 3,
  styleId: "swiss",
  build() {
    const k = compose(1080, 1920, { type: "modular", columns: 6, rows: 12, margin: 0.06, gutter: 0.016 }, "swiss", 2);
    const { content } = k;
    k.image("waves", { x: 0, y: 0, width: 1080, height: k.row(6).bottom }, { name: "Signal waves", effects: { contrast: 15, grain: 18 } });
    k.meta("FS—003", content.x, content.y, 300, { fillRole: "none", fill: "#F0EDE5" });
    k.meta("Broadcast 21.11.2026", k.col(3).x, content.y, k.col(5).right - k.col(3).x, { align: "right", fillRole: "none", fill: "#F0EDE5" });

    const badgeY = k.row(7).y + 10;
    k.shape("rect", { x: content.x, y: badgeY, width: 230, height: 54 }, { name: "Live badge", fillRole: "accent", cornerRadius: 27 });
    k.meta("● Live 21:00", content.x + 26, badgeY + 17, 190, { name: "Badge label", fillRole: "background", fontSize: 16 });

    const title = k.span(0, 5, 8, 10);
    k.fit("Signal\n/ Noise", title, { role: "display", name: "Title", fontFamily: "Inter", fontWeight: 800, letterSpacing: -55, lineHeight: 0.86, max: 300, anchor: "bottom" });
    const r11 = k.row(11);
    k.rule(content.x, r11.y, content.width, 2, { name: "Footer rule" });
    const half = (content.width - k.grid.gutter) / 2;
    k.body("A night of generative sound and light. Four hours, one frequency.", content.x, r11.y + 22, half, { fontSize: 22, name: "Description", fillRole: "muted" });
    k.meta("Hall 3 — Kanal\nBerlin 52.52° N", content.x + half + k.grid.gutter, r11.y + 24, half, { align: "right" });
    k.shape("triangle", { x: k.col(5).right - 70, y: k.row(7).y + 10, width: 70, height: 54 }, { name: "Play arrow", fillRole: "ink", rotation: 0 });
    k.texture("film-grain", { seed: 303, opacity: 0.35, blendMode: "overlay", color: "#F0EDE5", name: "Film grain" });
    return k.doc();
  },
};

const softShapes: Template = {
  id: "modern-soft-shapes",
  name: "The Shape of Soft Things",
  category: "Modern Posters",
  description: "Lavender exhibition poster with an arch-masked colour field, italic serif headline and a star accent.",
  tags: ["arch", "serif", "lavender", "exhibition"],
  ...FORMATS.portrait,
  featured: 4,
  styleId: "experimental",
  build() {
    const k = compose(1080, 1350, { type: "modular", columns: 8, rows: 10, margin: 0.065, gutter: 0.016 }, "experimental", 0);
    const { content } = k;
    const arch = k.span(1, 6, 1, 6);
    k.image("bloom", arch, { name: "Arch image — bloom", mask: "arch", effects: { saturation: 10, grain: 12 } });
    k.shape("star", { x: k.col(6).x, y: k.row(0).y + 10, width: 150, height: 150 }, { name: "Star accent", fillRole: "accent", sides: 8, innerRatio: 0.55 });
    k.meta("FS—004 / Exhibition", content.x, content.y, 360);
    k.meta("Room 02\nFloor 1", content.x, k.row(2).y, k.col(0).width + 40, { name: "Room" });
    const head = k.span(0, 7, 7, 8);
    k.fit("The shape of\nsoft things", head, { role: "display", name: "Title", fontFamily: "Instrument Serif", fontWeight: 400, italic: true, letterSpacing: -20, lineHeight: 0.92, max: 170, anchor: "center" });
    const r9 = k.row(9);
    k.rule(content.x, r9.y, content.width, 1.5, { name: "Footer rule" });
    const q = (content.width - k.grid.gutter * 3) / 4;
    ["Opening", "Fri 14.11", "18:00 — late", "Free entry"].forEach((t, i) =>
      k.text(t, { role: "caption", name: `Info ${i + 1}`, x: content.x + i * (q + k.grid.gutter), y: r9.y + 18, width: q, fontFamily: "Space Grotesk", fontSize: 21, fontWeight: 500, letterSpacing: -5 }),
    );
    k.meta("Curated by\nStudio Neue Form", content.x, r9.y + 64, q * 2, { fillRole: "muted" });
    k.texture("halftone", { seed: 404, opacity: 0.12, blendMode: "multiply", color: k.color("ink"), name: "Halftone screen", scale: 1.2 });
    return k.doc();
  },
};

export const SWISS_TEMPLATES: Template[] = [konkrete, raster, signal, softShapes];
