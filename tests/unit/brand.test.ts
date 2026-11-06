import { beforeEach, describe, expect, it } from "vitest";
import { SENITUKANG, isBrandLayer, sanitizeBrand, withSenitukangBrand } from "@/core/brand/senitukang";
import { TEMPLATES, getTemplate } from "@/core/templates";
import { createDocument, createProject, createShapeLayer, reidentifyLayers } from "@/core/document/factory";
import { intersectionArea, layerBounds } from "@/core/geometry/transform";
import { kitMeasure } from "@/core/templates/kit";
import { layoutText } from "@/core/text/layout";
import { parseSvgPath, pathBounds } from "@/core/rendering/paths";
import { useEditor } from "@/stores/editor-store";
import type { ShapeLayer, TextLayer } from "@/types/layer";

const st = () => useEditor.getState();
const logoOf = () => st().doc!.layers.find(isBrandLayer) as ShapeLayer;

describe("Senitukang logo artwork", () => {
  it.each(["symbol", "lockup"] as const)("%s path fits its view box", (v) => {
    const b = pathBounds(parseSvgPath(SENITUKANG[v].path));
    expect(b.x).toBeGreaterThanOrEqual(-0.5);
    expect(b.y).toBeGreaterThanOrEqual(-0.5);
    expect(b.x + b.width).toBeLessThanOrEqual(SENITUKANG[v].viewBox.width + 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(SENITUKANG[v].viewBox.height + 0.5);
  });
});

describe("logo as hero of every template", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s has one logo on top, inside the page", (_id, t) => {
    const doc = t.build();
    const logos = doc.layers.filter(isBrandLayer);
    expect(logos).toHaveLength(1);
    expect(doc.layers[doc.layers.length - 1]).toBe(logos[0]);
    const b = layerBounds(logos[0]);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(doc.width);
    expect(b.y + b.height).toBeLessThanOrEqual(doc.height);
    expect(b.width).toBeGreaterThanOrEqual(Math.min(doc.width, doc.height) * 0.15);
  });

  it("does not cover the text of any template", () => {
    const hits: string[] = [];
    for (const t of TEMPLATES) {
      const doc = t.build();
      const logo = layerBounds(doc.layers.find(isBrandLayer)!);
      for (const o of doc.layers.filter((l) => l.type === "text") as TextLayer[]) {
        const lay = layoutText(o, kitMeasure);
        if (intersectionArea(logo, layerBounds({ ...o, width: lay.width, height: lay.height })) > 1) hits.push(`${t.id}: ${o.name}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("replaces the main graphic: the Konkrete circle is gone", () => {
    const doc = getTemplate("swiss-konkrete")!.build();
    expect(doc.layers.some((l) => l.type === "shape" && l.shape === "circle")).toBe(false);
    expect(layerBounds(doc.layers.find(isBrandLayer)!).width).toBeGreaterThan(doc.width * 0.3);
  });

  it("uses a light logo on a dark photo, even under an outline frame", () => {
    const logo = getTemplate("photo-red-dune")!.build().layers.find(isBrandLayer) as ShapeLayer;
    expect(logo.fill).toBe(SENITUKANG.paper);
  });

  it("is idempotent and leaves the input untouched", () => {
    const doc = createDocument(1080, 1350);
    const once = withSenitukangBrand(doc);
    expect(doc.layers).toHaveLength(0);
    expect(withSenitukangBrand(once)).toBe(once);
    expect(sanitizeBrand(once)).toBe(once);
  });
});

describe("logo protection in the editor", () => {
  beforeEach(() => {
    const base = createDocument(1080, 1350, { layers: [createShapeLayer("rect", { id: "other", x: 10, y: 10, width: 50, height: 50 })] });
    st().load(createProject("t", withSenitukangBrand(base)));
  });

  it("cannot be deleted or hidden, while other layers can be deleted", () => {
    const id = logoOf().id;
    st().deleteLayers([id, "other"]);
    expect(logoOf().id).toBe(id);
    expect(st().doc!.layers).toHaveLength(1);
    st().updateLayer(id, { visible: false });
    expect(logoOf().visible).toBe(true);
    st().updateLayer(id, { opacity: 0 });
    expect(logoOf().opacity).toBe(1);
    st().updateLayer(id, { blendMode: "multiply" });
    expect(logoOf().blendMode).toBe("normal");
    st().updateLayer(id, { locked: true });
    expect(logoOf().locked).toBe(false);
  });

  it("stays on top of every other layer", () => {
    st().reorder([logoOf().id], "back");
    expect(st().doc!.layers.at(-1)!.brandLocked).toBe(true);
    st().addLayer(createShapeLayer("rect", { width: 1080, height: 1350, x: 0, y: 0 }));
    expect(st().doc!.layers.at(-1)!.brandLocked).toBe(true);
  });

  it("can move and resize, but stays on the page, undistorted and above the minimum size", () => {
    const id = logoOf().id;
    const aspect = logoOf().width / logoOf().height;
    st().updateLayer(id, { x: 100, y: 200, width: 400 });
    expect(logoOf()).toMatchObject({ x: 100, y: 200, width: 400 });
    st().updateLayer(id, { x: 99999, y: -99999 });
    const b = layerBounds(logoOf());
    expect(b.x + b.width).toBeLessThanOrEqual(1080.001);
    expect(b.y).toBeGreaterThanOrEqual(-0.001);
    st().updateLayer(id, { width: 1, height: 900 });
    expect(logoOf().width).toBeGreaterThanOrEqual(1080 * 0.08);
    expect(logoOf().width / logoOf().height).toBeCloseTo(aspect, 3);
  });

  it("copies of the logo are ordinary layers, and it survives project copies", () => {
    st().duplicateLayers([logoOf().id]);
    expect(st().doc!.layers.filter(isBrandLayer)).toHaveLength(1);
    expect(reidentifyLayers(st().doc!.layers).filter(isBrandLayer)).toHaveLength(1);
  });

  it("stays legible when the page colour changes under it", () => {
    const fill = logoOf().fill!;
    st().setDoc((d) => ({ ...d, background: { color: fill, transparent: false } }));
    expect(logoOf().fill).not.toBe(fill);
  });
});
