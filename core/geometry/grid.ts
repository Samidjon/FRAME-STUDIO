import type { GridSettings, Rect } from "@/types/canvas";

/**
 * Swiss grid engine. All geometry is derived mathematically from the
 * document size and the grid settings — nothing here is decorative.
 */

export const PHI = (1 + Math.sqrt(5)) / 2;

export interface Track {
  start: number;
  size: number;
}

export interface GridGeometry {
  /** Live area inside the margins. */
  content: Rect;
  columns: Track[];
  rows: Track[];
  /** Module rectangles (columns × rows). */
  modules: Rect[];
  baselines: number[];
  /** Extra construction lines (golden section, thirds, symmetry axis...). */
  lines: { axis: "x" | "y"; position: number; kind: "primary" | "secondary" }[];
  /** Construction rectangles (Fibonacci squares). */
  rects: Rect[];
  /** Arc segments for the Fibonacci spiral: centre, radius, start/end angle (deg). */
  arcs: { cx: number; cy: number; r: number; start: number; end: number }[];
  /** All x / y positions that objects can snap to. */
  snapX: number[];
  snapY: number[];
}

/** Split `length` into `count` tracks separated by `gutter`, weighted by `ratios`. */
export function splitTracks(start: number, length: number, count: number, gutter: number, ratios?: number[]): Track[] {
  const n = Math.max(1, Math.floor(count));
  const weights = ratios && ratios.length === n ? ratios.map((r) => Math.max(0.01, r)) : new Array(n).fill(1);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const available = Math.max(0, length - gutter * (n - 1));
  const tracks: Track[] = [];
  let cursor = start;
  for (let i = 0; i < n; i++) {
    const size = (available * weights[i]) / totalW;
    tracks.push({ start: cursor, size });
    cursor += size + gutter;
  }
  return tracks;
}

function contentRect(w: number, h: number, g: GridSettings): Rect {
  const { top, right, bottom, left } = g.margins;
  return { x: left, y: top, width: Math.max(1, w - left - right), height: Math.max(1, h - top - bottom) };
}

/** Golden-ratio subdivision: alternately cut the remaining rectangle by 1/φ. */
export function fibonacciRects(area: Rect, depth = 8) {
  const rects: Rect[] = [];
  const arcs: GridGeometry["arcs"] = [];
  let r = { ...area };
  for (let i = 0; i < depth; i++) {
    const landscape = r.width >= r.height;
    const side = landscape ? r.height : r.width;
    const dir = i % 4;
    let sq: Rect;
    if (landscape) {
      // square on left (dir 0) or right (dir 2)
      if (dir === 0 || dir === 1) {
        sq = { x: r.x, y: r.y, width: side, height: side };
        r = { x: r.x + side, y: r.y, width: r.width - side, height: r.height };
      } else {
        sq = { x: r.x + r.width - side, y: r.y, width: side, height: side };
        r = { x: r.x, y: r.y, width: r.width - side, height: r.height };
      }
    } else {
      if (dir === 1 || dir === 0) {
        sq = { x: r.x, y: r.y, width: side, height: side };
        r = { x: r.x, y: r.y + side, width: r.width, height: r.height - side };
      } else {
        sq = { x: r.x, y: r.y + r.height - side, width: side, height: side };
        r = { x: r.x, y: r.y, width: r.width, height: r.height - side };
      }
    }
    rects.push(sq);
    if (r.width < 2 || r.height < 2) break;
  }
  // quarter-circle arcs inscribed in each square, oriented by the remaining rect position
  for (let i = 0; i < rects.length; i++) {
    const s = rects[i];
    const next = rects[i + 1];
    let cx = s.x + s.width;
    let cy = s.y + s.height;
    let start = 180;
    if (next) {
      const nx = next.x + next.width / 2;
      const ny = next.y + next.height / 2;
      const right = nx > s.x + s.width - 0.5;
      const left = nx < s.x + 0.5;
      const below = ny > s.y + s.height - 0.5;
      const above = ny < s.y + 0.5;
      if (right) { cx = s.x + s.width; cy = s.y + s.height; start = 180; }
      else if (below) { cx = s.x; cy = s.y + s.height; start = 270; }
      else if (left) { cx = s.x; cy = s.y; start = 0; }
      else if (above) { cx = s.x + s.width; cy = s.y; start = 90; }
    }
    arcs.push({ cx, cy, r: s.width, start, end: start + 90 });
  }
  return { rects, arcs };
}

export function computeGrid(width: number, height: number, g: GridSettings): GridGeometry {
  const content = contentRect(width, height, g);
  let columns: Track[] = [];
  let rows: Track[] = [];
  const lines: GridGeometry["lines"] = [];
  let rects: Rect[] = [];
  let arcs: GridGeometry["arcs"] = [];

  switch (g.type) {
    case "column":
      columns = splitTracks(content.x, content.width, g.columns, g.gutter);
      rows = [{ start: content.y, size: content.height }];
      break;
    case "modular":
      columns = splitTracks(content.x, content.width, g.columns, g.gutter);
      rows = splitTracks(content.y, content.height, g.rows, g.gutter);
      break;
    case "baseline":
      columns = splitTracks(content.x, content.width, g.columns, g.gutter);
      rows = [{ start: content.y, size: content.height }];
      break;
    case "symmetrical": {
      // Mirror margins around the vertical axis: use the larger side margin on both sides.
      const side = Math.max(g.margins.left, g.margins.right);
      const sym: Rect = { x: side, y: content.y, width: Math.max(1, width - side * 2), height: content.height };
      const n = g.columns % 2 === 0 ? g.columns : g.columns + 1;
      columns = splitTracks(sym.x, sym.width, n, g.gutter);
      rows = splitTracks(sym.y, sym.height, g.rows, g.gutter);
      lines.push({ axis: "x", position: width / 2, kind: "primary" });
      lines.push({ axis: "y", position: height / 2, kind: "secondary" });
      content.x = sym.x;
      content.width = sym.width;
      break;
    }
    case "asymmetrical": {
      const ratios = g.columnRatios.length ? g.columnRatios : [1, 2];
      columns = splitTracks(content.x, content.width, ratios.length, g.gutter, ratios);
      rows = splitTracks(content.y, content.height, g.rows, g.gutter);
      break;
    }
    case "custom": {
      const cr = g.columnRatios.length ? g.columnRatios : [1];
      const rr = g.rowRatios.length ? g.rowRatios : [1];
      columns = splitTracks(content.x, content.width, cr.length, g.gutter, cr);
      rows = splitTracks(content.y, content.height, rr.length, g.gutter, rr);
      break;
    }
    case "golden": {
      const a = 1 / PHI;
      const xs = [content.x + content.width * (1 - a), content.x + content.width * a];
      const ys = [content.y + content.height * (1 - a), content.y + content.height * a];
      columns = [
        { start: content.x, size: xs[0] - content.x },
        { start: xs[0], size: xs[1] - xs[0] },
        { start: xs[1], size: content.x + content.width - xs[1] },
      ];
      rows = [
        { start: content.y, size: ys[0] - content.y },
        { start: ys[0], size: ys[1] - ys[0] },
        { start: ys[1], size: content.y + content.height - ys[1] },
      ];
      xs.forEach((p) => lines.push({ axis: "x", position: p, kind: "primary" }));
      ys.forEach((p) => lines.push({ axis: "y", position: p, kind: "primary" }));
      break;
    }
    case "fibonacci": {
      const res = fibonacciRects(content, 9);
      rects = res.rects;
      arcs = res.arcs;
      columns = [{ start: content.x, size: content.width }];
      rows = [{ start: content.y, size: content.height }];
      break;
    }
    case "thirds": {
      columns = splitTracks(content.x, content.width, 3, 0);
      rows = splitTracks(content.y, content.height, 3, 0);
      [1, 2].forEach((i) => {
        lines.push({ axis: "x", position: content.x + (content.width * i) / 3, kind: "primary" });
        lines.push({ axis: "y", position: content.y + (content.height * i) / 3, kind: "primary" });
      });
      break;
    }
  }

  const modules: Rect[] = [];
  for (const r of rows) for (const c of columns) modules.push({ x: c.start, y: r.start, width: c.size, height: r.size });

  const baselines: number[] = [];
  if ((g.type === "baseline" || g.showBaseline) && g.baseline >= 2) {
    for (let y = content.y + g.baseline; y <= content.y + content.height + 0.01; y += g.baseline) baselines.push(y);
  }

  const snapX = new Set<number>([0, width / 2, width, content.x, content.x + content.width]);
  const snapY = new Set<number>([0, height / 2, height, content.y, content.y + content.height]);
  columns.forEach((c) => {
    snapX.add(c.start);
    snapX.add(c.start + c.size);
  });
  rows.forEach((r) => {
    snapY.add(r.start);
    snapY.add(r.start + r.size);
  });
  lines.forEach((l) => (l.axis === "x" ? snapX : snapY).add(l.position));
  rects.forEach((r) => {
    snapX.add(r.x);
    snapX.add(r.x + r.width);
    snapY.add(r.y);
    snapY.add(r.y + r.height);
  });

  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    content,
    columns,
    rows,
    modules,
    baselines,
    lines,
    rects,
    arcs,
    snapX: [...snapX].map(round).sort((a, b) => a - b),
    snapY: [...snapY].map(round).sort((a, b) => a - b),
  };
}

/** Rectangle spanning columns [c0..c1] and rows [r0..r1] (inclusive, clamped). */
export function spanRect(geo: GridGeometry, c0: number, c1: number, r0: number, r1: number): Rect {
  const cl = geo.columns;
  const rl = geo.rows;
  const a = cl[Math.max(0, Math.min(cl.length - 1, c0))];
  const b = cl[Math.max(0, Math.min(cl.length - 1, c1))];
  const c = rl[Math.max(0, Math.min(rl.length - 1, r0))];
  const d = rl[Math.max(0, Math.min(rl.length - 1, r1))];
  return { x: a.start, y: c.start, width: b.start + b.size - a.start, height: d.start + d.size - c.start };
}
