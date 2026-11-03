"use client";

import { useMemo, useState } from "react";
import { DocPreview } from "@/components/shared/doc-preview";
import { cx } from "@/components/shared/ui";
import { Arrow, Container, LinkButton, SectionHead } from "./primitives";
import { PALETTES, VARIANT_NAMES, generatorDoc } from "./showcase-docs";

const SEEDS = ["3F2A", "91C0", "0B7E", "C4D1", "57A9", "E208"];

export function GeneratorTeaser() {
  const [p, setP] = useState(0);
  const pal = PALETTES[p];
  const docs = useMemo(() => VARIANT_NAMES.map((_, i) => generatorDoc(i, pal)), [pal]);

  return (
    <section aria-labelledby="generator-title" className="py-20 md:py-28">
      <Container>
        <SectionHead
          id="generator-title"
          index="06"
          label="Composition generator"
          title={<>One brief. Six layouts. Zero templates.</>}
          aside={<>The generator solves position, scale and hierarchy on a computed grid. Same title, same image — different visual arguments. Keep the ones that speak.</>}
        />

        <div className="mt-10 grid grid-cols-1 gap-4 border-y border-line py-4 md:grid-cols-12 md:items-center md:gap-6">
          <dl className="grid grid-cols-3 gap-4 md:col-span-6">
            {[
              ["Input", "“Horizon” + image"],
              ["Grid", "6 × 8 modular"],
              ["Palette", pal.name],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="label-mono">{k}</dt>
                <dd className="mt-1 truncate text-[13px] text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center gap-2 md:col-span-6 md:justify-end" role="radiogroup" aria-label="Palette">
            {PALETTES.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={i === p}
                aria-label={x.name}
                onClick={() => setP(i)}
                className={cx("flex h-8 w-10 overflow-hidden md:w-14 rounded-[2px] border transition-colors", i === p ? "border-fg" : "border-line hover:border-line-strong")}
              >
                <span className="flex-1" style={{ background: x.bg }} />
                <span className="flex-1" style={{ background: x.ink }} />
                <span className="w-3" style={{ background: x.accent }} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setP((v) => (v + 1) % PALETTES.length)}
              className="label-mono ml-2 flex h-8 items-center gap-2 rounded-[2px] border border-line px-3 hover:border-fg hover:text-fg"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                <path d="M2 5h9l-3-3M14 11H5l3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Shuffle
            </button>
          </div>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-6">
          {docs.map((d, i) => (
            <li key={i} className="group animate-fade">
              <DocPreview
                doc={d}
                cacheKey={`gen-${i}-${pal.id}`}
                maxSide={560}
                alt={`Generated layout ${i + 1}: ${VARIANT_NAMES[i]} — ${pal.name}`}
                className="w-full outline outline-1 outline-line transition-transform duration-500 ease-swiss group-hover:-translate-y-1"
              />
              <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-line pt-2">
                <span className="label-mono">
                  <span className="text-accent">V{String(i + 1).padStart(2, "0")}</span> {VARIANT_NAMES[i]}
                </span>
              </div>
              <div className="label-mono mt-1 !text-[9px]">seed 0x{SEEDS[i]}</div>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-line pt-6 md:flex-row md:items-center">
          <p className="max-w-xl text-sm text-muted">Pick a format, drop in your words and images, and generate. Every result opens as a fully layered, editable document.</p>
          <LinkButton href="/create?mode=generate">
            Open the generator <Arrow />
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}
