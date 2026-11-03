"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cx } from "@/components/shared/ui";
import { BlankCanvas } from "./blank-canvas";
import { TemplateEntry } from "./template-entry";
import { GeneratorStudio } from "./generator-studio";

export type CreateMode = "blank" | "template" | "generate";

const MODES: { id: CreateMode; n: string; label: string; hint: string }[] = [
  { id: "blank", n: "A", label: "Blank Canvas", hint: "Any format, empty page" },
  { id: "template", n: "B", label: "Start from Template", hint: "Editable starter compositions" },
  { id: "generate", n: "C", label: "Generate Composition", hint: "Algorithmic layouts from your content" },
];

function parseMode(v: string | null): CreateMode {
  return v === "template" || v === "generate" || v === "blank" ? v : "blank";
}

export function CreateStudio() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode = parseMode(params.get("mode"));

  const setMode = useCallback(
    (m: CreateMode) => {
      const next = new URLSearchParams(params.toString());
      next.set("mode", m);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 md:px-8 md:pt-14">
      <header className="grid gap-6 border-b border-line pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="min-w-0">
          <div className="label-mono mb-3">
            <span className="text-accent">02</span> Create
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[0.9] tracking-[-0.045em] md:text-7xl">
            Begin a<br className="hidden md:block" /> composition
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted">
            Open an empty page in any format, adapt a template, or let the generator build a series of grid-based layouts from your image, text and colours.
          </p>
        </div>
      </header>

      <div role="tablist" aria-label="How to start" className="mt-6 grid grid-cols-1 border border-line sm:grid-cols-3">
        {MODES.map((m, i) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              role="tab"
              id={`create-tab-${m.id}`}
              aria-selected={active}
              aria-controls={`create-panel-${m.id}`}
              onClick={() => setMode(m.id)}
              className={cx(
                "group flex items-start gap-3 px-4 py-4 text-left transition-colors",
                i > 0 && "border-t border-line sm:border-l sm:border-t-0",
                active ? "bg-fg text-bg" : "hover:bg-sunken",
              )}
            >
              <span className={cx("font-mono text-[10px] tracking-[0.08em]", active ? "text-accent" : "text-subtle")}>{m.n}</span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-semibold tracking-tight">{m.label}</span>
                <span className={cx("mt-0.5 block text-[12px]", active ? "text-bg/70" : "text-muted")}>{m.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section id={`create-panel-${mode}`} role="tabpanel" aria-labelledby={`create-tab-${mode}`} className="mt-10">
        {mode === "blank" && <BlankCanvas />}
        {mode === "template" && <TemplateEntry />}
        {mode === "generate" && <GeneratorStudio />}
      </section>
    </div>
  );
}
