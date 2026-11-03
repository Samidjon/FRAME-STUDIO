"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "@/stores/editor-store";

export const RULER = 20;

function niceStep(zoom: number) {
  const target = 80 / zoom; // ~80 screen px between labels
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  for (const m of [1, 2, 5, 10]) if (pow * m >= target) return pow * m;
  return pow * 10;
}

/**
 * Pixel rulers along the top/left edges. Dragging out of a ruler creates a
 * guide; dropping it back on the ruler (or off the page) removes it.
 */
export function Rulers({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const top = useRef<HTMLCanvasElement>(null);
  const left = useRef<HTMLCanvasElement>(null);
  const viewport = useEditor((s) => s.viewport);
  const stageSize = useEditor((s) => s.stageSize);
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const css = getComputedStyle(document.documentElement);
    const fg = css.getPropertyValue("--fg-subtle").trim() || "#888";
    const bg = css.getPropertyValue("--bg-raised").trim() || "#1a1a1a";
    const line = css.getPropertyValue("--line-strong").trim() || "#444";
    const sel = doc?.layers.filter((l) => selection.includes(l.id)) ?? [];
    const draw = (c: HTMLCanvasElement | null, horizontal: boolean) => {
      if (!c) return;
      const len = horizontal ? stageSize.width : stageSize.height;
      c.width = len * dpr;
      c.height = RULER * dpr;
      c.style.width = `${horizontal ? len : RULER}px`;
      c.style.height = `${horizontal ? RULER : len}px`;
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!horizontal) {
        // draw into a rotated space for the vertical ruler
        c.width = RULER * dpr;
        c.height = len * dpr;
        ctx.setTransform(0, dpr, -dpr, 0, RULER * dpr, 0);
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, len, RULER);
      const z = viewport.zoom;
      const pan = horizontal ? viewport.panX : viewport.panY;
      // highlight selection extent
      for (const l of sel) {
        const a = (horizontal ? l.x : l.y) * z + pan;
        const b = a + (horizontal ? l.width : l.height) * z;
        ctx.fillStyle = "rgba(255,77,0,0.18)";
        ctx.fillRect(a, 0, b - a, RULER);
      }
      const step = niceStep(z);
      const minor = step / 5;
      const start = Math.floor(-pan / z / minor) * minor;
      const end = (len - pan) / z;
      ctx.strokeStyle = line;
      ctx.fillStyle = fg;
      ctx.font = "9px JetBrains Mono, monospace";
      ctx.textBaseline = "top";
      ctx.beginPath();
      for (let v = start; v <= end; v += minor) {
        const p = Math.round(v * z + pan) + 0.5;
        const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
        ctx.moveTo(p, RULER);
        ctx.lineTo(p, major ? 4 : RULER - 5);
        if (major) ctx.fillText(String(Math.round(v)), p + 3, 3);
      }
      ctx.moveTo(0, RULER - 0.5);
      ctx.lineTo(len, RULER - 0.5);
      ctx.stroke();
    };
    draw(top.current, true);
    draw(left.current, false);
  }, [viewport, stageSize, doc, selection]);

  const startGuide = (axis: "x" | "y") => (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container || !doc) return;
    e.preventDefault();
    const st = useEditor.getState();
    const r = container.getBoundingClientRect();
    const toDoc = (cx: number, cy: number) => (axis === "x" ? (cx - r.left - st.viewport.panX) / st.viewport.zoom : (cy - r.top - st.viewport.panY) / st.viewport.zoom);
    const id = st.addGuide(axis, Math.round(toDoc(e.clientX, e.clientY)));
    const move = (ev: PointerEvent) => useEditor.getState().moveGuide(id, Math.round(toDoc(ev.clientX, ev.clientY)), { history: false });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const onRuler = axis === "x" ? ev.clientY - r.top < RULER : ev.clientX - r.left < RULER;
      const pos = toDoc(ev.clientX, ev.clientY);
      const limit = axis === "x" ? doc.width : doc.height;
      if (onRuler || pos < 0 || pos > limit) useEditor.getState().removeGuide(id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <>
      <canvas ref={top} className="absolute left-0 top-0 z-10 cursor-row-resize" onPointerDown={startGuide("y")} aria-label="Horizontal ruler — drag to create a guide" />
      <canvas ref={left} className="absolute left-0 top-0 z-10 cursor-col-resize" onPointerDown={startGuide("x")} aria-label="Vertical ruler — drag to create a guide" />
      <div className="absolute left-0 top-0 z-10 h-5 w-5 border-b border-r border-line-strong bg-raised" />
    </>
  );
}
