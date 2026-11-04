import { describe, expect, it } from "vitest";
import { SENITUKANG, withSenitukangBrand } from "@/core/brand/senitukang";
import { TEMPLATES } from "@/core/templates";
import { createDocument } from "@/core/document/factory";
import { intersectionArea, layerBounds } from "@/core/geometry/transform";
import { kitMeasure } from "@/core/templates/kit";
import { layoutText } from "@/core/text/layout";
import { parseSvgPath, pathBounds } from "@/core/rendering/paths";
import type { TextLayer } from "@/types/layer";

const named = (layers: { name: string }[], name: string) => layers.filter((l) => l.name === name);

describe("Senitukang branding", () => {
  it("symbol path fills its view box exactly", () => {
    const b = pathBounds(parseSvgPath(SENITUKANG.symbolPath));
    expect(b.x).toBeCloseTo(0, 6);
    expect(b.y).toBeCloseTo(0, 6);
    expect(b.width).toBeCloseTo(SENITUKANG.symbolViewBox.width, 6);
    expect(b.height).toBeCloseTo(SENITUKANG.symbolViewBox.height, 6);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s carries the logo, on top and inside the page", (_id, t) => {
    const doc = t.build();
    const symbol = named(doc.layers, "Senitukang symbol");
    const word = named(doc.layers, "Senitukang wordmark") as TextLayer[];
    expect(symbol).toHaveLength(1);
    expect(word).toHaveLength(1);
    expect(word[0].text).toBe(SENITUKANG.name);
    expect(doc.layers[doc.layers.length - 1].name).toBe("Senitukang wordmark");
    const members = doc.layers.filter((l) => l.name.startsWith("Senitukang"));
    expect(new Set(members.map((l) => l.groupId)).size).toBe(1);
    for (const m of members) {
      const b = layerBounds(m);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(doc.width);
      expect(b.y + b.height).toBeLessThanOrEqual(doc.height);
    }
    // The wordmark must stay on one line.
    expect(layoutText(word[0], kitMeasure).lines).toHaveLength(1);
  });

  it("does not cover the text of any template", () => {
    const hits: string[] = [];
    for (const t of TEMPLATES) {
      const doc = t.build();
      const brand = doc.layers.filter((l) => l.name.startsWith("Senitukang"));
      const others = doc.layers.filter((l) => l.type === "text" && !l.name.startsWith("Senitukang")) as TextLayer[];
      for (const o of others) {
        const lay = layoutText(o, kitMeasure);
        const box = layerBounds({ ...o, width: lay.width, height: lay.height });
        if (brand.some((b) => intersectionArea(layerBounds(b), box) > 1)) hits.push(`${t.id}: ${o.name}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("is idempotent and leaves the input untouched", () => {
    const doc = createDocument(1080, 1350);
    const once = withSenitukangBrand(doc);
    expect(doc.layers).toHaveLength(0);
    expect(withSenitukangBrand(once).layers).toHaveLength(once.layers.length);
  });

  it("uses a light mark on a dark page and no plate on a flat background", () => {
    const doc = createDocument(1080, 1080, { background: { color: "#171717", transparent: false } });
    const out = withSenitukangBrand(doc);
    expect(named(out.layers, "Senitukang plate")).toHaveLength(0);
    expect((named(out.layers, "Senitukang wordmark")[0] as TextLayer).fill).toBe("#F0EDE5");
  });
});
