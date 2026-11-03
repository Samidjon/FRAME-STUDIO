import type { DesignDocument } from "@/types/project";
import { computeGrid } from "@/core/geometry/grid";
import { layerBounds } from "@/core/geometry/transform";

/** Collect every line a moving selection may snap to. */
export function snapTargets(doc: DesignDocument, exclude: Set<string>) {
  const xs = new Set<number>([0, doc.width / 2, doc.width]);
  const ys = new Set<number>([0, doc.height / 2, doc.height]);
  if (doc.grid.snap && doc.grid.visible) {
    const g = computeGrid(doc.width, doc.height, doc.grid);
    g.snapX.forEach((x) => xs.add(x));
    g.snapY.forEach((y) => ys.add(y));
    if (g.baselines.length && g.baselines.length < 600) g.baselines.forEach((y) => ys.add(y));
  }
  for (const gd of doc.guides) (gd.axis === "x" ? xs : ys).add(gd.position);
  // Smart alignment with other visible objects.
  for (const l of doc.layers) {
    if (exclude.has(l.id) || !l.visible) continue;
    if (l.width >= doc.width * 0.98 && l.height >= doc.height * 0.98) continue; // skip full-bleed backgrounds
    const b = layerBounds(l);
    xs.add(b.x);
    xs.add(b.x + b.width / 2);
    xs.add(b.x + b.width);
    ys.add(b.y);
    ys.add(b.y + b.height / 2);
    ys.add(b.y + b.height);
  }
  return { x: [...xs], y: [...ys] };
}
