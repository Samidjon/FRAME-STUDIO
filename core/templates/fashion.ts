import { compose } from "./kit";
import { FORMATS, type Template } from "./types";
import { mulberry32 } from "@/core/geometry/random";

/** Fashion and Brutalism. */

const maison: Template = {
  id: "fashion-maison-cover",
  name: "Maison — The Metal Issue",
  category: "Fashion",
  description: "Magazine cover: full-bleed liquid chrome, didone masthead across the measure, italic cover lines and a barcode panel.",
  tags: ["magazine", "cover", "didone", "chrome"],
  ...FORMATS.portrait,
  featured: 21,
  styleId: "monochrome",
  build() {
    const k = compose(1080, 1350, { type: "modular", columns: 6, rows: 10, margin: 0.05, gutter: 0.016 }, "monochrome", 0);
    const { content } = k;
    k.image("chrome", k.page, { name: "Photograph — liquid chrome", effects: { contrast: 12, grain: 8 } });
    k.fit("MAISON", { x: content.x, y: content.y + 30, width: content.width, height: 260 }, {
      role: "display",
      name: "Masthead",
      fontFamily: "Bodoni Moda",
      fontWeight: 700,
      letterSpacing: -20,
      lineHeight: 0.85,
      align: "center",
      max: 300,
      anchor: "top",
    });
    k.meta("No. 27 — Winter 2026", content.x, content.y, content.width * 0.5, { fontFamily: "IBM Plex Mono", name: "Issue" });
    k.meta("€ 14 / CHF 16", content.x + content.width * 0.5, content.y, content.width * 0.5, { fontFamily: "IBM Plex Mono", align: "right", name: "Price" });
    const lines = k.span(0, 2, 4, 6);
    k.text("The Metal\nIssue", { role: "heading", name: "Cover line — lead", x: lines.x, y: lines.y, width: lines.width, fontFamily: "Playfair Display", fontSize: 64, fontWeight: 600, italic: true, letterSpacing: -20, lineHeight: 0.95 });
    k.rule(lines.x, lines.y + 150, 80, 3, { name: "Cover line rule", strokeRole: "accent" });
    k.text("Liquid tailoring & the new sheen", { role: "subheading", name: "Cover line — feature", x: lines.x, y: lines.y + 175, width: lines.width, fontFamily: "Playfair Display", fontSize: 28, fontWeight: 400, italic: true, letterSpacing: 0, lineHeight: 1.15 });
    k.text("+ 40 pages of\nwinter silhouettes", { role: "caption", name: "Cover line — extra", x: k.col(4).x, y: k.row(7).y, width: k.col(5).right - k.col(4).x, align: "right", fontFamily: "Inter", fontSize: 20, fontWeight: 600, letterSpacing: 0, lineHeight: 1.2 });
    const plate = { x: k.col(5).x - 40, y: k.row(9).y, width: k.col(5).width + 40, height: k.row(9).height };
    k.rect(plate, { name: "Barcode plate", fillRole: "paper" });
    const rng = mulberry32(27);
    let bx = plate.x + 14;
    let i = 0;
    while (bx < plate.x + plate.width - 20) {
      const bw = 2 + Math.floor(rng() * 4);
      k.rect({ x: bx, y: plate.y + 12, width: bw, height: plate.height - 40 }, { name: `Barcode bar ${++i}`, fillRole: "ink" });
      bx += bw + 2 + Math.floor(rng() * 5);
    }
    k.meta("9 771234 027", plate.x + 14, plate.y + plate.height - 24, plate.width - 28, { fontFamily: "IBM Plex Mono", fontSize: 12, letterSpacing: 40, name: "Barcode number" });
    k.meta("FS—022", content.x, k.row(9).bottom - 16, 200, { fontFamily: "IBM Plex Mono", name: "Catalogue" });
    return k.doc();
  },
};

const lookbook: Template = {
  id: "fashion-lookbook-ss27",
  name: "Lookbook SS27",
  category: "Fashion",
  description: "Story-format lookbook opener: arched and circular image crops, serif display and look-number index.",
  tags: ["lookbook", "story", "serif", "arch", "lavender"],
  ...FORMATS.story,
  featured: 22,
  styleId: "experimental",
  build() {
    const k = compose(1080, 1920, { type: "modular", columns: 6, rows: 12, margin: 0.06, gutter: 0.016 }, "experimental", 0);
    const { content } = k;
    k.meta("FS—023 / Spring—Summer 2027", content.x, content.y, content.width, { fontFamily: "JetBrains Mono", name: "Season" });
    k.rule(content.x, content.y + 36, content.width, 1.5, { name: "Header rule" });
    k.image("fold", k.span(0, 4, 1, 7), { name: "Arch — fabric fold", mask: "arch", effects: { contrast: 10, overlay: { enabled: true, color: k.color("accent"), opacity: 0.18, blend: "multiply" } } });
    const d = k.col(5).right - k.col(3).x;
    k.image("dune", { x: k.col(3).x, y: k.row(6).y, width: d, height: d }, { name: "Circle — texture study", mask: "circle", effects: { grain: 10 } });
    k.fit("Lookbook\nSS27", k.span(0, 4, 8, 9), { role: "display", name: "Title", fontFamily: "Instrument Serif", fontWeight: 400, letterSpacing: -25, lineHeight: 0.9, max: 230, anchor: "top" });
    const r10 = k.row(10);
    k.body("Twelve looks on softness, structure and the weight of light fabrics.", content.x, r10.y, k.col(3).right - content.x, { fontFamily: "Space Grotesk", fontSize: 24, name: "Introduction" });
    k.meta("Looks\n01 — 12", k.col(4).x, r10.y, k.col(5).right - k.col(4).x, { fontFamily: "JetBrains Mono", align: "right", name: "Look index" });
    k.rule(content.x, k.row(11).bottom - 30, content.width, 1.5, { name: "Footer rule" });
    k.meta("Paris — Milano — Tokyo", content.x, k.row(11).bottom - 6, content.width, { fontFamily: "JetBrains Mono", fontSize: 14, fillRole: "muted", name: "Cities" });
    k.texture("paper", { seed: 2323, opacity: 0.3, blendMode: "multiply", color: k.color("ink"), name: "Paper grain" });
    return k.doc();
  },
};

const noMoreNice: Template = {
  id: "brutal-no-more-nice",
  name: "No More Nice",
  category: "Brutalism",
  description: "Condensed manifesto poster that fills the frame edge to edge, with a black data block and an orange stamp.",
  tags: ["manifesto", "condensed", "loud", "stamp"],
  ...FORMATS.portrait,
  featured: 23,
  styleId: "brutalist",
  build() {
    const k = compose(1080, 1350, { type: "column", columns: 4, rows: 1, margin: 0.03, gutter: 0.008 }, "brutalist", 0);
    const { content } = k;
    const blockY = 1050;
    k.fit("No\nMore\nNice", { x: content.x, y: content.y + 40, width: content.width, height: blockY - content.y - 60 }, {
      role: "display",
      name: "Manifesto",
      fontFamily: "Anton",
      fontWeight: 400,
      uppercase: true,
      letterSpacing: -10,
      lineHeight: 0.84,
      max: 600,
      anchor: "top",
    });
    k.meta("FS—025 / Manifesto 01", content.x, content.y, 520, { fontFamily: "Space Mono", fontSize: 16, name: "Catalogue" });
    k.rect({ x: 0, y: blockY, width: 1080, height: 1350 - blockY }, { name: "Data block", fillRole: "ink" });
    const cols = ["01 Clarity over comfort.", "02 Structure is visible.", "03 Material is honest.", "04 Edges stay sharp."];
    cols.forEach((t, i) => k.text(t, { role: "caption", name: `Thesis ${i + 1}`, x: k.col(i).x, y: blockY + 40, width: k.col(i).width - 10, fontFamily: "Space Mono", fontSize: 19, fontWeight: 700, letterSpacing: 0, lineHeight: 1.3, fillRole: "background" }));
    k.rule(content.x, 1350 - 80, content.width, 4, { name: "Block rule", strokeRole: "background" });
    k.meta("Printed matter — not for decoration", content.x, 1350 - 56, content.width, { fontFamily: "Space Mono", fontSize: 15, fillRole: "background", name: "Footer" });
    const s = 260;
    k.shape("circle", { x: 1080 - s - 40, y: blockY - s * 0.62, width: s, height: s }, { name: "Stamp", fillRole: "accent" });
    k.text("Read\nAloud", { role: "subheading", name: "Stamp text", x: 1080 - s - 40 + 30, y: blockY - s * 0.62 + 78, width: s - 60, align: "center", rotation: 0, fontFamily: "Archivo Black", fontSize: 44, fontWeight: 400, letterSpacing: -10, lineHeight: 0.95, uppercase: true });
    k.texture("noise", { seed: 2525, opacity: 0.3, blendMode: "multiply", color: "#0A0A0A", name: "Noise" });
    return k.doc();
  },
};

const buildBreak: Template = {
  id: "brutal-build-break-repeat",
  name: "Build / Break / Repeat",
  category: "Brutalism",
  description: "Hazard-yellow A4 poster: three heavy words between thick rules, a halftoned concrete block and blue structural bars.",
  tags: ["A4", "yellow", "halftone", "rules", "heavy"],
  ...FORMATS.a4,
  featured: 24,
  styleId: "brutalist",
  build() {
    const k = compose(2480, 3508, { type: "modular", columns: 4, rows: 9, margin: 0.035, gutter: 0.01 }, "brutalist", 1);
    const { content } = k;
    const words = ["Build", "Break", "Repeat"];
    words.forEach((w, i) => {
      const r0 = i * 2;
      const box = k.span(0, 3, r0, r0 + 1);
      k.rule(content.x, box.y, content.width, 24, { name: `Thick rule ${i + 1}` });
      k.fit(w, { x: box.x, y: box.y + 50, width: i === 1 ? box.width * 0.72 : box.width, height: box.height - 50 }, {
        role: "display",
        name: `Word ${i + 1} — ${w}`,
        fontFamily: "Archivo Black",
        fontWeight: 400,
        uppercase: true,
        letterSpacing: -30,
        lineHeight: 0.86,
        max: 900,
        anchor: "center",
      });
    });
    const blueA = k.span(3, 3, 2, 3);
    k.rect({ x: blueA.x + blueA.width * 0.2, y: blueA.y + 60, width: blueA.width * 0.8, height: blueA.height - 60 }, { name: "Blue bar", fillRole: "accent" });
    const img = k.span(0, 1, 6, 8);
    k.image("concrete", img, { name: "Halftone — concrete", blendMode: "multiply", effects: { grayscale: 100, contrast: 30, halftone: { enabled: true, size: 26, angle: 30, color: "#0A0A0A" } } });
    const info = k.span(2, 3, 6, 8);
    k.rule(info.x, info.y, info.width, 24, { name: "Info rule" });
    k.text("A workshop on making, unmaking and making again.", { role: "heading", name: "Statement", x: info.x, y: info.y + 70, width: info.width, fontFamily: "Archivo", fontSize: 120, fontWeight: 800, letterSpacing: -30, lineHeight: 1 });
    k.meta("FS—026\n08—10.01.2027\nHalle 4, Rotterdam", info.x, info.y + info.height - 190, info.width * 0.6, { fontFamily: "Space Mono", fontSize: 44, letterSpacing: 40, name: "Details" });
    k.rect({ x: info.x + info.width - 260, y: info.y + info.height - 260, width: 260, height: 260 }, { name: "Blue square", fillRole: "accent" });
    k.texture("scanlines", { seed: 2626, opacity: 0.12, blendMode: "multiply", color: "#0A0A0A", scale: 3, name: "Scanlines" });
    return k.doc();
  },
};

export const FASHION_TEMPLATES: Template[] = [maison, lookbook, noMoreNice, buildBreak];
