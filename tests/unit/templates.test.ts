import { describe, expect, it } from "vitest";
import { TEMPLATES, TEMPLATE_CATEGORIES, getTemplate } from "@/core/templates";
import { STYLE_PRESETS, applyStyle, getStyle } from "@/core/presets/styles";
import { layoutText } from "@/core/text/layout";
import { kitMeasure } from "@/core/templates/kit";
import type { TextLayer } from "@/types/layer";

describe("templates catalogue", () => {
  it("has at least 20 templates with unique ids", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it("represents all 12 categories", () => {
    expect(TEMPLATE_CATEGORIES.length).toBe(12);
    for (const c of TEMPLATE_CATEGORIES) expect(TEMPLATES.some((t) => t.category === c), c).toBe(true);
  });

  it("uses a variety of formats", () => {
    expect(new Set(TEMPLATES.map((t) => `${t.width}x${t.height}`)).size).toBeGreaterThanOrEqual(6);
  });

  it("getTemplate resolves ids", () => {
    const first = TEMPLATES[0];
    expect(getTemplate(first.id)).toBe(first);
    expect(getTemplate("nope")).toBeUndefined();
  });
});

describe.each(TEMPLATES.map((t) => [t.id, t] as const))("template %s", (_id, t) => {
  const doc = t.build();

  it("builds a document matching its format and style", () => {
    expect(doc.width).toBe(t.width);
    expect(doc.height).toBe(t.height);
    expect(doc.styleId).toBe(t.styleId);
    expect(getStyle(doc.styleId)).toBeDefined();
    expect(doc.grid.visible).toBe(false);
  });

  it("is made of real, varied editable layers", () => {
    expect(doc.layers.length).toBeGreaterThanOrEqual(4);
    expect(new Set(doc.layers.map((l) => l.type)).size).toBeGreaterThanOrEqual(2);
    expect(doc.layers.some((l) => l.type === "text")).toBe(true);
  });

  it("has unique layer ids and fresh ids per build", () => {
    const ids = doc.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const again = t.build();
    expect(again.layers.map((l) => l.id)).not.toEqual(ids);
    // Deterministic geometry.
    expect(again.layers.map((l) => [l.type, l.x, l.y, l.width, l.height])).toEqual(doc.layers.map((l) => [l.type, l.x, l.y, l.width, l.height]));
  });

  it("keeps every layer inside or overlapping the page", () => {
    for (const l of doc.layers) {
      expect(Number.isFinite(l.x) && Number.isFinite(l.y) && Number.isFinite(l.width) && Number.isFinite(l.height), l.name).toBe(true);
      expect(l.width, l.name).toBeGreaterThan(0);
      expect(l.height, l.name).toBeGreaterThan(0);
      const overlaps = l.x < doc.width && l.y < doc.height && l.x + l.width > 0 && l.y + l.height > 0;
      expect(overlaps, `${l.name} @ ${l.x},${l.y} ${l.width}×${l.height}`).toBe(true);
    }
  });

  it("has non-empty, well-sized text layers", () => {
    const texts = doc.layers.filter((l): l is TextLayer => l.type === "text");
    for (const l of texts) {
      expect(l.text.trim().length, l.name).toBeGreaterThan(0);
      expect(l.width, l.name).toBeGreaterThan(0);
      expect(l.fontSize, l.name).toBeGreaterThan(0);
      if (!l.vertical && l.rotation === 0) {
        const lay = layoutText(l, kitMeasure);
        expect(lay.overflow, `${l.name} overflows its box`).toBe(false);
        expect(l.y + lay.height, `${l.name} runs off the page`).toBeLessThanOrEqual(doc.height + 1);
      }
    }
  });
});

describe("style presets", () => {
  it("defines 10 presets with valid palettes", () => {
    expect(STYLE_PRESETS.length).toBe(10);
    for (const s of STYLE_PRESETS) {
      expect(s.palettes.length).toBeGreaterThanOrEqual(2);
      for (const p of s.palettes) for (const c of [p.background, p.ink, p.accent, p.muted, p.paper]) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
      expect(s.compositions.length).toBeGreaterThan(0);
    }
  });

  it("applyStyle keeps geometry and ids but changes background and fonts", () => {
    const t = getTemplate("swiss-konkrete")!;
    const doc = t.build();
    const snapshot = JSON.stringify(doc);
    const styled = applyStyle(doc, "brutalist", 1);
    expect(JSON.stringify(doc)).toBe(snapshot); // input not mutated
    expect(styled.styleId).toBe("brutalist");
    expect(styled.background.color).toBe(getStyle("brutalist")!.palettes[1].background);
    expect(styled.background.color).not.toBe(doc.background.color);
    expect(styled.layers.map((l) => [l.id, l.x, l.y, l.width, l.height, l.rotation])).toEqual(doc.layers.map((l) => [l.id, l.x, l.y, l.width, l.height, l.rotation]));
    const before = doc.layers.filter((l): l is TextLayer => l.type === "text");
    const after = styled.layers.filter((l): l is TextLayer => l.type === "text");
    expect(after.map((l) => l.text)).toEqual(before.map((l) => l.text));
    const display = after.find((l) => l.role === "display")!;
    expect(display.fontFamily).toBe("Anton");
    expect(display.fontWeight).toBe(400);
    expect(after.filter((l) => l.role === "metadata").every((l) => l.fontFamily === "Space Mono")).toBe(true);
    const accentShape = styled.layers.find((l) => l.type === "shape" && l.fillRole === "accent");
    expect(accentShape && accentShape.type === "shape" ? accentShape.fill : null).toBe(getStyle("brutalist")!.palettes[1].accent);
  });

  it("applyStyle can limit itself to colours or fonts", () => {
    const doc = getTemplate("swiss-konkrete")!.build();
    const coloursOnly = applyStyle(doc, "minimal", 0, { fonts: false });
    expect(coloursOnly.layers.filter((l) => l.type === "text").map((l) => (l as TextLayer).fontFamily)).toEqual(
      doc.layers.filter((l) => l.type === "text").map((l) => (l as TextLayer).fontFamily),
    );
    const fontsOnly = applyStyle(doc, "minimal", 0, { colors: false });
    expect(fontsOnly.background.color).toBe(doc.background.color);
  });

  it("keeps Japanese text in a Japanese family", () => {
    const doc = getTemplate("jp-ma-a4")!.build();
    const styled = applyStyle(doc, "swiss", 0);
    const jp = styled.layers.find((l): l is TextLayer => l.type === "text" && /[぀-鿿]/.test(l.text) && l.vertical)!;
    expect(["Noto Sans JP", "Noto Serif JP", "Zen Kaku Gothic New"]).toContain(jp.fontFamily);
  });
});
