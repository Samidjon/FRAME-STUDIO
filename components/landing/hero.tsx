"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { DocPreview } from "@/components/shared/doc-preview";
import { cx } from "@/components/shared/ui";
import { Arrow, Container, LinkButton } from "./primitives";
import { showcaseDoc, showcaseItem } from "./showcase-docs";

/**
 * Poster placements on the stage's 12-column grid.
 * [colStart (1-based), span, top %] for mobile (m) and desktop (d).
 * Horizontal positions resolve through the same calc() as the overlay, so
 * every poster edge lands exactly on a column edge.
 */
const PLACEMENTS: { id: string; depth: number; z: number; m: [number, number, number]; d: [number, number, number] }[] = [
  { id: "ridges", depth: 6, z: 1, m: [6, 7, 3], d: [6, 6, 4] },
  { id: "swiss", depth: 10, z: 2, m: [1, 5, 8], d: [1, 3, 16] },
  { id: "dune", depth: 16, z: 3, m: [4, 7, 21], d: [3, 4, 8] },
  { id: "album", depth: 22, z: 4, m: [1, 5, 62], d: [7, 3, 46] },
  { id: "neon", depth: 28, z: 5, m: [10, 3, 51], d: [11, 2, 24] },
];

const colLeft = (c: number) => `calc(${c - 1} * (100% - 11 * var(--g)) / 12 + ${c - 1} * var(--g))`;
const spanWidth = (s: number) => `calc(${s} * (100% - 11 * var(--g)) / 12 + ${s - 1} * var(--g))`;

interface Readout {
  x: number;
  y: number;
  col: number | null; // null = inside a gutter
  inside: boolean;
}

function pad(n: number, l = 4) {
  return Math.max(0, Math.round(n)).toString().padStart(l, "0");
}

function Stage() {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const [grid, setGrid] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [r, setR] = useState<Readout>({ x: 0, y: 0, col: null, inside: false });
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const g = parseFloat(getComputedStyle(el).getPropertyValue("--g")) || 16;
      const colW = (b.width - 11 * g) / 12;
      const i = Math.floor(x / (colW + g));
      const inCol = x - i * (colW + g) <= colW;
      el.style.setProperty("--px", ((x / b.width) * 2 - 1).toFixed(3));
      el.style.setProperty("--py", ((y / b.height) * 2 - 1).toFixed(3));
      el.style.setProperty("--cx", `${x}px`);
      el.style.setProperty("--cy", `${y}px`);
      setR({ x, y, col: inCol ? Math.min(12, i + 1) : null, inside: true });
    });
  }, []);

  const onLeave = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const el = ref.current;
    el?.style.setProperty("--px", "0");
    el?.style.setProperty("--py", "0");
    setR((p) => ({ ...p, inside: false }));
    setHover(null);
  }, []);

  const hovered = hover ? showcaseItem(hover) : null;

  return (
    <figure className="relative" aria-label="Interactive composition of posters designed in Senitukang Studio">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
        <div className="label-mono flex items-center gap-2">
          <span className="text-accent">fig. 01</span>
          <span>Composition / 12-col stage</span>
        </div>
        <button
          type="button"
          aria-pressed={grid}
          onClick={() => setGrid((v) => !v)}
          className="label-mono flex h-7 items-center gap-2 rounded-[2px] border border-line px-2.5 transition-colors hover:border-fg hover:text-fg"
        >
          <span className={cx("grid h-2.5 w-2.5 grid-cols-3 gap-px", grid ? "opacity-100" : "opacity-40")} aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={grid ? "bg-accent" : "bg-subtle"} />
            ))}
          </span>
          Grid {grid ? "on" : "off"}
        </button>
      </div>

      {/* Stage */}
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative mt-3 aspect-[4/5] touch-pan-y select-none overflow-hidden [--g:8px] md:aspect-[2/1] md:[--g:16px]"
        style={{ "--px": 0, "--py": 0 } as CSSProperties}
      >
        {/* Column overlay */}
        <div
          aria-hidden
          className={cx("pointer-events-none absolute inset-0 z-0 grid grid-cols-12 gap-(--g) transition-opacity duration-500", grid ? "opacity-100" : "opacity-0")}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={cx("relative border-x border-accent/25 bg-accent/[0.045]", r.inside && r.col === i + 1 && "bg-accent/[0.11]")}>
              <span className="absolute left-1 top-1 font-mono text-[9px] tracking-wider text-accent/80">{String(i + 1).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
        {/* Horizontal module lines (every 12.5%) */}
        <div
          aria-hidden
          className={cx("pointer-events-none absolute inset-0 z-0 transition-opacity duration-500", grid ? "opacity-100" : "opacity-0")}
          style={{ backgroundImage: "linear-gradient(to bottom, color-mix(in srgb, var(--accent) 18%, transparent) 1px, transparent 1px)", backgroundSize: "100% 12.5%" }}
        />

        {/* Posters */}
        {PLACEMENTS.map((p) => {
          const item = showcaseItem(p.id);
          const d = showcaseDoc(p.id);
          return (
            <div
              key={p.id}
              onPointerEnter={() => setHover(p.id)}
              className={cx(
                "absolute left-(--l-m) top-(--t-m) w-(--w-m) md:left-(--l-d) md:top-(--t-d) md:w-(--w-d)",
                "transition-[transform,box-shadow] duration-700 ease-swiss will-change-transform",
                hover === p.id ? "shadow-[0_30px_60px_-24px_rgba(0,0,0,0.55)]" : "shadow-[0_18px_40px_-28px_rgba(0,0,0,0.5)]",
              )}
              style={
                {
                  zIndex: hover === p.id ? 10 : p.z,
                  "--l-m": colLeft(p.m[0]),
                  "--w-m": spanWidth(p.m[1]),
                  "--t-m": `${p.m[2]}%`,
                  "--l-d": colLeft(p.d[0]),
                  "--w-d": spanWidth(p.d[1]),
                  "--t-d": `${p.d[2]}%`,
                  transform: `translate3d(calc(var(--px) * ${-p.depth}px), calc(var(--py) * ${-p.depth}px), 0)`,
                } as CSSProperties
              }
            >
              <DocPreview doc={d} cacheKey={`showcase-${p.id}`} maxSide={720} alt={item.alt} className="w-full" />
              {hover === p.id && <span className="pointer-events-none absolute inset-0 outline outline-1 -outline-offset-1 outline-accent" aria-hidden />}
            </div>
          );
        })}

        {/* Crosshair */}
        <div aria-hidden className={cx("pointer-events-none absolute inset-0 z-20 transition-opacity duration-200", r.inside ? "opacity-100" : "opacity-0")}>
          <span className="absolute inset-x-0 h-px bg-accent/70" style={{ top: "var(--cy, 0)" }} />
          <span className="absolute inset-y-0 w-px bg-accent/70" style={{ left: "var(--cx, 0)" }} />
        </div>
      </div>

      {/* Live readouts */}
      <figcaption className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-subtle tabular-nums sm:grid-cols-4" aria-live="off">
        <span>
          X <span className="text-fg">{pad(r.x)}</span> PX · Y <span className="text-fg">{pad(r.y)}</span> PX
        </span>
        <span>
          Col <span className={r.inside ? "text-accent" : "text-fg"}>{r.inside ? (r.col ? String(r.col).padStart(2, "0") : "GUT") : "--"}</span> / 12
        </span>
        <span className="truncate">
          Obj <span className="text-fg">{hovered ? `${hovered.title}` : "—"}</span>
        </span>
        <span className="truncate sm:text-right">
          {hovered ? hovered.dims : `Stage ${pad(size.w)} × ${pad(size.h)}`}
        </span>
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative">
      <Container>
        {/* Index strip */}
        <div className="grid grid-cols-2 gap-4 border-b border-line py-3 md:grid-cols-12 md:gap-6">
          <span className="label-mono md:col-span-3">
            <span className="text-accent">01</span> — Studio
          </span>
          <span className="label-mono hidden md:col-span-3 md:block">Grid · Type · Image</span>
          <span className="label-mono hidden md:col-span-3 md:block">47.3769° N — 8.5417° E</span>
          <span className="label-mono text-right md:col-span-3">Vol. 01 / 2026</span>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-8 pb-10 pt-10 md:grid-cols-12 md:pb-14 md:pt-16">
          <h1
            id="hero-title"
            className="animate-rise font-display text-[clamp(3.25rem,9.6vw,9.75rem)] font-bold leading-[0.86] tracking-[-0.055em] text-fg md:col-span-9"
          >
            Create your own Senitukang{" "}
            poster<span className="ml-[0.04em] inline-block h-[0.16em] w-[0.16em] translate-y-[-0.02em] bg-accent align-baseline" aria-hidden />
            <span className="sr-only">.</span>
          </h1>
          <div className="flex flex-col justify-end gap-6 md:col-span-3 [animation-delay:120ms] animate-rise">
            <p className="max-w-sm text-[15px] leading-relaxed text-muted">
              A design studio for posters, wallpapers, album art and campaigns. Compose on calculated Swiss grids, start from editable templates, let the
              composition generator propose layouts — and export at print resolution.
            </p>
            <div className="flex flex-wrap gap-3">
              <LinkButton href="/create">
                Start Creating <Arrow />
              </LinkButton>
              <LinkButton href="/templates" variant="secondary">
                Explore Templates
              </LinkButton>
            </div>
          </div>
        </div>

        <div className="animate-rise [animation-delay:200ms]">
          <Stage />
        </div>

        <dl className="mt-10 grid grid-cols-2 border-t border-line md:grid-cols-4">
          {[
            ["09", "Grid systems, computed"],
            ["27", "Typefaces incl. Japanese"],
            ["10K", "Max export side, px"],
            ["05", "Export formats"],
          ].map(([n, l], i) => (
            <div key={l} className={cx("border-line py-5 pr-4", i % 2 === 1 && "border-l pl-4", i >= 2 && "border-t md:border-t-0", i === 2 && "md:border-l md:pl-4")}>
              <dt className="label-mono">{l}</dt>
              <dd className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-fg md:text-5xl">{n}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
