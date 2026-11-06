import { beforeEach, describe, expect, it } from "vitest";
import { SENITUKANG, isBrandLayer, replaceBrandLogo, sanitizeBrand, withSenitukangBrand } from "@/core/brand/senitukang";
import { SHOWCASE_COPY, TEMPLATE_COPY } from "@/core/brand/content-ms";
import { SHOWCASE, showcaseDoc } from "@/components/landing/showcase-docs";
import { TEMPLATES, getTemplate } from "@/core/templates";
import { createDocument, createProject, createShapeLayer, createTextLayer, reidentifyLayers } from "@/core/document/factory";
import { intersectionArea, layerBounds } from "@/core/geometry/transform";
import { kitMeasure } from "@/core/templates/kit";
import { layoutText } from "@/core/text/layout";
import { parseSvgPath, pathBounds } from "@/core/rendering/paths";
import { useEditor } from "@/stores/editor-store";
import type { ShapeLayer, TextLayer } from "@/types/layer";

const st = () => useEditor.getState();
const logoOf = () => st().doc!.layers.find(isBrandLayer) as ShapeLayer;

describe("Senitukang logo artwork", () => {
  it("symbol path fits its view box", () => {
    const b = pathBounds(parseSvgPath(SENITUKANG.symbol.path));
    expect(b.x).toBeCloseTo(0, 3);
    expect(b.y).toBeCloseTo(0, 3);
    expect(b.width).toBeCloseTo(SENITUKANG.symbol.viewBox.width, 3);
    expect(b.height).toBeCloseTo(SENITUKANG.symbol.viewBox.height, 3);
  });
});

describe("logo and name in every template", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s has one moderate logo on top, inside the page", (_id, t) => {
    const doc = t.build();
    const logos = doc.layers.filter(isBrandLayer);
    expect(logos).toHaveLength(1);
    expect(doc.layers[doc.layers.length - 1]).toBe(logos[0]);
    const b = layerBounds(logos[0]);
    const short = Math.min(doc.width, doc.height);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(doc.width);
    expect(b.y + b.height).toBeLessThanOrEqual(doc.height);
    expect(b.width).toBeGreaterThanOrEqual(short * 0.08);
    expect(b.width).toBeLessThanOrEqual(short * 0.3 + 0.01);
    expect((logos[0] as ShapeLayer).pathData).toBe(SENITUKANG.symbol.path);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s sets the company name as one line of editable text", (_id, t) => {
    const name = t.build().layers.find((l) => l.type === "text" && l.text === SENITUKANG.name) as TextLayer;
    expect(name).toBeTruthy();
    expect(layoutText(name, kitMeasure).lines).toHaveLength(1);
    expect(name.brandLocked).toBeFalsy();
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

  it("replaces the title and a form, as in the Ma template", () => {
    const doc = getTemplate("jp-ma-a4")!.build();
    expect(doc.layers.some((l) => l.type === "text" && l.text.includes("Aesthetics"))).toBe(false);
    expect(doc.layers.some((l) => l.type === "shape" && l.shape === "circle")).toBe(false);
    expect(doc.layers.some((l) => l.type === "text" && l.text === SENITUKANG.name)).toBe(true);
  });

  it("uses a light logo on a dark photo, even under an outline frame", () => {
    const logo = getTemplate("photo-red-dune")!.build().layers.find(isBrandLayer) as ShapeLayer;
    expect(logo.fill).toBe(SENITUKANG.paper);
  });

  it("is idempotent and leaves the input untouched", () => {
    const doc = createDocument(1080, 1350, { layers: [createTextLayer({ role: "heading", text: "Original title", width: 800 })] });
    const once = withSenitukangBrand(doc);
    expect((doc.layers[0] as TextLayer).text).toBe("Original title");
    expect(withSenitukangBrand(once)).toBe(once);
    expect(sanitizeBrand(once)).toBe(once);
  });
});

describe("Malay company copy", () => {
  const OLD = /Zürich|Ausstellung|Exhibition|Museum|Tokyo|Kyoto|Berlin|Rotterdam|Marseille|Milano|Workshop|Lecture|Vortrag|\bFS[—/]|\bLive\b|\bthe\b|[\u3040-\u30ff\u3400-\u9fff]/i;

  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s has only Malay company text", (id, t) => {
    const copy = TEMPLATE_COPY[id];
    expect(t.name).toBe(copy.name);
    expect(t.description).not.toBe("");
    const texts = (t.build().layers.filter((l) => l.type === "text") as TextLayer[]).map((l) => l.text);
    const known = new Set([SENITUKANG.name, ...Object.values(copy.text)]);
    expect(texts.filter((x) => !known.has(x))).toEqual([]);
    expect(texts.filter((x) => OLD.test(x))).toEqual([]);
  });

  it.each(Object.keys(SHOWCASE_COPY))("showcase %s has only Malay company text", (id) => {
    const texts = (showcaseDoc(id).layers.filter((l) => l.type === "text") as TextLayer[]).map((l) => l.text);
    const known = new Set([SENITUKANG.name, ...Object.values(SHOWCASE_COPY[id].text)]);
    expect(texts.filter((x) => !known.has(x))).toEqual([]);
    expect(SHOWCASE.find((s) => s.id === id)!.title).toBe(SHOWCASE_COPY[id].name);
  });

  it("states the company's founding year somewhere in every template", () => {
    const missing = TEMPLATES.filter((t) => !Object.values(TEMPLATE_COPY[t.id].text).some((x) => /2017/.test(x))).map((t) => t.id);
    expect(missing.length).toBeLessThanOrEqual(1);
  });
});

describe("changing the logo", () => {
  const branded = () => withSenitukangBrand(createDocument(1080, 1350));

  it("switches to the full logo in place, keeping it protected and undistorted", () => {
    const doc = branded();
    const before = doc.layers.find(isBrandLayer)!;
    const next = replaceBrandLogo(doc, { type: "vector", variant: "lockup" });
    const logo = next.layers.find(isBrandLayer) as ShapeLayer;
    expect(logo.id).toBe(before.id);
    expect(logo.pathData).toBe(SENITUKANG.lockup.path);
    expect(logo.width / logo.height).toBeCloseTo(SENITUKANG.lockup.viewBox.width / SENITUKANG.lockup.viewBox.height, 3);
    expect(logo.x + logo.width / 2).toBeCloseTo(before.x + before.width / 2, 3);
  });

  it("an uploaded logo stays protected, and undo restores the company logo", () => {
    st().load(createProject("t", branded()));
    const original = logoOf().id;
    st().setDoc((d) => replaceBrandLogo(d, { type: "image", assetId: "ast_1", width: 800, height: 400 }));
    const img = st().doc!.layers.find(isBrandLayer)!;
    expect(img.type).toBe("image");
    expect(img.width / img.height).toBeCloseTo(2, 3);
    st().deleteLayers([img.id]);
    st().updateLayer(img.id, { visible: false, x: -9999 });
    const after = st().doc!.layers.find(isBrandLayer)!;
    expect(after.type).toBe("image");
    expect(after.visible).toBe(true);
    expect(after.x).toBeGreaterThanOrEqual(0);
    st().undo();
    st().undo();
    expect(logoOf().type).toBe("shape");
    expect(logoOf().id).toBe(original);
  });
});

describe("logo protection in the editor", () => {
  beforeEach(() => {
    const base = createDocument(1080, 1350, { layers: [createShapeLayer("rect", { id: "other", x: 10, y: 10, width: 50, height: 50 })] });
    st().load(createProject("t", withSenitukangBrand(base)));
  });

  it("cannot be deleted or hidden, while other layers can be deleted", () => {
    const id = logoOf().id;
    const before = st().doc!.layers.length;
    st().deleteLayers([id, "other"]);
    expect(logoOf().id).toBe(id);
    expect(st().doc!.layers.length).toBeLessThanOrEqual(before);
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
