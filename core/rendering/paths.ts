import type { MaskShape, ShapeLayer } from "@/types/layer";

/**
 * Resolution-independent path model. Every vector shape and image mask is
 * described as absolute commands in the layer's local box (0,0)-(w,h), then
 * replayed onto Canvas2D, serialised to SVG `d`, or drawn into PDF.
 */
export type PathCmd =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: "Z" };

const K = 0.5522847498;

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): PathCmd[] {
  const ox = rx * K;
  const oy = ry * K;
  return [
    { op: "M", x: cx - rx, y: cy },
    { op: "C", x1: cx - rx, y1: cy - oy, x2: cx - ox, y2: cy - ry, x: cx, y: cy - ry },
    { op: "C", x1: cx + ox, y1: cy - ry, x2: cx + rx, y2: cy - oy, x: cx + rx, y: cy },
    { op: "C", x1: cx + rx, y1: cy + oy, x2: cx + ox, y2: cy + ry, x: cx, y: cy + ry },
    { op: "C", x1: cx - ox, y1: cy + ry, x2: cx - rx, y2: cy + oy, x: cx - rx, y: cy },
    { op: "Z" },
  ];
}

export function roundRectPath(x: number, y: number, w: number, h: number, r: number): PathCmd[] {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr <= 0)
    return [
      { op: "M", x, y },
      { op: "L", x: x + w, y },
      { op: "L", x: x + w, y: y + h },
      { op: "L", x, y: y + h },
      { op: "Z" },
    ];
  const o = rr * (1 - K);
  return [
    { op: "M", x: x + rr, y },
    { op: "L", x: x + w - rr, y },
    { op: "C", x1: x + w - o, y1: y, x2: x + w, y2: y + o, x: x + w, y: y + rr },
    { op: "L", x: x + w, y: y + h - rr },
    { op: "C", x1: x + w, y1: y + h - o, x2: x + w - o, y2: y + h, x: x + w - rr, y: y + h },
    { op: "L", x: x + rr, y: y + h },
    { op: "C", x1: x + o, y1: y + h, x2: x, y2: y + h - o, x, y: y + h - rr },
    { op: "L", x, y: y + rr },
    { op: "C", x1: x, y1: y + o, x2: x + o, y2: y, x: x + rr, y },
    { op: "Z" },
  ];
}

function polyPath(pts: [number, number][]): PathCmd[] {
  return [...pts.map(([x, y], i) => (i ? { op: "L" as const, x, y } : { op: "M" as const, x, y })), { op: "Z" }];
}

export function regularPolygon(w: number, h: number, sides: number): PathCmd[] {
  const n = Math.max(3, Math.round(sides));
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push([w / 2 + (Math.cos(a) * w) / 2, h / 2 + (Math.sin(a) * h) / 2]);
  }
  return polyPath(pts);
}

export function starPath(w: number, h: number, points: number, inner: number): PathCmd[] {
  const n = Math.max(3, Math.round(points));
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? 1 : Math.max(0.05, Math.min(0.95, inner));
    pts.push([w / 2 + (Math.cos(a) * w * r) / 2, h / 2 + (Math.sin(a) * h * r) / 2]);
  }
  return polyPath(pts);
}

export function shapePath(l: Pick<ShapeLayer, "shape" | "width" | "height" | "cornerRadius" | "sides" | "innerRatio" | "pathData" | "pathViewBox">): PathCmd[] {
  const { width: w, height: h } = l;
  switch (l.shape) {
    case "rect":
      return roundRectPath(0, 0, w, h, l.cornerRadius);
    case "circle": {
      const r = Math.min(w, h) / 2;
      return ellipsePath(w / 2, h / 2, r, r);
    }
    case "ellipse":
      return ellipsePath(w / 2, h / 2, w / 2, h / 2);
    case "triangle":
      return polyPath([
        [w / 2, 0],
        [w, h],
        [0, h],
      ]);
    case "polygon":
      return regularPolygon(w, h, l.sides);
    case "star":
      return starPath(w, h, l.sides, l.innerRatio);
    case "line":
      return [
        { op: "M", x: 0, y: h / 2 },
        { op: "L", x: w, y: h / 2 },
      ];
    case "path": {
      const vb = l.pathViewBox ?? { width: 100, height: 100 };
      const sx = w / Math.max(1, vb.width);
      const sy = h / Math.max(1, vb.height);
      return parseSvgPath(l.pathData ?? "").map((c) => scaleCmd(c, sx, sy));
    }
  }
}

export function maskPath(mask: MaskShape, w: number, h: number, radius: number): PathCmd[] | null {
  switch (mask) {
    case "none":
      return radius > 0 ? roundRectPath(0, 0, w, h, radius) : null;
    case "circle": {
      const r = Math.min(w, h) / 2;
      return ellipsePath(w / 2, h / 2, r, r);
    }
    case "ellipse":
      return ellipsePath(w / 2, h / 2, w / 2, h / 2);
    case "triangle":
      return polyPath([
        [w / 2, 0],
        [w, h],
        [0, h],
      ]);
    case "hexagon":
      return regularPolygon(w, h, 6);
    case "star":
      return starPath(w, h, 5, 0.5);
    case "diamond":
      return polyPath([
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2],
      ]);
    case "arch": {
      const r = w / 2;
      const top = Math.min(r, h);
      return [
        { op: "M", x: 0, y: h },
        { op: "L", x: 0, y: top },
        { op: "C", x1: 0, y1: top - r * K, x2: r - r * K, y2: top - r, x: r, y: top - r },
        { op: "C", x1: r + r * K, y1: top - r, x2: w, y2: top - r * K, x: w, y: top },
        { op: "L", x: w, y: h },
        { op: "Z" },
      ];
    }
  }
}

function scaleCmd(c: PathCmd, sx: number, sy: number): PathCmd {
  switch (c.op) {
    case "M":
    case "L":
      return { op: c.op, x: c.x * sx, y: c.y * sy };
    case "C":
      return { op: "C", x1: c.x1 * sx, y1: c.y1 * sy, x2: c.x2 * sx, y2: c.y2 * sy, x: c.x * sx, y: c.y * sy };
    case "Z":
      return c;
  }
}

export function tracePath(ctx: CanvasRenderingContext2D | Path2D, cmds: PathCmd[]) {
  for (const c of cmds) {
    if (c.op === "M") ctx.moveTo(c.x, c.y);
    else if (c.op === "L") ctx.lineTo(c.x, c.y);
    else if (c.op === "C") ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    else ctx.closePath();
  }
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export function pathToSvgD(cmds: PathCmd[]): string {
  return cmds
    .map((c) =>
      c.op === "Z" ? "Z" : c.op === "C" ? `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}` : `${c.op}${f(c.x)} ${f(c.y)}`,
    )
    .join(" ");
}

/**
 * Minimal SVG path parser supporting M L H V C S Q T Z (absolute + relative).
 * Elliptical arcs (A) are approximated by a straight segment to their end point.
 */
export function parseSvgPath(d: string): PathCmd[] {
  const out: PathCmd[] = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let i = 0;
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let lastCtrl: { x: number; y: number } | null = null;
  let cmd = "";
  const num = () => parseFloat(tokens[i++] ?? "0");
  const isCmd = (t?: string) => !!t && /[a-zA-Z]/.test(t);
  let guard = 0;
  while (i < tokens.length && guard++ < 100000) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    if (C === "Z") {
      out.push({ op: "Z" });
      cx = sx;
      cy = sy;
      lastCtrl = null;
      cmd = "";
      continue;
    }
    if (C === "M") {
      cx = ox + num();
      cy = oy + num();
      sx = cx;
      sy = cy;
      out.push({ op: "M", x: cx, y: cy });
      cmd = rel ? "l" : "L";
      lastCtrl = null;
    } else if (C === "L") {
      cx = ox + num();
      cy = oy + num();
      out.push({ op: "L", x: cx, y: cy });
      lastCtrl = null;
    } else if (C === "H") {
      cx = ox + num();
      out.push({ op: "L", x: cx, y: cy });
      lastCtrl = null;
    } else if (C === "V") {
      cy = oy + num();
      out.push({ op: "L", x: cx, y: cy });
      lastCtrl = null;
    } else if (C === "C") {
      const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num();
      cx = ox + num();
      cy = oy + num();
      out.push({ op: "C", x1, y1, x2, y2, x: cx, y: cy });
      lastCtrl = { x: x2, y: y2 };
    } else if (C === "S") {
      const x1 = lastCtrl ? 2 * cx - lastCtrl.x : cx;
      const y1 = lastCtrl ? 2 * cy - lastCtrl.y : cy;
      const x2 = ox + num(), y2 = oy + num();
      cx = ox + num();
      cy = oy + num();
      out.push({ op: "C", x1, y1, x2, y2, x: cx, y: cy });
      lastCtrl = { x: x2, y: y2 };
    } else if (C === "Q" || C === "T") {
      let qx: number, qy: number;
      if (C === "Q") {
        qx = ox + num();
        qy = oy + num();
      } else {
        qx = lastCtrl ? 2 * cx - lastCtrl.x : cx;
        qy = lastCtrl ? 2 * cy - lastCtrl.y : cy;
      }
      const ex = ox + num(), ey = oy + num();
      out.push({ op: "C", x1: cx + (2 / 3) * (qx - cx), y1: cy + (2 / 3) * (qy - cy), x2: ex + (2 / 3) * (qx - ex), y2: ey + (2 / 3) * (qy - ey), x: ex, y: ey });
      cx = ex;
      cy = ey;
      lastCtrl = { x: qx, y: qy };
    } else if (C === "A") {
      num(); num(); num(); num(); num();
      cx = ox + num();
      cy = oy + num();
      out.push({ op: "L", x: cx, y: cy });
      lastCtrl = null;
    } else {
      i++;
    }
  }
  return out;
}

/** Bounding box of parsed path data, used to fit pasted SVG paths. */
export function pathBounds(cmds: PathCmd[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  for (const c of cmds) {
    if (c.op === "M" || c.op === "L") add(c.x, c.y);
    else if (c.op === "C") { add(c.x1, c.y1); add(c.x2, c.y2); add(c.x, c.y); }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 100, height: 100 };
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}
