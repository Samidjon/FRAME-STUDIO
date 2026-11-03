"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/shared/ui";

const QUICK = [
  { label: "Swiss / International", category: "swiss-international-style" },
  { label: "Music / Album Art", category: "music-album-art" },
  { label: "Events", category: "events" },
  { label: "Photography", category: "photography" },
  { label: "Japanese Editorial", category: "japanese-editorial" },
  { label: "Modern Posters", category: "modern-posters" },
];

export function TemplateEntry() {
  return (
    <div className="grid gap-px border border-line bg-line md:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col justify-between gap-10 bg-bg p-8 md:p-10">
        <div>
          <SectionLabel index="B">Templates</SectionLabel>
          <h2 className="mt-4 max-w-lg font-display text-4xl font-semibold leading-[0.95] tracking-[-0.035em]">
            Start from a finished composition and make it yours.
          </h2>
          <p className="mt-4 max-w-md text-sm text-muted">
            Every template is fully editable — grid, type, images and colours. Copies are independent: the original is never changed.
          </p>
        </div>
        <Link href="/templates" className="group inline-flex items-center gap-3 self-start border-b border-fg pb-1 font-display text-lg font-semibold tracking-tight hover:border-accent hover:text-accent">
          Browse templates
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <nav aria-label="Template categories" className="bg-bg">
        <ul>
          {QUICK.map((q, i) => (
            <li key={q.category} className={i ? "border-t border-line" : ""}>
              <Link href={`/templates?category=${q.category}`} className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-sunken">
                <span className="font-mono text-[10px] text-subtle">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-[14px] font-medium">{q.label}</span>
                <ArrowRight size={14} className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
