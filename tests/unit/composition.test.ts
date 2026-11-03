import { describe, expect, it } from "vitest";
import { approxMeasure } from "@/core/text/layout";
import { FORMAT_PRESETS } from "@/types/project";
import { generateCompositions, getProvider, registerProvider } from "@/core/composition/engine";
import { validateDocument } from "@/core/composition/validate";
import { GEN_STYLES } from "@/core/composition/styles";
import type { GeneratorInput } from "@/core/composition/types";

const base: GeneratorInput = {
  image: null,
  logo: null,
  title: "Form Follows Light",
  subtitle: "An exhibition on construction, rhythm and the grid",
  body: "Twelve studios explore how systems of proportion shape what we see. Open daily from ten to six, with talks every Thursday evening.",
  palette: [],
  style: "swiss",
  format: { width: 1080, height: 1350 },
  count: 10,
  direction: "auto",
  density: 0.5,
  asymmetry: 0.5,
  seed: 1234,
};

/** Layout-relevant fingerprint, independent of anything but geometry and text. */
const fingerprint = (input: GeneratorInput) =>
  generateCompositions(input, approxMeasure).map((v) => ({
    id: v.id,
    algorithm: v.algorithm,
    layers: v.doc.layers.map((l) => [l.type, l.name, Math.round(l.x), Math.round(l.y), Math.round(l.width), Math.round(l.height)]),
    bg: v.doc.background.color,
  }));

describe("composition generator", () => {
  it("returns between 8 and 12 variants, honouring count", () => {
    for (const count of [8, 9, 10, 11, 12]) {
      const out = generateCompositions({ ...base, count }, approxMeasure);
      expect(out.length).toBe(count);
    }
    expect(generateCompositions({ ...base, count: 3 }, approxMeasure).length).toBe(8);
    expect(generateCompositions({ ...base, count: 40 }, approxMeasure).length).toBe(12);
  });

  it("uses ten distinct algorithms for count 10", () => {
    const out = generateCompositions({ ...base, count: 10 }, approxMeasure);
    expect(new Set(out.map((v) => v.algorithm)).size).toBe(10);
  });

  it("never repeats an algorithm+parameterisation for 12 variants", () => {
    const out = generateCompositions({ ...base, count: 12 }, approxMeasure);
    const keys = out.map((v) => `${v.algorithm}:${v.variant}`);
    expect(new Set(keys).size).toBe(12);
    expect(new Set(out.map((v) => v.algorithm)).size).toBe(10);
  });

  it("produces documents with no text overflow, clipping or collisions", () => {
    const formats = FORMAT_PRESETS.filter((f) => ["ig-portrait", "ig-square", "ig-story", "desktop", "a4"].includes(f.id));
    for (const style of GEN_STYLES) {
      for (const f of formats) {
        const input = { ...base, style: style.id, format: { width: f.width, height: f.height }, seed: 77 };
        for (const v of generateCompositions(input, approxMeasure)) {
          const res = validateDocument(v.doc, approxMeasure, { intentionalOverlap: v.intentionalOverlap });
          const critical = res.issues.filter((i) => i.critical);
          expect(critical, `${style.id} ${f.id} ${v.algorithm}: ${critical.map((c) => c.message).join("; ")}`).toEqual([]);
          expect(v.doc.width).toBe(f.width);
          expect(v.doc.height).toBe(f.height);
          expect(v.doc.grid.visible).toBe(false);
          expect(v.doc.styleId).toBe(style.id);
        }
      }
    }
  });

  it("handles a logo, user palette, empty optional text and long titles", () => {
    const input: GeneratorInput = {
      ...base,
      logo: { assetId: "ast_logo", width: 400, height: 120 },
      image: { assetId: "ast_photo", width: 3000, height: 2000 },
      palette: ["#112233", "#F5F5F0", "#FF4D00"],
      subtitle: "",
      body: "",
      title: "An Extraordinarily Long Exhibition Title That Must Still Fit Within Its Box",
      density: 0.9,
      asymmetry: 0.9,
    };
    const out = generateCompositions(input, approxMeasure);
    expect(out.length).toBe(10);
    for (const v of out) {
      const res = validateDocument(v.doc, approxMeasure, { intentionalOverlap: v.intentionalOverlap });
      expect(res.issues.filter((i) => i.critical)).toEqual([]);
      expect(v.doc.layers.some((l) => l.type === "image" && l.name === "Logo")).toBe(true);
      expect(v.doc.layers.some((l) => l.type === "image" && (l as { assetId: string }).assetId === "ast_photo")).toBe(true);
    }
  });

  it("falls back to a builtin image when none is given", () => {
    const out = generateCompositions(base, approxMeasure);
    expect(out.every((v) => v.doc.layers.some((l) => l.type === "image" && l.assetId.startsWith("builtin:")))).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    expect(fingerprint(base)).toEqual(fingerprint({ ...base }));
  });

  it("differs for a different seed", () => {
    expect(fingerprint(base)).not.toEqual(fingerprint({ ...base, seed: 98765 }));
  });

  it("exposes the local provider through the registry", async () => {
    const p = getProvider();
    expect(p.id).toBe("local");
    const out = await p.generate({ ...base, count: 8 }, approxMeasure);
    expect(out.length).toBe(8);
    registerProvider({ id: "mock", label: "Mock", generate: async () => [] });
    expect(getProvider("mock").id).toBe("mock");
    expect(getProvider().id).toBe("local");
  });
});
