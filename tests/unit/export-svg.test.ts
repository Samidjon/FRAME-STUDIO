// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createDocument, createShapeLayer, createTextLayer } from "@/core/document/factory";
import { approxMeasure } from "@/core/text/layout";
import { buildSvg, escapeXml, exportSvgDetailed } from "@/editor/export/svg";
import type { DesignDocument } from "@/types/project";

function sampleDoc(): DesignDocument {
  const doc = createDocument(800, 600, {
    guides: [{ id: "g1", axis: "x", position: 100 }],
  });
  doc.layers = [
    createShapeLayer("rect", { x: 10, y: 20, width: 200, height: 100, cornerRadius: 12, fill: "#FF4D00", stroke: "rgba(0,0,0,0.5)", strokeWidth: 3, dash: [4, 2] }),
    createShapeLayer("circle", { x: 300, y: 40, width: 120, height: 120, rotation: 30, opacity: 0.5, blendMode: "multiply" }),
    createShapeLayer("star", { x: 500, y: 40, width: 160, height: 160, sides: 5, innerRatio: 0.4 }),
    createTextLayer(
      {
        text: "Fish <&> Chips \"quoted\"\nsecond line",
        x: 40,
        y: 300,
        width: 600,
        fontSize: 48,
        uppercase: false,
        stroke: "#000000",
        strokeWidth: 2,
        shadow: { enabled: true, color: "rgba(0,0,0,0.4)", blur: 10, offsetX: 2, offsetY: 4 },
        backgroundColor: "#FFFFFF",
      },
      800,
    ),
    createTextLayer({ text: "hidden", visible: false }, 800),
  ];
  return doc;
}

function parse(svg: string) {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  return parsed;
}

describe("SVG export", () => {
  const svg = buildSvg(sampleDoc(), { measure: approxMeasure });

  it("is well-formed XML", () => {
    const parsed = parse(svg);
    expect(parsed.getElementsByTagName("parsererror").length).toBe(0);
    expect(parsed.documentElement.nodeName.toLowerCase()).toBe("svg");
  });

  it("has document size and viewBox", () => {
    expect(svg).toContain('viewBox="0 0 800 600"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
  });

  it("serialises shapes as vector paths with transforms", () => {
    const paths = svg.match(/<path\s/g) ?? [];
    expect(paths.length).toBe(3);
    expect(svg).toContain('transform="translate(300 40) rotate(30)"');
    expect(svg).toContain("mix-blend-mode:multiply");
    expect(svg).toContain('stroke-dasharray="4 2"');
    expect(svg).toContain('stroke-opacity="0.5"');
  });

  it("emits real text with escaped content", () => {
    expect(svg).toContain("<text ");
    expect(svg).toContain("&lt;&amp;&gt;");
    expect(svg).not.toContain("<&>");
    expect(svg).toContain('paint-order="stroke"');
    expect(svg).toContain("feDropShadow");
    const parsed = parse(svg);
    const text = parsed.getElementsByTagName("text")[0];
    expect(text.textContent).toContain("<&>");
    expect(text.textContent).toContain("Fish");
    expect(text.getElementsByTagName("tspan").length).toBeGreaterThan(3);
  });

  it("omits hidden layers, grid and guides", () => {
    expect(svg).not.toContain("hidden");
    expect(svg).not.toMatch(/guide|grid/i);
  });

  it("paints the background unless transparent", () => {
    expect(svg).toContain('id="background"');
    const t = buildSvg(sampleDoc(), { measure: approxMeasure, transparent: true });
    expect(t).not.toContain('id="background"');
  });

  it("applies uppercase", () => {
    const doc = createDocument(400, 200);
    doc.layers = [createTextLayer({ text: "make me loud", uppercase: true }, 400)];
    const out = buildSvg(doc, { measure: approxMeasure });
    expect(out).toContain(">MAKE<");
    expect(out).not.toContain(">make<");
  });

  it("positions vertical glyphs individually", () => {
    const doc = createDocument(400, 400);
    doc.layers = [createTextLayer({ text: "ABC", vertical: true }, 400)];
    const out = buildSvg(doc, { measure: approxMeasure });
    expect(out).toContain('text-anchor="middle"');
    expect((out.match(/<tspan /g) ?? []).length).toBe(3);
  });

  it("escapes all XML specials", () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;");
  });

  it("embeds fonts via an injected fetch and notes failures", async () => {
    const doc = createDocument(400, 200);
    doc.layers = [createTextLayer({ text: "Hi", fontFamily: "Inter", fontWeight: 700 }, 400), createTextLayer({ text: "x", fontFamily: "My Local Font" }, 400)];
    const requested: string[] = [];
    const fetchFn = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      if (url.includes("fonts.googleapis.com"))
        return new Response(
          "/* latin */\n@font-face { font-family: 'Inter'; font-style: normal; font-weight: 700; src: url(https://fonts.gstatic.com/inter.woff2) format('woff2'); unicode-range: U+0000-00FF; }\n/* cyrillic */\n@font-face { font-family: 'Inter'; src: url(https://fonts.gstatic.com/cyr.woff2) format('woff2'); unicode-range: U+0400-045F; }",
        );
      return new Response(new Uint8Array([119, 79, 70, 50]));
    }) as typeof fetch;
    const { svg: out, notes } = await exportSvgDetailed(doc, { measure: approxMeasure, getSource: () => null, embedFonts: true, fetchFn });
    expect(requested.some((u) => u.includes("Inter:ital,wght@0,700"))).toBe(true);
    expect(requested.some((u) => u.includes("cyr.woff2"))).toBe(false);
    expect(out).toContain("data:font/woff2;base64,");
    expect(notes.some((n) => n.includes("My Local Font"))).toBe(true);
    expect(parse(out).getElementsByTagName("parsererror").length).toBe(0);
  });
});
