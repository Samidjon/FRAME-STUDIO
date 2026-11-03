import { compose } from "./kit";
import { FORMATS, type Template } from "./types";

/** Photography, Abstract and Architecture. */

const WHITE = "#FFFFFF";

const redDune: Template = {
  id: "photo-red-dune",
  name: "Red Dune — Plate 07",
  category: "Photography",
  description: "Full-bleed photograph with an inset hairline frame and a paper caption plate set on the grid.",
  tags: ["photo", "full-bleed", "caption", "landscape"],
  ...FORMATS.portrait,
  featured: 15,
  styleId: "swiss",
  build() {
    const k = compose(1080, 1350, { type: "modular", columns: 6, rows: 8, margin: 0.06, gutter: 0.018 }, "swiss", 0);
    const { content } = k;
    k.image("dune", k.page, { name: "Photograph — red dune", effects: { contrast: 8, grain: 14 } });
    const inset = 32;
    k.rect({ x: inset, y: inset, width: 1080 - inset * 2, height: 1350 - inset * 2 }, { name: "Hairline frame", fill: null, fillRole: "none", stroke: WHITE, strokeRole: "none", strokeWidth: 1.5 });
    k.meta("FS—007 / Photography", content.x, content.y, 420, { fillRole: "none", fill: WHITE, name: "Catalogue" });
    k.meta("Medium format 6×7", k.col(3).x, content.y, k.col(5).right - k.col(3).x, { fillRole: "none", fill: WHITE, align: "right", name: "Camera" });
    const plate = k.span(0, 3, 6, 7);
    k.rect(plate, { name: "Caption plate", fillRole: "paper" });
    const pad = 28;
    k.meta("Plate 07", plate.x + pad, plate.y + pad, 200, { fillRole: "accent", name: "Plate number" });
    k.fit("Red Dune", { x: plate.x + pad, y: plate.y + pad + 34, width: plate.width - pad * 2, height: 110 }, { role: "heading", name: "Title", fontFamily: "Inter", fontWeight: 700, letterSpacing: -40, lineHeight: 0.95, max: 110, anchor: "top" });
    k.bottomAt(
      k.body("Erg Chebbi, Morocco\n31.1490° N, 4.0310° W", plate.x + pad, 0, plate.width - pad * 2, { role: "caption", fontSize: 18, fillRole: "muted", name: "Location" }),
      plate.y + plate.height - pad,
    );
    k.texture("film-grain", { seed: 707, opacity: 0.3, blendMode: "overlay", color: WHITE, name: "Film grain" });
    return k.doc();
  },
};

const ridges: Template = {
  id: "photo-ridges-phone",
  name: "Ridges — Phone Wallpaper",
  category: "Photography",
  description: "Monochrome mountain photograph for phones: clock-safe top, rounded hairline frame and a quiet caption block.",
  tags: ["wallpaper", "phone", "monochrome", "mountains"],
  ...FORMATS.phone,
  featured: 16,
  styleId: "monochrome",
  build() {
    const k = compose(1179, 2556, { type: "column", columns: 6, rows: 1, margin: 0.07, gutter: 0.02 }, "monochrome", 1);
    const { content } = k;
    k.image("ridges", k.page, { name: "Photograph — ridges", crop: { x: 0.2, y: 0, width: 0.6, height: 1 }, effects: { grayscale: 100, contrast: 22, grain: 12 } });
    k.rect({ x: 0, y: 1760, width: 1179, height: 796 }, { name: "Shade", fillRole: "background", opacity: 0.55 });
    k.rect({ x: 36, y: 36, width: 1179 - 72, height: 2556 - 72 }, { name: "Rounded frame", fill: null, fillRole: "none", stroke: k.color("ink"), strokeRole: "ink", strokeWidth: 2, cornerRadius: 110, opacity: 0.6 });
    k.meta("№ 08", content.x, 1900, 200, { fontFamily: "IBM Plex Mono", fontSize: 20, fillRole: "accent", name: "Index" });
    k.text("Ridges", { role: "display", name: "Title", x: content.x, y: 1945, width: content.width, fontFamily: "Familjen Grotesk", fontSize: 170, fontWeight: 600, letterSpacing: -40, lineHeight: 0.95 });
    k.rule(content.x, 2160, content.width, 1.5, { name: "Rule" });
    k.meta("Alt. 2,962 m — Wetterstein", content.x, 2190, content.width * 0.6, { fontFamily: "IBM Plex Mono", fontSize: 20, name: "Altitude" });
    k.meta("47.4211° N\n10.9853° E", content.x + content.width * 0.6, 2190, content.width * 0.4, { fontFamily: "IBM Plex Mono", fontSize: 20, align: "right", name: "Coordinates" });
    k.texture("film-grain", { seed: 808, opacity: 0.35, blendMode: "overlay", color: "#F2F2F2", name: "Film grain" });
    return k.doc();
  },
};

const bauhaus: Template = {
  id: "abstract-form-function",
  name: "Form folgt Funktion",
  category: "Abstract",
  description: "Bauhaus-inspired square: circle, square and triangle in primaries on a 4×4 module with a diagonal rule.",
  tags: ["bauhaus", "geometry", "primary", "square"],
  ...FORMATS.square,
  featured: 17,
  styleId: "bauhaus",
  build() {
    const k = compose(1080, 1080, { type: "modular", columns: 4, rows: 4, margin: 0.06, gutter: 0 }, "bauhaus", 0);
    const { content } = k;
    const c = k.span(0, 1, 0, 1);
    k.rect(k.span(2, 3, 1, 3), { name: "Blue square", fillRole: "muted" });
    k.shape("circle", c, { name: "Red circle", fillRole: "accent" });
    k.shape("triangle", k.span(0, 1, 2, 3), { name: "Yellow triangle", fillRole: "paper" });
    const s = k.span(1, 2, 1, 2);
    k.shape("circle", { x: s.x + s.width / 2 - 55, y: s.y + s.height / 2 - 55, width: 110, height: 110 }, { name: "Black dot", fillRole: "ink" });
    const diag = Math.hypot(content.width, content.height);
    k.shape("line", { x: content.x, y: content.y, width: diag, height: 6 }, { name: "Diagonal rule", rotation: 45, strokeRole: "ink" });
    k.text("Form folgt\nFunktion", { role: "heading", name: "Title", x: k.col(2).x + 20, y: content.y + 10, width: k.col(3).right - k.col(2).x - 20, fontFamily: "Archivo", fontSize: 56, fontWeight: 800, letterSpacing: -20, lineHeight: 0.95, uppercase: true });
    k.meta("FS—013\nBauhaus 1919—2026", k.col(2).x + 20, content.y + 150, k.col(3).right - k.col(2).x - 20, { fontFamily: "Space Mono", name: "Catalogue" });
    k.texture("paper", { seed: 1313, opacity: 0.45, blendMode: "multiply", color: k.color("ink"), name: "Paper grain" });
    return k.doc();
  },
};

const chromatic: Template = {
  id: "abstract-chromatic-field",
  name: "Chromatic Field",
  category: "Abstract",
  description: "Desktop wallpaper: a soft-focus colour bloom against concentric hairline circles and a compact title block.",
  tags: ["wallpaper", "gradient", "circles", "blur"],
  ...FORMATS.desktop,
  featured: 18,
  styleId: "retro-futurism",
  build() {
    const k = compose(1920, 1080, { type: "column", columns: 12, rows: 1, margin: 0.07, gutter: 0.015 }, "retro-futurism", 2);
    const { content } = k;
    k.image("bloom", { x: k.col(5).x, y: 0, width: 1920 - k.col(5).x, height: 1080 }, { name: "Colour bloom", effects: { blur: 26, saturation: 15 } });
    const cx = k.col(3).x;
    const cy = 540;
    [760, 560, 360].forEach((d, i) =>
      k.shape("circle", { x: cx - d / 2, y: cy - d / 2, width: d, height: d }, { name: `Ring ${i + 1}`, fill: null, fillRole: "none", stroke: k.color("ink"), strokeRole: "ink", strokeWidth: 2 }),
    );
    k.shape("circle", { x: cx - 18, y: cy - 18, width: 36, height: 36 }, { name: "Centre point", fillRole: "accent" });
    k.vrule(k.col(4).right, content.y, content.height, 1.5, { name: "Vertical hairline" });
    k.meta("FS—014", content.x, content.y, 300, { fontFamily: "Space Mono", name: "Catalogue" });
    k.bottomAt(
      k.text("Chromatic\nField", { role: "heading", name: "Title", x: content.x, y: 0, width: k.col(3).right - content.x, fontFamily: "Syne", fontSize: 64, fontWeight: 700, letterSpacing: -30, lineHeight: 0.95 }),
      content.y + content.height - 44,
    );
    k.meta("Study in warm light — 2026", content.x, content.y + content.height - 20, 500, { fontFamily: "Space Mono", fontSize: 14, fillRole: "muted", name: "Subtitle" });
    k.texture("film-grain", { seed: 1414, opacity: 0.25, blendMode: "overlay", color: "#FFFFFF", name: "Film grain" });
    return k.doc();
  },
};

const betonBrut: Template = {
  id: "arch-beton-brut",
  name: "Béton Brut",
  category: "Architecture",
  description: "A4 architecture poster: monochrome facade, arch-masked detail, large grotesk title and a ruled specification table.",
  tags: ["architecture", "A4", "concrete", "table", "monochrome"],
  ...FORMATS.a4,
  featured: 19,
  styleId: "monochrome",
  build() {
    const k = compose(2480, 3508, { type: "modular", columns: 6, rows: 12, margin: 0.06, gutter: 0.012 }, "monochrome", 0);
    const { content } = k;
    k.meta("FS—020 / Architecture", content.x, content.y, 900, { fontFamily: "IBM Plex Mono", fontSize: 34, name: "Catalogue" });
    k.meta("Sheet 01 / 04", k.col(4).x, content.y, k.col(5).right - k.col(4).x, { fontFamily: "IBM Plex Mono", fontSize: 34, align: "right", name: "Sheet" });
    const img = k.span(0, 5, 1, 6);
    k.image("concrete", img, { name: "Photograph — facade", effects: { grayscale: 100, contrast: 18, grain: 10 } });
    k.texture("lines", { seed: 2020, opacity: 0.12, blendMode: "multiply", color: k.color("ink"), scale: 2.5, name: "Section hatching" }, img);
    const arch = k.span(4, 5, 7, 9);
    k.image("concrete", arch, { name: "Detail — arch", mask: "arch", crop: { x: 0.45, y: 0.3, width: 0.4, height: 0.5 }, effects: { grayscale: 100, contrast: 30 } });
    k.fit("Béton\nBrut", k.span(0, 3, 7, 8), { role: "display", name: "Title", fontFamily: "Familjen Grotesk", fontWeight: 600, letterSpacing: -40, lineHeight: 0.9, max: 600, anchor: "top" });
    const specs = [
      ["Architect", "Atelier Weiss"],
      ["Completed", "1968"],
      ["Floor area", "4,200 m²"],
      ["Location", "Marseille, FR"],
    ];
    const top = k.row(9).y + 40;
    const rowH = (k.row(11).bottom - top) / specs.length;
    specs.forEach(([a, b], i) => {
      const y = top + i * rowH;
      k.rule(content.x, y, k.col(3).right - content.x, 3, { name: `Spec rule ${i + 1}` });
      k.meta(a, content.x, y + 30, k.col(1).right - content.x, { fontFamily: "IBM Plex Mono", fontSize: 34, fillRole: "muted", name: `Spec label ${i + 1}` });
      k.text(b, { role: "subheading", name: `Spec value ${i + 1}`, x: k.col(2).x, y: y + 18, width: k.col(3).right - k.col(2).x, fontFamily: "Familjen Grotesk", fontSize: 64, fontWeight: 500, letterSpacing: -15, lineHeight: 1.1 });
    });
    k.meta("43.2617° N\n5.3963° E", k.col(4).x, k.row(11).bottom - 90, k.col(5).right - k.col(4).x, { fontFamily: "IBM Plex Mono", fontSize: 34, align: "right", name: "Coordinates" });
    return k.doc();
  },
};

const thresholds: Template = {
  id: "arch-thresholds",
  name: "Thresholds",
  category: "Architecture",
  description: "Night-blue architecture talk poster: arch-masked duotone facade over an offset ochre block, with plan-like rules.",
  tags: ["arch", "duotone", "blue", "talk"],
  ...FORMATS.portrait,
  featured: 20,
  styleId: "modernist",
  build() {
    const k = compose(1080, 1350, { type: "modular", columns: 5, rows: 10, margin: 0.065, gutter: 0.018 }, "modernist", 2);
    const { content } = k;
    k.rect(k.span(2, 4, 2, 7), { name: "Offset block", fillRole: "accent" });
    k.image("concrete", k.span(1, 3, 1, 6), {
      name: "Arch — facade",
      mask: "arch",
      effects: { duotone: { enabled: true, shadow: k.color("paper"), highlight: k.color("ink") }, contrast: 10 },
    });
    for (let i = 0; i < 5; i++) k.rule(content.x, k.row(1).y + i * 60, k.col(0).width * (1 - i * 0.15), 1.5, { name: `Plan rule ${i + 1}`, strokeRole: "muted" });
    k.meta("Plan\n1:200", content.x, k.row(4).y, k.col(0).width, { fontFamily: "IBM Plex Mono", fillRole: "muted", name: "Scale" });
    k.meta("FS—021", content.x, content.y, 300, { fontFamily: "IBM Plex Mono", name: "Catalogue" });
    k.meta("Lecture series / Architecture", k.col(2).x, content.y, k.col(4).right - k.col(2).x, { fontFamily: "IBM Plex Mono", align: "right", name: "Series" });
    k.fit("Thresholds", k.span(0, 4, 7, 8), { role: "display", name: "Title", fontFamily: "Hanken Grotesk", fontWeight: 700, letterSpacing: -45, lineHeight: 0.9, max: 210, anchor: "center" });
    const r9 = k.row(9);
    k.rule(content.x, r9.y, content.width, 2, { name: "Footer rule" });
    k.body("On doors, arches and the spaces between inside and out.", content.x, r9.y + 20, k.col(2).right - content.x, { fontFamily: "Hanken Grotesk", fontSize: 20, name: "Description" });
    k.meta("Thu 20.11 — 19:00\nPavilion B", k.col(3).x, r9.y + 22, k.col(4).right - k.col(3).x, { fontFamily: "IBM Plex Mono", align: "right", name: "Date & place" });
    k.texture("noise", { seed: 2121, opacity: 0.2, blendMode: "soft-light", color: "#FFFFFF", name: "Noise" });
    return k.doc();
  },
};

export const VISUAL_TEMPLATES: Template[] = [redDune, ridges, bauhaus, chromatic, betonBrut, thresholds];
