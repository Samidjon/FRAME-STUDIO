import { describe, expect, it } from "vitest";
import { approxMeasure } from "@/core/text/layout";
import { layerBounds, rectContains } from "@/core/geometry/transform";
import { createDocument, createImageLayer, createShapeLayer, createTextLayer } from "@/core/document/factory";
import { generateCompositions } from "@/core/composition/engine";
import { describeResizeModes, isFullBleed, MIN_RESIZE_FONT, RESIZE_MODES, smartResize, type ResizeMode } from "@/core/resize/smart-resize";
import type { DesignDocument } from "@/types/project";

function handmade(): DesignDocument {
  const W = 1080;
  const H = 1350;
  const doc = createDocument(W, H, { guides: [{ id: "g1", axis: "x", position: 540 }, { id: "g2", axis: "y", position: 1300 }] });
  doc.layers = [
    createShapeLayer("rect", { id: "bg", name: "Background", x: 0, y: 0, width: W, height: H, fill: "#E9DAF5" }),
    createImageLayer("builtin:dune", { id: "hero", name: "Hero", x: 60, y: 60, width: 960, height: 700 }),
    createTextLayer({ id: "title", role: "display", text: "Form Follows Light", x: 60, y: 800, width: 960, fontSize: 140, lineHeight: 0.9, height: 260 }, W),
    createTextLayer({ id: "sub", role: "subheading", text: "An exhibition on construction and rhythm", x: 60, y: 1080, width: 600, fontSize: 40, height: 100 }, W),
    createTextLayer({ id: "meta", role: "metadata", text: "No. 07 — 2026", x: 60, y: 1250, width: 400, fontSize: 16, height: 22 }, W),
    createShapeLayer("circle", { id: "dot", name: "Dot", x: 900, y: 1180, width: 100, height: 100 }),
    createImageLayer("logo-asset", { id: "logo", name: "Logo", x: 880, y: 1270, width: 140, height: 40 }),
  ];
  return doc;
}

const TARGETS: [number, number][] = [
  [1920, 1080],
  [1080, 1920],
  [1080, 1080],
  [2480, 3508],
];

function checkResult(src: DesignDocument, out: DesignDocument, tw: number, th: number, mode: ResizeMode) {
  expect(out.width).toBe(tw);
  expect(out.height).toBe(th);
  expect(out.layers.map((l) => l.id)).toEqual(src.layers.map((l) => l.id));
  const page = { x: 0, y: 0, width: tw, height: th };
  for (const l of out.layers) {
    for (const v of [l.x, l.y, l.width, l.height]) expect(Number.isFinite(v)).toBe(true);
    if (isFullBleed(l, tw, th)) continue;
    expect(rectContains(page, layerBounds(l), 1), `${mode} ${tw}x${th}: ${l.name} out of page`).toBe(true);
    if (l.type === "text") {
      const before = src.layers.find((x) => x.id === l.id);
      const floor = Math.min(MIN_RESIZE_FONT, before && before.type === "text" ? before.fontSize : MIN_RESIZE_FONT);
      expect(l.fontSize).toBeGreaterThanOrEqual(floor - 0.01);
    }
  }
}

describe("smart resize", () => {
  it("describes four modes", () => {
    expect(describeResizeModes().map((m) => m.id)).toEqual(RESIZE_MODES);
  });

  it("keeps ids, stays in the page, keeps type legible and leaves the source untouched", () => {
    const src = handmade();
    const snapshot = JSON.stringify(src);
    for (const mode of RESIZE_MODES) {
      for (const [tw, th] of TARGETS) checkResult(src, smartResize(src, tw, th, mode, approxMeasure), tw, th, mode);
    }
    expect(JSON.stringify(src)).toBe(snapshot);
  });

  it("works on generated compositions", () => {
    const variants = generateCompositions(
      {
        image: null,
        logo: { assetId: "logo-asset", width: 300, height: 90 },
        title: "Form Follows Light",
        subtitle: "An exhibition on construction, rhythm and the grid",
        body: "Twelve studios explore how systems of proportion shape what we see.",
        palette: [],
        style: "swiss",
        format: { width: 1080, height: 1350 },
        count: 10,
        direction: "auto",
        density: 0.5,
        asymmetry: 0.5,
        seed: 42,
      },
      approxMeasure,
    );
    for (const v of variants) {
      const snapshot = JSON.stringify(v.doc);
      for (const mode of RESIZE_MODES) for (const [tw, th] of TARGETS.slice(0, 3)) checkResult(v.doc, smartResize(v.doc, tw, th, mode, approxMeasure), tw, th, mode);
      expect(JSON.stringify(v.doc)).toBe(snapshot);
    }
  });

  it("stretches full-bleed backgrounds to the new page", () => {
    const src = handmade();
    for (const mode of RESIZE_MODES) {
      const bg = smartResize(src, 1920, 1080, mode).layers.find((l) => l.id === "bg")!;
      expect([bg.x, bg.y, bg.width, bg.height]).toEqual([0, 0, 1920, 1080]);
    }
  });

  it("each mode produces a different result", () => {
    const src = handmade();
    const sigs = RESIZE_MODES.map((mode) =>
      JSON.stringify(smartResize(src, 1920, 1080, mode).layers.map((l) => [Math.round(l.x), Math.round(l.y), Math.round(l.width), Math.round(l.height)])),
    );
    expect(new Set(sigs).size).toBe(4);
  });

  it("scales grid margins and drops guides outside the page", () => {
    const src = handmade();
    const out = smartResize(src, 1920, 600, "preserve-type");
    expect(out.grid.margins.left).toBeLessThan(src.grid.margins.left);
    expect(out.guides.every((g) => g.position <= (g.axis === "x" ? 1920 : 600))).toBe(true);
    expect(out.grid.visible).toBe(src.grid.visible);
  });

  it("reflow puts the hero beside the text when going landscape and stacks it for portrait", () => {
    const src = handmade();
    const land = smartResize(src, 1920, 1080, "reflow");
    const hero = layerBounds(land.layers.find((l) => l.id === "hero")!);
    const title = layerBounds(land.layers.find((l) => l.id === "title")!);
    expect(hero.x + hero.width).toBeLessThanOrEqual(title.x + 1);
    const tall = smartResize(land, 1080, 1920, "reflow");
    const h2 = layerBounds(tall.layers.find((l) => l.id === "hero")!);
    const t2 = layerBounds(tall.layers.find((l) => l.id === "title")!);
    expect(h2.y + h2.height).toBeLessThanOrEqual(t2.y + 1);
  });
});
