/**
 * Conservative SVG sanitiser. Uploaded SVGs are only ever rendered through
 * <img>/canvas (which never executes scripts), but we still strip anything
 * active or external so stored files are safe to serve back.
 */

const FORBIDDEN_TAGS = new Set(["script", "foreignobject", "iframe", "embed", "object", "audio", "video", "handler", "listener", "set", "animate", "animatemotion", "animatetransform"]);
const URL_ATTRS = new Set(["href", "xlink:href", "src", "action", "formaction"]);

export class SvgRejectedError extends Error {}

export function sanitizeSvg(source: string): string {
  if (source.length > 2 * 1024 * 1024) throw new SvgRejectedError("SVG is larger than 2 MB");
  if (/<!ENTITY/i.test(source)) throw new SvgRejectedError("SVG entity declarations are not allowed");
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length) throw new SvgRejectedError("SVG could not be parsed");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") throw new SvgRejectedError("File is not an SVG document");

  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      if (FORBIDDEN_TAGS.has(child.nodeName.toLowerCase())) {
        child.remove();
        continue;
      }
      walk(child);
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (URL_ATTRS.has(name) && !value.startsWith("#") && !value.startsWith("data:image/")) el.removeAttribute(attr.name);
      else if (name === "style" && /(url\(|expression|javascript:|@import)/i.test(value) && !/url\(#/.test(value)) el.removeAttribute(attr.name);
    }
    if (el.nodeName.toLowerCase() === "style" && /@import|javascript:|url\((?!#)/i.test(el.textContent ?? "")) el.remove();
  };
  walk(root);

  // Ensure intrinsic size so <img> decoding works and aspect is known.
  if (!root.getAttribute("width") || !root.getAttribute("height")) {
    const vb = (root.getAttribute("viewBox") ?? "").split(/[ ,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      root.setAttribute("width", String(vb[2]));
      root.setAttribute("height", String(vb[3]));
    } else {
      root.setAttribute("width", "512");
      root.setAttribute("height", "512");
    }
  }
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(root);
}
