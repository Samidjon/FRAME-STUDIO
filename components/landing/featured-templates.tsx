"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TEMPLATES, type Template } from "@/core/templates";
import { DocPreview } from "@/components/shared/doc-preview";
import type { DesignDocument } from "@/types/project";
import { Arrow, Container, SectionHead } from "./primitives";

type TemplateLike = Template;

/** Featured order, but one per category first so the selection shows range. */
function pickFeatured(all: Template[], n: number): Template[] {
  const seen = new Set<string>();
  const first: Template[] = [];
  const rest: Template[] = [];
  for (const t of all) {
    if (!seen.has(t.category)) {
      seen.add(t.category);
      first.push(t);
    } else rest.push(t);
  }
  return [...first, ...rest].slice(0, n);
}

/** Frame ratio 4:5 — documents taller than that fit by height, others by width. */
function fitClass(d: DesignDocument) {
  return d.height / d.width > 1.25 ? "h-full w-auto" : "w-full h-auto";
}

function TemplateCard({ t, i }: { t: TemplateLike; i: number }) {
  const doc = useMemo(() => {
    try {
      return t.build();
    } catch {
      return null;
    }
  }, [t]);
  const href = `/templates?category=${encodeURIComponent(t.category)}`;
  return (
    <li className="group">
      <Link href={href} className="block focus-visible:outline-offset-4" aria-label={`${t.name} — ${t.category} template`}>
        <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-sunken p-5 transition-colors duration-300 group-hover:bg-lavender/60 md:p-7">
          {doc && <DocPreview doc={doc} cacheKey={`tpl-${t.id}`} maxSide={640} alt={`${t.name} template preview`} className={`${fitClass(doc)} max-h-full max-w-full shadow-[0_14px_30px_-20px_rgba(0,0,0,0.55)] transition-transform duration-500 ease-swiss group-hover:-translate-y-1`} />}
          <span className="label-mono absolute left-3 top-3">T—{String(i + 1).padStart(2, "0")}</span>
          <span className="label-mono absolute bottom-3 right-3 tabular-nums">
            {t.width} × {t.height}
          </span>
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <div className="label-mono truncate">{t.category}</div>
          <h3 className="mt-1 truncate font-display text-[17px] font-semibold tracking-[-0.02em] text-fg group-hover:text-accent">{t.name}</h3>
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{t.description}</p>
      </Link>
    </li>
  );
}

export function FeaturedTemplates() {
  const list = pickFeatured(TEMPLATES, 8);
  const categories = Array.from(new Set(list.map((t) => t.category)));
  return (
    <section aria-labelledby="templates-title" className="py-20 md:py-28">
      <Container>
        <SectionHead
          id="templates-title"
          index="02"
          label="Templates"
          title={<>Editable starting points, built on the grid.</>}
          aside={<>Every template is a layered document — type, image, shapes and texture — not a flat picture. Change anything; the grid holds it together.</>}
        />
        {categories.length > 0 && (
          <nav aria-label="Template categories" className="mt-10 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c}
                href={`/templates?category=${encodeURIComponent(c)}`}
                className="label-mono rounded-[2px] border border-line px-2.5 py-1.5 transition-colors hover:border-fg hover:text-fg"
              >
                {c}
              </Link>
            ))}
          </nav>
        )}
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
          {list.map((t, i) => (
            <TemplateCard key={t.id} t={t} i={i} />
          ))}
        </ul>
        <div className="mt-12 flex justify-end border-t border-line pt-4">
          <Link href="/templates" className="group inline-flex items-center gap-2 font-display text-lg font-medium tracking-[-0.02em] text-fg hover:text-accent">
            View all templates <Arrow className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
