import { describe, expect, it } from "vitest";
import { computeGrid, splitTracks, PHI, spanRect } from "@/core/geometry/grid";
import { defaultGrid, createDocument, createProject, createTextLayer, createShapeLayer } from "@/core/document/factory";
import { layoutText, approxMeasure, fitFontSize } from "@/core/text/layout";
import { alignLayers, distributeLayers, layerBounds, snapBox } from "@/core/geometry/transform";
import { migrateProject, ProjectFormatError } from "@/core/serialization/migrate";
import { CURRENT_SCHEMA_VERSION } from "@/types/project";
import { parseSvgPath, shapePath, pathToSvgD } from "@/core/rendering/paths";

describe("grid engine", () => {
  const g = { ...defaultGrid(1000, 1000), margins: { top: 50, right: 50, bottom: 50, left: 50 }, gutter: 20 };

  it("splits columns exactly across the live area", () => {
    const t = splitTracks(50, 900, 4, 20);
    expect(t).toHaveLength(4);
    expect(t[0].start).toBe(50);
    const last = t[3];
    expect(last.start + last.size).toBeCloseTo(950, 6);
    expect(t[1].start - (t[0].start + t[0].size)).toBeCloseTo(20, 6);
    t.forEach((x) => expect(x.size).toBeCloseTo((900 - 60) / 4, 6));
  });

  it("respects weighted ratios for asymmetrical grids", () => {
    const geo = computeGrid(1000, 1000, { ...g, type: "asymmetrical", columnRatios: [1, 2] });
    expect(geo.columns).toHaveLength(2);
    expect(geo.columns[1].size / geo.columns[0].size).toBeCloseTo(2, 6);
  });

  it("modular grid produces columns × rows modules", () => {
    const geo = computeGrid(1000, 1000, { ...g, type: "modular", columns: 5, rows: 3 });
    expect(geo.modules).toHaveLength(15);
    const r = spanRect(geo, 0, 4, 0, 2);
    expect(r.x).toBe(50);
    expect(r.width).toBeCloseTo(900, 6);
  });

  it("golden ratio lines divide the area by φ", () => {
    const geo = computeGrid(1000, 1000, { ...g, type: "golden" });
    const xs = geo.lines.filter((l) => l.axis === "x").map((l) => l.position);
    expect((xs[1] - 50) / 900).toBeCloseTo(1 / PHI, 6);
  });

  it("thirds and baseline geometry are exact", () => {
    const t = computeGrid(900, 900, { ...g, type: "thirds", margins: { top: 0, right: 0, bottom: 0, left: 0 } });
    expect(t.lines.filter((l) => l.axis === "x").map((l) => l.position)).toEqual([300, 600]);
    const b = computeGrid(1000, 1000, { ...g, type: "baseline", baseline: 10 });
    expect(b.baselines[0]).toBe(60);
    expect(b.baselines[1] - b.baselines[0]).toBe(10);
  });

  it("fibonacci subdivision produces squares", () => {
    const geo = computeGrid(1618, 1000, { ...g, type: "fibonacci", margins: { top: 0, right: 0, bottom: 0, left: 0 } });
    expect(geo.rects.length).toBeGreaterThan(4);
    geo.rects.forEach((r) => expect(r.width).toBeCloseTo(r.height, 6));
  });
});

describe("text layout", () => {
  const base = createTextLayer({ text: "Create your own visual language", fontSize: 40, width: 300, fontFamily: "Inter" });

  it("wraps within the box and grows auto height", () => {
    const l = layoutText(base, approxMeasure);
    expect(l.lines.length).toBeGreaterThan(1);
    l.lines.forEach((ln) => expect(ln.width).toBeLessThanOrEqual(300 + 0.5));
    expect(l.height).toBeCloseTo(l.lines.length * 40 * base.lineHeight, 6);
  });

  it("respects explicit line breaks and alignment", () => {
    const l = layoutText({ ...base, text: "A\nB", align: "right" }, approxMeasure);
    expect(l.lines).toHaveLength(2);
    expect(l.lines[0].words[0].x).toBeGreaterThan(200);
  });

  it("vertical typography stacks glyphs", () => {
    const l = layoutText({ ...base, text: "縦書き", vertical: true }, approxMeasure);
    expect(l.glyphs).toHaveLength(3);
    expect(l.glyphs![1].y).toBeGreaterThan(l.glyphs![0].y);
  });

  it("fitFontSize finds a size that fits", () => {
    const size = fitFontSize(base, { width: 300, height: 120 }, approxMeasure, 200);
    const l = layoutText({ ...base, fontSize: size }, approxMeasure);
    expect(l.height).toBeLessThanOrEqual(120);
    expect(size).toBeGreaterThan(10);
  });
});

describe("geometry", () => {
  const a = createShapeLayer("rect", { x: 0, y: 0, width: 100, height: 100 });
  const b = createShapeLayer("rect", { x: 300, y: 50, width: 50, height: 50 });
  const c = createShapeLayer("rect", { x: 900, y: 20, width: 100, height: 100 });

  it("aligns to selection bounds", () => {
    const out = alignLayers([a, b], "right");
    expect(layerBounds(out[0]).x + 100).toBeCloseTo(350);
  });

  it("distributes with equal gaps", () => {
    const out = distributeLayers([a, b, c], "x");
    const bs = out.map(layerBounds).sort((p, q) => p.x - q.x);
    const gap1 = bs[1].x - (bs[0].x + bs[0].width);
    const gap2 = bs[2].x - (bs[1].x + bs[1].width);
    expect(gap1).toBeCloseTo(gap2, 6);
  });

  it("rotated bounds include all corners", () => {
    const r = layerBounds({ x: 0, y: 0, width: 100, height: 100, rotation: 45 });
    expect(r.width).toBeCloseTo(Math.SQRT2 * 100, 6);
  });

  it("snaps edges within threshold", () => {
    const s = snapBox({ x: 97, y: 0, width: 50, height: 50 }, [100], [], 5);
    expect(s.dx).toBe(3);
    expect(s.guidesX).toContain(100);
  });
});

describe("serialization", () => {
  it("migrates a v1 project to the current schema", () => {
    const doc = createDocument(1080, 1350);
    const raw = { id: "p", name: "Old", schemaVersion: 1, doc: { ...doc, layers: [{ id: "x", type: "image", name: "i", x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1, visible: true, locked: false, assetId: "builtin:dune", crop: { x: 0, y: 0, width: 1, height: 1 } }] } };
    const p = migrateProject(raw);
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const img = p.doc.layers[0];
    expect(img.blendMode).toBe("normal");
    expect(img.type === "image" && img.effects.duotone).toBeTruthy();
  });

  it("rejects newer schema and garbage", () => {
    const p = createProject("x", createDocument(10, 10));
    expect(() => migrateProject({ ...p, schemaVersion: 999 })).toThrow(ProjectFormatError);
    expect(() => migrateProject("nope")).toThrow(ProjectFormatError);
  });

  it("round-trips a current project unchanged", () => {
    const p = createProject("x", createDocument(100, 100, { layers: [createTextLayer({ text: "hi" })] }));
    expect(migrateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});

describe("paths", () => {
  it("parses relative and absolute commands", () => {
    const cmds = parseSvgPath("M10 10 l10 0 v10 H10 z");
    expect(cmds.map((c) => c.op)).toEqual(["M", "L", "L", "L", "Z"]);
    expect(cmds[2]).toMatchObject({ x: 20, y: 20 });
  });
  it("serialises shapes to svg path data", () => {
    const d = pathToSvgD(shapePath(createShapeLayer("star", { width: 100, height: 100 })));
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });
});
