import { compose } from "./kit";
import { FORMATS, type Template } from "./types";

/** Music / Album Art and Events. */

const orbit: Template = {
  id: "album-orbital-drift",
  name: "Orbital Drift",
  category: "Music / Album Art",
  description: "Retro-futurist LP cover: duotone planet in a circular mask, orbit rings, wide display title and a mono tracklist.",
  tags: ["album", "LP", "space", "duotone", "rings"],
  ...FORMATS.album,
  featured: 8,
  styleId: "retro-futurism",
  build() {
    const k = compose(3000, 3000, { type: "symmetrical", columns: 6, rows: 8, margin: 0.06, gutter: 0.015 }, "retro-futurism", 0);
    const { content } = k;
    const cx = 1500;
    const cy = 1340;
    [2300, 1820].forEach((d, i) =>
      k.shape("circle", { x: cx - d / 2, y: cy - d / 2, width: d, height: d }, { name: `Orbit ring ${i + 1}`, fill: null, fillRole: "none", stroke: k.color("muted"), strokeRole: "muted", strokeWidth: 6, dash: i ? [24, 18] : null }),
    );
    const p = 1360;
    k.image("orbit", { x: cx - p / 2, y: cy - p / 2, width: p, height: p }, {
      name: "Planet — orbit",
      mask: "circle",
      effects: { duotone: { enabled: true, shadow: k.color("paper"), highlight: k.color("accent") }, grain: 10 },
    });
    k.shape("circle", { x: cx + 1150 * Math.cos(-0.6) - 60, y: cy + 1150 * Math.sin(-0.6) - 60, width: 120, height: 120 }, { name: "Satellite", fillRole: "accent" });
    k.shape("star", { x: k.col(5).right - 200, y: content.y + 110, width: 200, height: 200 }, { name: "Four-point star", fillRole: "ink", sides: 4, innerRatio: 0.18 });

    k.text("Satellite Choir", { role: "subheading", name: "Artist", x: content.x, y: content.y, width: content.width, align: "center", fontFamily: "Space Grotesk", fontSize: 96, fontWeight: 500, letterSpacing: 120, uppercase: true, lineHeight: 1.1 });
    k.fit("Orbital Drift", k.span(0, 5, 6, 6), {
      role: "display",
      name: "Title",
      fontFamily: "Unbounded",
      fontWeight: 700,
      uppercase: true,
      letterSpacing: -20,
      lineHeight: 0.95,
      align: "center",
      max: 380,
      anchor: "bottom",
    });
    const r7 = k.row(7);
    const third = (content.width - k.grid.gutter * 2) / 3;
    k.meta("A1 Launch Window\nA2 Low Earth\nA3 Perigee", content.x, r7.y + 30, third, { fontFamily: "Space Mono", fontSize: 40, letterSpacing: 60, name: "Tracklist A" });
    k.meta("B1 Apogee\nB2 Signal Lost\nB3 Re-Entry", content.x + third + k.grid.gutter, r7.y + 30, third, { fontFamily: "Space Mono", fontSize: 40, letterSpacing: 60, align: "center", name: "Tracklist B" });
    k.meta("FS—024 / LP\n33⅓ RPM\n© 2026", content.x + (third + k.grid.gutter) * 2, r7.y + 30, third, { fontFamily: "Space Mono", fontSize: 40, letterSpacing: 60, align: "right", name: "Catalogue" });
    k.texture("scanlines", { seed: 2424, opacity: 0.18, blendMode: "multiply", color: "#000000", name: "Scanlines", scale: 2 });
    return k.doc();
  },
};

const noiseFloor: Template = {
  id: "album-noise-floor",
  name: "Noise Floor",
  category: "Music / Album Art",
  description: "Brutalist record sleeve: halftoned wave photograph, condensed monolith title, a black information band and a neon sticker.",
  tags: ["album", "brutalist", "halftone", "condensed", "neon"],
  ...FORMATS.album,
  featured: 11,
  styleId: "brutalist",
  build() {
    const k = compose(3000, 3000, { type: "column", columns: 4, rows: 1, margin: 0.03, gutter: 0.008 }, "brutalist", 2);
    const { content } = k;
    k.image("waves", k.page, {
      name: "Photograph — waves",
      opacity: 0.85,
      effects: { grayscale: 100, contrast: 35, halftone: { enabled: true, size: 22, angle: 45, color: "#0A0A0A" } },
    });
    const bandY = 2080;
    k.fit("Noise\nFloor", { x: content.x, y: content.y, width: content.width, height: bandY - content.y - 60 }, {
      role: "display",
      name: "Title",
      fontFamily: "Anton",
      fontWeight: 400,
      uppercase: true,
      letterSpacing: -10,
      lineHeight: 0.84,
      max: 1300,
      anchor: "top",
    });
    k.rect({ x: 0, y: bandY, width: 3000, height: 3000 - bandY }, { name: "Information band", fillRole: "background" });
    k.rule(content.x, bandY + 70, content.width, 8, { name: "Band rule", strokeRole: "ink" });
    const sides = ["Side A\n01 Static\n02 Feedback\n03 Hum", "Side B\n04 Hiss\n05 Ground Loop\n06 Silence", "Recorded\nKantine Studio\nLeipzig 2026", "FS—031\nLP 002\n45 RPM"];
    sides.forEach((s, i) => k.meta(s, k.col(i).x, bandY + 140, k.col(i).width, { fontFamily: "Space Mono", fontSize: 50, letterSpacing: 40, lineHeight: 1.4, name: `Info column ${i + 1}`, align: i === 3 ? "right" : "left" }));
    const sx = k.col(3).x + k.col(3).width - 520;
    k.shape("circle", { x: sx, y: bandY - 300, width: 520, height: 520 }, { name: "Sticker", fillRole: "accent", rotation: 0 });
    k.text("Limited\nPressing", { role: "subheading", name: "Sticker text", x: sx + 40, y: bandY - 300 + 196, width: 440, align: "center", fontFamily: "Archivo Black", fontSize: 58, fontWeight: 400, letterSpacing: -10, lineHeight: 1, uppercase: true, fillRole: "background" });
    k.texture("noise", { seed: 3131, opacity: 0.35, blendMode: "soft-light", color: "#E8E8E8", name: "Noise" });
    return k.doc();
  },
};

const acidHour: Template = {
  id: "event-acid-hour",
  name: "Acid Hour",
  category: "Events",
  description: "Club-night story flyer: ellipse-masked bokeh, mono-display title, centred line-up and scattered four-point stars.",
  tags: ["club", "flyer", "story", "acid", "stars"],
  ...FORMATS.story,
  featured: 10,
  styleId: "acid",
  build() {
    const k = compose(1080, 1920, { type: "symmetrical", columns: 4, rows: 12, margin: 0.05, gutter: 0.012 }, "acid", 0);
    const { content } = k;
    k.meta("FS—019 / Club Night", content.x, content.y, 480, { fontFamily: "Space Mono", name: "Catalogue" });
    k.meta("Warehouse 9", content.x + content.width - 400, content.y, 400, { fontFamily: "Space Mono", align: "right", name: "Venue" });
    const img = k.span(0, 3, 1, 6);
    k.image("neon", { x: img.x + 40, y: img.y, width: img.width - 80, height: img.height }, { name: "Ellipse — bokeh", mask: "ellipse", effects: { hue: 60, saturation: 40, contrast: 15 } });
    [
      { x: 70, y: 260, s: 120 },
      { x: 880, y: 820, s: 150 },
      { x: 150, y: 1050, s: 80 },
    ].forEach((st, i) => k.shape("star", { x: st.x, y: st.y, width: st.s, height: st.s }, { name: `Star ${i + 1}`, fillRole: i === 1 ? "ink" : "accent", sides: 4, innerRatio: 0.2 }));
    k.fit("Acid\nHour", k.span(0, 3, 7, 8), { role: "display", name: "Title", fontFamily: "Rubik Mono One", fontWeight: 400, uppercase: true, letterSpacing: -40, lineHeight: 0.92, align: "center", max: 260, anchor: "center" });
    const r9 = k.row(9);
    k.text("Mirror Phase · Kõrv\nLumen Arc · Static Bloom\nTape Saturation (live)", {
      role: "subheading",
      name: "Line-up",
      x: content.x,
      y: r9.y,
      width: content.width,
      align: "center",
      fontFamily: "Space Grotesk",
      fontSize: 38,
      fontWeight: 600,
      letterSpacing: -10,
      lineHeight: 1.25,
    });
    const r11 = k.row(11);
    k.rule(content.x, r11.y, content.width, 2, { name: "Footer rule", strokeRole: "accent" });
    k.meta("Sat 06.12.2026 — 23:00 → 07:00", content.x, r11.y + 24, content.width, { fontFamily: "Space Mono", fontSize: 20, align: "center", name: "Date & time" });
    k.meta("Advance 12 € / Door 15 €", content.x, r11.y + 64, content.width, { fontFamily: "Space Mono", fontSize: 16, align: "center", fillRole: "muted", name: "Tickets" });
    k.texture("noise", { seed: 1919, opacity: 0.4, blendMode: "soft-light", color: "#FFFFFF", name: "Noise" });
    return k.doc();
  },
};

const symposium: Template = {
  id: "event-design-symposium",
  name: "Design Systems Symposium",
  category: "Events",
  description: "Conference poster in modernist blue: large edition numeral, accent disc and a ruled programme table.",
  tags: ["conference", "schedule", "table", "modernist"],
  ...FORMATS.portrait,
  featured: 13,
  styleId: "modernist",
  build() {
    const k = compose(1080, 1350, { type: "modular", columns: 5, rows: 10, margin: 0.06, gutter: 0.018 }, "modernist", 0);
    const { content } = k;
    const disc = k.span(3, 4, 0, 2);
    const d = Math.min(disc.width, disc.height);
    k.shape("circle", { x: disc.x + disc.width - d, y: disc.y, width: d, height: d }, { name: "Accent disc", fillRole: "accent" });
    k.fit("03", k.span(0, 2, 0, 3), { role: "display", name: "Edition numeral", fontFamily: "Hanken Grotesk", fontWeight: 800, letterSpacing: -60, lineHeight: 0.8, max: 520, anchor: "top" });
    k.meta("Third edition", k.col(3).x, disc.y + d + 20, disc.width, { fontFamily: "IBM Plex Mono", align: "right", name: "Edition label" });
    k.fit("Design Systems\nSymposium", k.span(0, 4, 4, 5), { role: "heading", name: "Title", fontFamily: "Hanken Grotesk", fontWeight: 700, letterSpacing: -35, lineHeight: 0.95, max: 120, anchor: "top" });
    const rows = [
      ["09:30", "Opening — On Rules", "M. Keller"],
      ["11:00", "Tokens & Typography", "A. Sato"],
      ["14:00", "Grids That Scale", "L. Brandt"],
      ["16:30", "Panel: After Systems", "All speakers"],
    ];
    const top = k.row(6).y;
    const rowH = (k.row(8).bottom - top) / rows.length;
    rows.forEach(([t, title, who], i) => {
      const y = top + i * rowH;
      k.rule(content.x, y, content.width, 1.5, { name: `Programme rule ${i + 1}` });
      k.meta(t, content.x, y + 18, k.col(0).width, { fontFamily: "IBM Plex Mono", fontSize: 17, name: `Time ${i + 1}` });
      k.text(title, { role: "subheading", name: `Session ${i + 1}`, x: k.col(1).x, y: y + 12, width: k.col(3).right - k.col(1).x, fontFamily: "Hanken Grotesk", fontSize: 30, fontWeight: 600, letterSpacing: -15, lineHeight: 1.1 });
      k.text(who, { role: "caption", name: `Speaker ${i + 1}`, x: k.col(4).x, y: y + 18, width: k.col(4).width, align: "right", fontFamily: "Hanken Grotesk", fontSize: 18, fontWeight: 400, letterSpacing: 0, fillRole: "muted" });
    });
    const r9 = k.row(9);
    k.rule(content.x, r9.y, content.width, 4, { name: "Footer rule" });
    const half = (content.width - k.grid.gutter) / 2;
    k.body("Aula Magna, Politecnico\nMilano — 14.11.2026", content.x, r9.y + 20, half, { fontFamily: "Hanken Grotesk", fontSize: 20, fontWeight: 600, name: "Venue" });
    k.meta("FS—016\nFree registration", content.x + half + k.grid.gutter, r9.y + 22, half, { fontFamily: "IBM Plex Mono", align: "right", name: "Registration" });
    k.texture("paper", { seed: 1616, opacity: 0.35, blendMode: "multiply", color: k.color("ink"), name: "Paper grain" });
    return k.doc();
  },
};

export const MUSIC_TEMPLATES: Template[] = [orbit, noiseFloor, acidHour, symposium];
