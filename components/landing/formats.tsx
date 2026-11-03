"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { DocPreview } from "@/components/shared/doc-preview";
import { Container, SectionHead } from "./primitives";
import { showcaseDoc, showcaseItem } from "./showcase-docs";

const FORMATS = [
  { n: "01", name: "Posters", w: 3508, h: 4961, unit: "A3 · 300 dpi", doc: "swiss" },
  { n: "02", name: "Social posts", w: 1080, h: 1350, unit: "Portrait 4:5", doc: "fold" },
  { n: "03", name: "Album covers", w: 3000, h: 3000, unit: "Square 1:1", doc: "album" },
  { n: "04", name: "Desktop wallpapers", w: 3840, h: 2160, unit: "4K UHD 16:9", doc: "ridges" },
  { n: "05", name: "Phone wallpapers", w: 1179, h: 2556, unit: "Smartphone", doc: "neon" },
  { n: "06", name: "Campaigns", w: 1080, h: 1920, unit: "Story 9:16", doc: "bloom" },
  { n: "07", name: "Typographic studies", w: 1080, h: 1080, unit: "Square 1:1", doc: "type" },
];

/** Technical-drawing style dimension line with end ticks. */
function DimH({ value }: { value: number }) {
  return (
    <div className="relative mb-2 flex h-3 items-center" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
      <span className="absolute left-0 top-0 h-full w-px bg-line-strong" />
      <span className="absolute right-0 top-0 h-full w-px bg-line-strong" />
      <span className="relative mx-auto bg-bg px-1.5 font-mono text-[9px] tracking-wider text-muted tabular-nums">{value}</span>
    </div>
  );
}

function DimV({ value }: { value: number }) {
  return (
    <div className="relative ml-2 flex w-3 shrink-0 items-center justify-center" aria-hidden>
      <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
      <span className="absolute left-0 top-0 h-px w-full bg-line-strong" />
      <span className="absolute bottom-0 left-0 h-px w-full bg-line-strong" />
      <span className="relative whitespace-nowrap bg-bg py-1.5 font-mono text-[9px] tracking-wider text-muted tabular-nums [writing-mode:vertical-rl]">{value}</span>
    </div>
  );
}

export function Formats() {
  return (
    <section aria-labelledby="formats-title" className="bg-raised py-20 md:py-28">
      <Container>
        <SectionHead
          id="formats-title"
          index="03"
          label="Formats"
          title={<>What you can create.</>}
          aside={<>Real output sizes, not approximations. Frames below share one height so you can compare proportion; the numbers are the export pixels.</>}
        />

        <ul className="mt-14 grid grid-cols-2 items-end gap-x-6 gap-y-12 sm:grid-cols-3 lg:flex lg:items-end lg:gap-x-8">
          {FORMATS.map((f) => {
            const ratio = f.w / f.h;
            const d = showcaseDoc(f.doc);
            return (
              <li key={f.n} className="min-w-0 lg:basis-0" style={{ flexGrow: ratio, "--fw": `min(100%, ${(ratio * 11).toFixed(3)}rem)` } as CSSProperties}>
                <Link href={`/create?w=${f.w}&h=${f.h}`} className="group block" aria-label={`Create a ${f.name.toLowerCase()} design, ${f.w} by ${f.h} pixels`}>
                  <div className="w-(--fw) lg:w-full">
                    <div className="mr-5">
                      <DimH value={f.w} />
                    </div>
                    <div className="flex">
                      <DocPreview
                        doc={d}
                        cacheKey={`showcase-${f.doc}`}
                        maxSide={520}
                        alt={showcaseItem(f.doc).alt}
                        className="min-w-0 flex-1 outline outline-1 outline-line transition-transform duration-500 ease-swiss group-hover:-translate-y-1"
                      />
                      <DimV value={f.h} />
                    </div>
                  </div>
                  <div className="mt-4 border-t border-line pt-3 pr-5">
                    <div className="label-mono">
                      <span className="text-accent">{f.n}</span> — {f.unit}
                    </div>
                    <div className="mt-1 font-display text-[15px] font-semibold leading-tight tracking-[-0.02em] text-fg group-hover:text-accent">{f.name}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
