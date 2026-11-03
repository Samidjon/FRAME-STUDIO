import type { ReactNode } from "react";
import { Container, SectionHead } from "./primitives";

/*
 * Mini-graphics share one 240 × 120 viewBox and a 1px stroke so they read as
 * a set. Colour comes from tokens (currentColor / accent) — both themes work.
 */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const };

function Canvas() {
  return (
    <g>
      <rect x="40" y="18" width="160" height="84" {...S} className="text-line-strong" strokeDasharray="2 3" />
      <g className="transition-transform duration-500 ease-swiss group-hover:translate-x-[10px] group-hover:-translate-y-[4px]">
        <rect x="78" y="34" width="70" height="50" className="fill-accent" />
        <rect x="78" y="34" width="70" height="50" {...S} />
        {[
          [78, 34],
          [148, 34],
          [78, 84],
          [148, 84],
          [113, 34],
          [113, 84],
          [78, 59],
          [148, 59],
        ].map(([x, y], i) => (
          <rect key={i} x={x - 2.5} y={y - 2.5} width="5" height="5" className="fill-bg" stroke="currentColor" strokeWidth="1" />
        ))}
        <line x1="113" y1="34" x2="113" y2="22" {...S} />
        <circle cx="113" cy="20" r="2.5" className="fill-bg" stroke="currentColor" />
      </g>
      <text x="40" y="114" className="fill-current font-mono text-[7px] opacity-60">
        X 078 Y 034 W 070 H 050
      </text>
    </g>
  );
}

function Typography() {
  return (
    <g>
      <line x1="16" x2="224" y1="86" y2="86" className="stroke-accent" strokeWidth="1" />
      <line x1="16" x2="224" y1="60" y2="60" {...S} className="text-line-strong" />
      <line x1="16" x2="224" y1="30" y2="30" {...S} className="text-line-strong" />
      <text x="20" y="86" className="fill-current font-display text-[72px] font-bold" letterSpacing="-3">
        Ag
      </text>
      {[34, 26, 19, 14, 10].map((s, i) => (
        <rect key={s} x="140" y={24 + i * 13} width={s * 2.2} height="6" className={i === 0 ? "fill-current" : "fill-current opacity-40"} />
      ))}
      <text x="140" y="112" className="fill-current font-mono text-[7px] opacity-60">
        SCALE 1.250 · BL 8
      </text>
    </g>
  );
}

function Effects() {
  const dots: ReactNode[] = [];
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 6; c++) {
      const t = (c + r) / 10;
      dots.push(<circle key={`${r}-${c}`} cx={170 + c * 9} cy={36 + r * 9} r={0.6 + t * 3.4} className="fill-current" />);
    }
  const grain: ReactNode[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) grain.push(<rect key={i} x={92 + rnd() * 54} y={32 + rnd() * 54} width="1.2" height="1.2" className="fill-current" opacity={0.25 + rnd() * 0.6} />);
  return (
    <g>
      <defs>
        <linearGradient id="fs-duo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#171717" />
          <stop offset="1" stopColor="#FF4D00" />
        </linearGradient>
      </defs>
      <rect x="16" y="32" width="54" height="54" fill="url(#fs-duo)" />
      <rect x="92" y="32" width="54" height="54" {...S} className="text-line-strong" />
      {grain}
      <rect x="166" y="32" width="54" height="54" {...S} className="text-line-strong" />
      {dots}
      {["Duotone", "Grain", "Halftone"].map((l, i) => (
        <text key={l} x={16 + i * 76} y="104" className="fill-current font-mono text-[7px] uppercase opacity-60">
          {l}
        </text>
      ))}
    </g>
  );
}

function Shapes() {
  const star = Array.from({ length: 10 })
    .map((_, i) => {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 ? 11 : 26;
      return `${(186 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");
  return (
    <g>
      <circle cx="50" cy="60" r="28" className="fill-accent" />
      <polygon points="96,88 124,32 152,88" {...S} />
      {[
        [96, 88],
        [124, 32],
        [152, 88],
      ].map(([x, y]) => (
        <rect key={`${x}${y}`} x={x - 2.5} y={y - 2.5} width="5" height="5" className="fill-bg" stroke="currentColor" />
      ))}
      <polygon points={star} className="fill-current" />
      <path d="M96 88 C 110 110, 140 110, 152 88" {...S} strokeDasharray="2 2" className="text-line-strong" />
    </g>
  );
}

function Layers() {
  const lift = ["", "group-hover:-translate-y-[3px]", "group-hover:-translate-y-[6px]", "group-hover:-translate-y-[9px]"];
  return (
    <g>
      {[0, 1, 2, 3].map((i) => {
        const y = 82 - i * 16;
        const active = i === 2;
        return (
          <polygon
            key={i}
            points={`50,${y} 110,${y - 18} 170,${y} 110,${y + 18}`}
            className={`${active ? "fill-accent" : "fill-bg"} transition-transform duration-500 ease-swiss ${lift[i]}`}
            stroke="currentColor"
            strokeWidth="1"
          />
        );
      })}
      {["Texture", "Title", "Image", "Bg"].map((l, i) => (
        <text key={l} x="184" y={38 + i * 16} className={i === 1 ? "fill-accent font-mono text-[7px] uppercase" : "fill-current font-mono text-[7px] uppercase opacity-60"}>
          {String(4 - i).padStart(2, "0")} {l}
        </text>
      ))}
    </g>
  );
}

function Blend() {
  return (
    <g>
      <circle cx="98" cy="58" r="34" className="fill-accent" />
      <circle cx="142" cy="58" r="34" className="fill-lavender" style={{ mixBlendMode: "multiply" }} />
      <circle cx="120" cy="58" r="34" {...S} strokeDasharray="2 3" className="text-line-strong" />
      <text x="16" y="112" className="fill-current font-mono text-[7px] uppercase opacity-60">
        Multiply · Screen · Overlay · Difference
      </text>
    </g>
  );
}

function Export() {
  const f = ["PNG", "JPG", "WEBP", "SVG", "PDF"];
  return (
    <g>
      <rect x="16" y="30" width="44" height="56" className="fill-accent" />
      <path d="M66 58h22M82 52l6 6-6 6" {...S} />
      {f.map((l, i) => (
        <g key={l}>
          <rect x={98 + i * 26} y="46" width="22" height="26" {...S} />
          <text x={109 + i * 26} y="63" textAnchor="middle" className="fill-current font-mono text-[6px]">
            {l}
          </text>
        </g>
      ))}
      <text x="98" y="104" className="fill-current font-mono text-[7px] uppercase opacity-60">
        Up to 10 000 px · 300 dpi
      </text>
    </g>
  );
}

function Resize() {
  // same composition (block + bar) re-flowed into three formats
  const frames = [
    { x: 16, y: 34, w: 52, h: 52 },
    { x: 86, y: 18, w: 46, h: 82 },
    { x: 150, y: 40, w: 74, h: 42 },
  ];
  return (
    <g>
      {frames.map((f, i) => (
        <g key={i}>
          <rect x={f.x} y={f.y} width={f.w} height={f.h} {...S} />
          <rect x={f.x + 5} y={f.y + 5} width={f.w > f.h ? f.w * 0.45 : f.w - 10} height={f.w > f.h ? f.h - 10 : f.h * 0.5} className="fill-accent" />
          <rect
            x={f.w > f.h ? f.x + f.w * 0.45 + 10 : f.x + 5}
            y={f.w > f.h ? f.y + f.h - 12 : f.y + f.h - 12}
            width={f.w > f.h ? f.w * 0.4 : f.w * 0.6}
            height="5"
            className="fill-current"
          />
        </g>
      ))}
      <text x="16" y="112" className="fill-current font-mono text-[7px] uppercase opacity-60">
        1:1 → 9:16 → 16:9
      </text>
    </g>
  );
}

const TOOLS: { n: string; title: string; body: string; art: ReactNode }[] = [
  { n: "01", title: "Canvas editor", body: "Precise transforms, snapping to grid tracks, rotation and multi-select — numeric to the pixel.", art: <Canvas /> },
  { n: "02", title: "Typography system", body: "Role-based scale, tracking in 1/1000 em, baseline grids, vertical CJK setting and 27 curated families.", art: <Typography /> },
  { n: "03", title: "Image effects", body: "Duotone, grain, halftone, blur, overlay and masks — processed non-destructively per layer.", art: <Effects /> },
  { n: "04", title: "Vector shapes", body: "Rectangles, circles, polygons, stars and SVG paths with stroke, dash and corner radius.", art: <Shapes /> },
  { n: "05", title: "Layers", body: "Order, group, lock and hide. Every element stays editable from first sketch to export.", art: <Layers /> },
  { n: "06", title: "Textures & blend modes", body: "Paper, film grain, scanlines and sixteen blend modes for print-like surfaces.", art: <Blend /> },
  { n: "07", title: "Export", body: "PNG, JPG, WebP, SVG and PDF at up to 10 000 px — print-ready, transparent where you need it.", art: <Export /> },
  { n: "08", title: "Smart resize", body: "Re-flow one composition into new formats; positions are re-solved on the target grid.", art: <Resize /> },
];

export function Tools() {
  return (
    <section aria-labelledby="tools-title" className="py-20 md:py-28">
      <Container>
        <SectionHead
          id="tools-title"
          index="04"
          label="Creative tools"
          title={<>A complete instrument, not a toy.</>}
          aside={<>Eight tool families in one canvas. Everything is vector or parametric until the moment you export.</>}
        />
        <ol className="mt-14 grid grid-cols-1 border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((t) => (
            <li key={t.n} className="group flex flex-col border-b border-r border-line p-5 transition-colors duration-300 hover:bg-raised md:p-6">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] text-accent">{t.n}</span>
                <span className="label-mono">Tool</span>
              </div>
              <svg viewBox="0 0 240 120" className="my-6 h-auto w-full text-fg" role="img" aria-label={`${t.title} illustration`}>
                {t.art}
              </svg>
              <h3 className="font-display text-xl font-semibold tracking-[-0.025em] text-fg">{t.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
