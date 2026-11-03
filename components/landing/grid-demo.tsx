"use client";

import { useMemo, useState } from "react";
import { computeGrid, spanRect, type GridGeometry } from "@/core/geometry/grid";
import { defaultGrid } from "@/core/document/factory";
import { Segmented, Slider } from "@/components/shared/ui";
import type { GridSettings, GridType, Rect } from "@/types/canvas";
import { Arrow, Container, LinkButton, SectionHead } from "./primitives";

const PW = 1080;
const PH = 1350;

type DemoType = Extract<GridType, "column" | "modular" | "golden" | "fibonacci" | "thirds">;
const TYPES: { value: DemoType; label: string; title: string }[] = [
  { value: "column", label: "Column", title: "Column grid" },
  { value: "modular", label: "Modular", title: "Modular grid" },
  { value: "golden", label: "Golden", title: "Golden section" },
  { value: "fibonacci", label: "Fibon.", title: "Fibonacci spiral" },
  { value: "thirds", label: "Thirds", title: "Rule of thirds" },
];

const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** Sample content placed on the computed geometry — it re-flows with the grid. */
function layout(geo: GridGeometry, type: DemoType) {
  const { content, columns, rows } = geo;
  if (type === "fibonacci" && geo.rects.length >= 3) {
    const [a, b, c] = geo.rects;
    return { image: a, title: { x: b.x + 24, y: b.y + 24, width: b.width - 48, height: Math.min(64, b.height / 4) } as Rect, body: c };
  }
  const nc = columns.length;
  const nr = rows.length;
  let image: Rect;
  let below: number;
  if (nr >= 2) {
    const r1 = Math.max(0, Math.round(nr * 0.55) - 1);
    image = spanRect(geo, 0, nc - 1, 0, r1);
    below = r1 + 1 < nr ? rows[r1 + 1].start : image.y + image.height + 24;
  } else {
    image = { ...content, height: content.height * 0.56 };
    below = image.y + image.height + 32;
  }
  const tEnd = Math.max(0, Math.ceil(nc * 0.66) - 1);
  const tr = spanRect(geo, 0, tEnd, 0, 0);
  const title: Rect = { x: tr.x, y: below, width: tr.width, height: 64 };
  const last = columns[nc - 1];
  const body: Rect = nc > 1 ? { x: last.start, y: below, width: last.size, height: content.y + content.height - below } : { x: content.x, y: below + 160, width: content.width, height: content.y + content.height - below - 160 };
  return { image, title, body };
}

function arcPath(a: GridGeometry["arcs"][number]) {
  const p = (deg: number) => [a.cx + a.r * Math.cos((deg * Math.PI) / 180), a.cy + a.r * Math.sin((deg * Math.PI) / 180)];
  const [x0, y0] = p(a.start);
  const [x1, y1] = p(a.end);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${a.r.toFixed(2)} ${a.r.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function GridDemo() {
  const [type, setType] = useState<DemoType>("modular");
  const [columns, setColumns] = useState(6);
  const [rows, setRows] = useState(8);
  const [gutter, setGutter] = useState(24);
  const [margin, setMargin] = useState(72);

  const settings: GridSettings = useMemo(
    () => ({ ...defaultGrid(PW, PH), type, columns, rows, gutter, margins: { top: margin, right: margin, bottom: margin, left: margin } }),
    [type, columns, rows, gutter, margin],
  );
  const geo = useMemo(() => computeGrid(PW, PH, settings), [settings]);
  const { image, title, body } = useMemo(() => layout(geo, type), [geo, type]);

  const usesTracks = type === "column" || type === "modular";
  const lineCount = Math.max(0, Math.floor((body.height - 8) / 22));

  const stats: [string, string][] = [
    ["Live area", `${f1(geo.content.width)} × ${f1(geo.content.height)}`],
    ["Column", geo.columns.length > 1 ? `${f1(geo.columns[0].size)} px` : "—"],
    ["Row", geo.rows.length > 1 ? `${f1(geo.rows[0].size)} px` : "—"],
    ["Modules", type === "fibonacci" ? `${geo.rects.length} squares` : String(geo.modules.length)],
    ["Snap X / Y", `${geo.snapX.length} / ${geo.snapY.length}`],
    ["Ratio", type === "golden" || type === "fibonacci" ? "1 : 1.618" : type === "thirds" ? "1 : 1 : 1" : `${columns} × ${type === "modular" ? rows : 1}`],
  ];

  return (
    <section aria-labelledby="grid-title" className="bg-ink py-20 text-paper md:py-28 [--fg:var(--paper)] [--fg-muted:#b3afa6] [--fg-subtle:#7d7a74] [--line:rgba(240,237,229,0.12)] [--line-strong:rgba(240,237,229,0.26)] [--bg:#171717]">
      <Container>
        <SectionHead
          id="grid-title"
          index="05"
          label="Grid system"
          title={
            <>
              Geometry is calculated, <span className="text-accent">not drawn.</span>
            </>
          }
          aside={<>The same engine that powers the editor runs below. Change the system — the tracks, modules, snap points and the sample layout are re-solved instantly.</>}
        />

        <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
          {/* Controls */}
          <div className="flex flex-col gap-6 md:col-span-4 lg:col-span-3">
            <div>
              <div className="label-mono mb-2">A — System</div>
              <Segmented value={type} onChange={setType} options={TYPES} />
            </div>
            <fieldset className="flex flex-col gap-4">
              <legend className="label-mono mb-2">B — Parameters</legend>
              <div className={usesTracks ? "" : "pointer-events-none opacity-35"} aria-disabled={!usesTracks}>
                <Slider label="Columns" value={columns} min={1} max={12} onChange={setColumns} />
              </div>
              <div className={type === "modular" ? "" : "pointer-events-none opacity-35"} aria-disabled={type !== "modular"}>
                <Slider label="Rows" value={rows} min={1} max={12} onChange={setRows} />
              </div>
              <div className={usesTracks ? "" : "pointer-events-none opacity-35"} aria-disabled={!usesTracks}>
                <Slider label="Gutter" value={gutter} min={0} max={80} step={2} onChange={setGutter} format={(v) => `${v} px`} />
              </div>
              <Slider label="Margin" value={margin} min={0} max={160} step={4} onChange={setMargin} format={(v) => `${v} px`} />
            </fieldset>
            <div>
              <div className="label-mono mb-2">C — Output</div>
              <dl className="border-t border-line">
                {stats.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between border-b border-line py-2">
                    <dt className="text-[12px] text-muted">{k}</dt>
                    <dd className="font-mono text-[11px] tabular-nums text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <LinkButton href="/create" variant="primary" size="md" className="self-start">
              Design on this grid <Arrow />
            </LinkButton>
          </div>

          {/* Page */}
          <div className="md:col-span-8 lg:col-span-6 lg:col-start-5">
            <div className="label-mono mb-2 flex justify-between">
              <span>Page 1080 × 1350 px</span>
              <span>{TYPES.find((t) => t.value === type)?.title}</span>
            </div>
            <svg viewBox={`-40 -40 ${PW + 80} ${PH + 80}`} className="block h-auto w-full" role="img" aria-label={`${type} grid computed on a 1080 by 1350 page`}>
              <rect x="0" y="0" width={PW} height={PH} fill="#F0EDE5" />
              {/* sample content */}
              <g className="transition-all">
                <rect x={image.x} y={image.y} width={image.width} height={image.height} fill="#292929" />
                <circle cx={image.x + image.width * 0.68} cy={image.y + image.height * 0.42} r={Math.min(image.width, image.height) * 0.18} fill="#FF4D00" />
                <rect x={title.x} y={title.y} width={title.width} height={title.height * 0.62} fill="#171717" />
                {Array.from({ length: Math.min(lineCount, 30) }).map((_, i) => (
                  <rect key={i} x={body.x} y={body.y + 8 + i * 22} width={body.width * (i % 5 === 4 ? 0.55 : 1)} height="8" fill="#888888" />
                ))}
              </g>
              {/* grid geometry */}
              <g fill="none" stroke="#FF4D00" strokeWidth="1" vectorEffect="non-scaling-stroke">
                <rect x={geo.content.x} y={geo.content.y} width={geo.content.width} height={geo.content.height} strokeOpacity="0.9" vectorEffect="non-scaling-stroke" />
                {type !== "fibonacci" &&
                  geo.modules.map((m, i) => (
                    <rect key={i} x={m.x} y={m.y} width={m.width} height={m.height} fill="#FF4D00" fillOpacity="0.07" strokeOpacity="0.55" vectorEffect="non-scaling-stroke" />
                  ))}
                {geo.lines.map((l, i) =>
                  l.axis === "x" ? (
                    <line key={i} x1={l.position} x2={l.position} y1={0} y2={PH} strokeOpacity="0.9" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
                  ) : (
                    <line key={i} y1={l.position} y2={l.position} x1={0} x2={PW} strokeOpacity="0.9" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
                  ),
                )}
                {geo.rects.map((r, i) => (
                  <rect key={`r${i}`} x={r.x} y={r.y} width={r.width} height={r.height} strokeOpacity="0.7" vectorEffect="non-scaling-stroke" />
                ))}
                {geo.arcs.map((a, i) => (
                  <path key={`a${i}`} d={arcPath(a)} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                ))}
              </g>
              {/* column numbers + measures in the top margin band */}
              {usesTracks &&
                geo.columns.map((c, i) => (
                  <text key={i} x={c.start + 4} y={-14} className="font-mono" fontSize="16" fill="#FF4D00">
                    {String(i + 1).padStart(2, "0")}
                  </text>
                ))}
              <text x={0} y={PH + 30} className="font-mono" fontSize="16" fill="currentColor" opacity="0.55">
                M {margin} · G {usesTracks ? gutter : 0} · {geo.snapX.length + geo.snapY.length} snap lines
              </text>
            </svg>
          </div>

          <div className="hidden lg:col-span-3 lg:block">
            <div className="label-mono mb-2">D — Note</div>
            <p className="text-sm leading-relaxed text-muted">
              Columns are split as <span className="font-mono text-[12px] text-fg">(live − gutter × (n − 1)) / n</span>. Golden sections cut at 1/φ; the
              Fibonacci construction subdivides the live area into squares and inscribes quarter arcs. Objects snap to every track edge.
            </p>
            <ol className="mt-6 space-y-2 border-t border-line pt-4 font-mono text-[11px] text-muted">
              {geo.snapX.slice(0, 10).map((x, i) => (
                <li key={i} className="flex justify-between tabular-nums">
                  <span className="text-subtle">X{String(i).padStart(2, "0")}</span>
                  <span>{x.toFixed(2)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}
