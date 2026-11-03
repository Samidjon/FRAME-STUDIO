"use client";

import Link from "next/link";
import { DocPreview } from "@/components/shared/doc-preview";
import { Arrow, Container, SectionHead } from "./primitives";
import { SHOWCASE, showcaseDoc } from "./showcase-docs";

const ORDER = ["dune", "type", "brutal", "ridges", "album", "event", "neon", "fold", "swiss", "bloom"];

export function Inspiration() {
  const items = ORDER.map((id) => SHOWCASE.find((s) => s.id === id)!).filter(Boolean);
  return (
    <section aria-labelledby="examples-title" className="bg-raised py-20 md:py-28">
      <Container>
        <SectionHead
          id="examples-title"
          index="07"
          label="Examples & inspiration"
          title={<>Made in the studio. Rendered live, right here.</>}
          aside={<>Nothing on this page is a screenshot. Each piece is a layered document drawn in your browser by the same renderer you export with.</>}
        />

        <div className="mt-14 columns-1 gap-6 sm:columns-2 lg:columns-3">
          <div className="mb-12 break-inside-avoid border-t-2 border-fg pt-4">
            <p className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-[1.02] tracking-[-0.035em] text-fg">
              “Restraint is a decision you make once — the grid makes it again for you on every page.”
            </p>
            <p className="label-mono mt-4">— Studio notes, Nº 04</p>
          </div>
          {items.map((s, i) => (
            <figure key={s.id} className="group mb-12 break-inside-avoid">
              <DocPreview doc={showcaseDoc(s.id)} cacheKey={`showcase-${s.id}`} maxSide={900} alt={s.alt} className="w-full outline outline-1 outline-line" />
              <figcaption className="mt-3 border-t border-line pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg font-semibold tracking-[-0.02em] text-fg">{s.title}</span>
                  <span className="font-mono text-[10px] text-accent">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <dl className="mt-2 grid grid-cols-[72px_1fr] gap-x-3 gap-y-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-subtle">
                  <dt>Type</dt>
                  <dd className="text-muted">{s.kind}</dd>
                  <dt>Format</dt>
                  <dd className="text-muted tabular-nums">
                    {s.format} · {s.dims}
                  </dd>
                  <dt>Grid</dt>
                  <dd className="text-muted">{s.grid}</dd>
                  <dt>Fonts</dt>
                  <dd className="text-muted">{s.fonts}</dd>
                </dl>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="flex justify-end border-t border-line pt-4">
          <Link href="/explore" className="group inline-flex items-center gap-2 font-display text-lg font-medium tracking-[-0.02em] text-fg hover:text-accent">
            Explore the community <Arrow className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
