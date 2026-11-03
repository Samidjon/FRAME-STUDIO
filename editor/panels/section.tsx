"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/components/shared/ui";

/** Numbered, collapsible panel section — the editor's core layout primitive. */
export function Section({ index, title, children, defaultOpen = true, action }: { index?: string; title: string; children: ReactNode; defaultOpen?: boolean; action?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <div className="flex h-9 items-center gap-2 px-3">
        <button className="flex flex-1 items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
          {index && <span className="font-mono text-[9px] text-accent">{index}</span>}
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{title}</span>
        </button>
        {action}
        <button aria-label={open ? `Collapse ${title}` : `Expand ${title}`} onClick={() => setOpen(!open)} className="text-subtle hover:text-fg">
          <ChevronDown size={12} className={cx("transition-transform", !open && "-rotate-90")} />
        </button>
      </div>
      {open && <div className="flex flex-col gap-2.5 px-3 pb-3">{children}</div>}
    </section>
  );
}

export function Row({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={cx("grid gap-1.5", cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4")}>{children}</div>;
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] text-muted">{children}</div>;
}
