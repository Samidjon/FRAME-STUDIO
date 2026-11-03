"use client";

import { useCallback, useMemo } from "react";
import { Shape } from "react-konva";
import type Konva from "konva";
import type { GridSettings } from "@/types/canvas";
import { computeGrid } from "@/core/geometry/grid";

/**
 * Non-interactive overlay that paints the computed grid geometry. Lives on a
 * separate Konva layer that is never part of any export.
 */
export function GridOverlay({ width, height, grid, zoom }: { width: number; height: number; grid: GridSettings; zoom: number }) {
  const geo = useMemo(() => computeGrid(width, height, grid), [width, height, grid]);

  const sceneFunc = useCallback(
    (kctx: Konva.Context) => {
      const ctx = (kctx as unknown as { _context: CanvasRenderingContext2D })._context;
      const hair = 1 / zoom;
      ctx.save();
      ctx.globalAlpha = grid.opacity;
      ctx.strokeStyle = grid.color;
      ctx.fillStyle = grid.color;
      ctx.lineWidth = hair;

      const fillCols = grid.type === "column" || grid.type === "modular" || grid.type === "symmetrical" || grid.type === "asymmetrical" || grid.type === "custom" || grid.type === "baseline";
      if (fillCols) {
        ctx.globalAlpha = grid.opacity * 0.22;
        for (const m of geo.modules) ctx.fillRect(m.x, m.y, m.width, m.height);
        ctx.globalAlpha = grid.opacity;
        for (const m of geo.modules) ctx.strokeRect(m.x, m.y, m.width, m.height);
      }
      // margins (live area)
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.strokeRect(geo.content.x, geo.content.y, geo.content.width, geo.content.height);
      ctx.setLineDash([]);

      if (geo.baselines.length) {
        ctx.globalAlpha = grid.opacity * 0.55;
        ctx.beginPath();
        for (const y of geo.baselines) {
          ctx.moveTo(geo.content.x, y);
          ctx.lineTo(geo.content.x + geo.content.width, y);
        }
        ctx.stroke();
        ctx.globalAlpha = grid.opacity;
      }
      ctx.lineWidth = 1.5 * hair;
      ctx.beginPath();
      for (const l of geo.lines) {
        if (l.axis === "x") {
          ctx.moveTo(l.position, 0);
          ctx.lineTo(l.position, height);
        } else {
          ctx.moveTo(0, l.position);
          ctx.lineTo(width, l.position);
        }
      }
      ctx.stroke();
      if (grid.type === "thirds" || grid.type === "golden") {
        // mark the power points
        for (const lx of geo.lines.filter((l) => l.axis === "x"))
          for (const ly of geo.lines.filter((l) => l.axis === "y")) {
            ctx.beginPath();
            ctx.arc(lx.position, ly.position, 5 * hair, 0, Math.PI * 2);
            ctx.fill();
          }
      }
      for (const r of geo.rects) ctx.strokeRect(r.x, r.y, r.width, r.height);
      ctx.lineWidth = 1.5 * hair;
      for (const a of geo.arcs) {
        ctx.beginPath();
        ctx.arc(a.cx, a.cy, a.r, (a.start * Math.PI) / 180, (a.end * Math.PI) / 180);
        ctx.stroke();
      }
      ctx.restore();
    },
    [geo, grid.opacity, grid.color, grid.type, zoom, width, height],
  );

  return <Shape listening={false} sceneFunc={sceneFunc} perfectDrawEnabled={false} />;
}
