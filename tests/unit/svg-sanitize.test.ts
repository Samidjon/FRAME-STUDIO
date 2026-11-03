// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { SvgRejectedError, sanitizeSvg } from "@/lib/image/svg-sanitize";

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"';

function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, "image/svg+xml");
}

describe("sanitizeSvg", () => {
  it("removes <script> elements", () => {
    const out = sanitizeSvg(`<svg ${NS} width="10" height="10"><script>alert(1)</script><rect width="10" height="10"/></svg>`);
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<rect");
  });

  it("strips on* event handler attributes", () => {
    const out = sanitizeSvg(`<svg ${NS} width="10" height="10" onload="alert(1)"><circle cx="5" cy="5" r="4" onclick="steal()" onmouseover="x()"/></svg>`);
    expect(out).not.toMatch(/\son[a-z]+=/i);
    expect(out).not.toContain("alert(1)");
    expect(out).not.toContain("steal()");
    expect(out).toContain("<circle");
  });

  it("removes javascript: hrefs (href and xlink:href)", () => {
    const out = sanitizeSvg(
      `<svg ${NS} ${XLINK} width="10" height="10"><a href="javascript:alert(1)"><rect width="5" height="5"/></a><a xlink:href="JavaScript:alert(2)"><rect width="5" height="5"/></a></svg>`,
    );
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out).toContain("<rect");
  });

  it("removes <foreignObject> and its HTML contents", () => {
    const out = sanitizeSvg(`<svg ${NS} width="10" height="10"><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></div></foreignObject><rect width="1" height="1"/></svg>`);
    expect(out.toLowerCase()).not.toContain("foreignobject");
    expect(out).not.toContain("onerror");
    expect(out).toContain("<rect");
  });

  it("removes external hrefs but keeps local fragment references", () => {
    const out = sanitizeSvg(
      `<svg ${NS} ${XLINK} width="20" height="20"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient><path id="p" d="M0 0L10 10"/></defs><image href="https://evil.example/x.png" width="10" height="10"/><image xlink:href="http://evil.example/y.png" width="10" height="10"/><use href="#p"/><rect fill="url(#g)" width="5" height="5"/></svg>`,
    );
    expect(out).not.toContain("evil.example");
    const doc = parse(out);
    const use = doc.getElementsByTagName("use")[0];
    expect(use.getAttribute("href")).toBe("#p");
    expect(doc.getElementsByTagName("rect")[0].getAttribute("fill")).toBe("url(#g)");
  });

  it("removes style attributes and <style> blocks that load external resources", () => {
    const out = sanitizeSvg(
      `<svg ${NS} width="10" height="10"><style>@import url("https://evil.example/a.css");</style><rect style="fill:url(https://evil.example/t.png)" width="10" height="10"/></svg>`,
    );
    expect(out).not.toContain("evil.example");
    expect(out).toContain("<rect");
  });

  it("keeps ordinary shapes, paths, groups and their presentation attributes", () => {
    const src = `<svg ${NS} width="100" height="50" viewBox="0 0 100 50"><g fill="#FF4D00" transform="translate(2 2)"><rect x="0" y="0" width="40" height="20"/><circle cx="60" cy="10" r="8"/><ellipse cx="80" cy="30" rx="6" ry="4"/><polygon points="0,40 10,30 20,40"/><path d="M0 0 L100 50" stroke="#171717" stroke-width="2"/><line x1="0" y1="0" x2="10" y2="10"/></g><text x="5" y="45">FRAME</text></svg>`;
    const doc = parse(sanitizeSvg(src));
    for (const tag of ["g", "rect", "circle", "ellipse", "polygon", "path", "line", "text"]) {
      expect(doc.getElementsByTagName(tag).length, tag).toBe(1);
    }
    expect(doc.getElementsByTagName("path")[0].getAttribute("d")).toBe("M0 0 L100 50");
    expect(doc.getElementsByTagName("g")[0].getAttribute("fill")).toBe("#FF4D00");
    expect(doc.getElementsByTagName("text")[0].textContent).toBe("FRAME");
  });

  it("rejects documents with ENTITY declarations (XXE / billion laughs)", () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;">]><svg ${NS}><text>&b;</text></svg>`;
    expect(() => sanitizeSvg(xxe)).toThrow(SvgRejectedError);
    expect(() => sanitizeSvg(`<!doctype svg [<!entity x SYSTEM "file:///etc/passwd">]><svg ${NS}>&x;</svg>`)).toThrow(SvgRejectedError);
  });

  it("rejects non-SVG and malformed input", () => {
    expect(() => sanitizeSvg(`<html><body>hi</body></html>`)).toThrow(SvgRejectedError);
    expect(() => sanitizeSvg(`<svg ${NS}><rect></svg>`)).toThrow(SvgRejectedError);
  });

  it("adds width/height from the viewBox when missing", () => {
    const doc = parse(sanitizeSvg(`<svg ${NS} viewBox="0 0 320 180"><rect width="10" height="10"/></svg>`));
    const root = doc.documentElement;
    expect(root.getAttribute("width")).toBe("320");
    expect(root.getAttribute("height")).toBe("180");
  });

  it("accepts comma-separated viewBox values", () => {
    const root = parse(sanitizeSvg(`<svg ${NS} viewBox="0,0,64,32"/>`)).documentElement;
    expect(root.getAttribute("width")).toBe("64");
    expect(root.getAttribute("height")).toBe("32");
  });

  it("falls back to 512×512 without a usable viewBox and keeps explicit sizes", () => {
    const fallback = parse(sanitizeSvg(`<svg ${NS}><rect width="1" height="1"/></svg>`)).documentElement;
    expect(fallback.getAttribute("width")).toBe("512");
    expect(fallback.getAttribute("height")).toBe("512");
    const explicit = parse(sanitizeSvg(`<svg ${NS} width="40" height="30" viewBox="0 0 400 300"/>`)).documentElement;
    expect(explicit.getAttribute("width")).toBe("40");
    expect(explicit.getAttribute("height")).toBe("30");
  });

  it("rejects input larger than 2 MB", () => {
    const big = `<svg ${NS}>` + "<!--" + "x".repeat(2 * 1024 * 1024) + "--></svg>";
    expect(() => sanitizeSvg(big)).toThrow(SvgRejectedError);
  });
});
