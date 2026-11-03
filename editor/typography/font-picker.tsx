"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { allFonts, loadFont, subscribeFonts, type FontCategory } from "@/lib/fonts/catalog";
import { cx } from "@/components/shared/ui";

const previewLoaded = new Set<string>();

/** Load just the glyphs needed to preview a family's name (Google `text=` subsetting). */
function loadPreview(family: string, google: string | null, sample: string) {
  if (!google || previewLoaded.has(family)) return;
  previewLoaded.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${google.replace(/ /g, "+")}&text=${encodeURIComponent(sample)}&display=swap`;
  document.head.appendChild(link);
}

let fontsTick = 0;
const subscribe = (cb: () => void) => {
  const un = subscribeFonts(() => {
    fontsTick++;
    cb();
  });
  return () => {
    un();
  };
};

export function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<FontCategory | "All">("All");
  const ref = useRef<HTMLDivElement>(null);
  useSyncExternalStore(subscribe, () => fontsTick, () => 0);
  const fonts = allFonts();
  const cats = useMemo(() => ["All", ...new Set(fonts.map((f) => f.category))] as (FontCategory | "All")[], [fonts]);
  const list = fonts.filter((f) => (cat === "All" || f.category === cat) && f.family.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    list.forEach((f) => loadPreview(f.family, f.google, f.sample ?? f.family));
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open, list]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Font family: ${value}`}
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full items-center justify-between rounded-[2px] border border-line px-2 text-left text-[13px] hover:border-line-strong"
        style={{ fontFamily: `"${value}", Inter, sans-serif` }}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={12} className="shrink-0 text-subtle" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-9 z-50 border border-line-strong bg-bg shadow-[0_18px_50px_-18px_rgba(0,0,0,0.5)] animate-fade">
          <div className="flex items-center gap-2 border-b border-line px-2">
            <Search size={12} className="text-subtle" />
            <input
              autoFocus
              aria-label="Search fonts"
              placeholder="Search typefaces"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              className="h-8 w-full bg-transparent text-[12px] outline-none"
            />
          </div>
          <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cx("shrink-0 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider", cat === c ? "bg-fg text-bg" : "text-subtle hover:text-fg")}>
                {c}
              </button>
            ))}
          </div>
          <ul role="listbox" aria-label="Fonts" className="scroll-thin max-h-72 overflow-auto py-1">
            {list.map((f) => (
              <li key={f.family}>
                <button
                  role="option"
                  aria-selected={f.family === value}
                  onMouseEnter={() => void loadFont(f.family)}
                  onClick={() => {
                    onChange(f.family);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-sunken focus:bg-sunken focus:outline-none"
                >
                  <span className="truncate text-[17px] leading-tight" style={{ fontFamily: `"${f.family}", Inter, sans-serif` }}>
                    {f.sample ?? f.family}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="font-mono text-[9px] text-subtle">{f.weights.length > 1 ? `${f.weights.length}w` : f.category}</span>
                    {f.family === value && <Check size={12} className="text-accent" />}
                  </span>
                </button>
              </li>
            ))}
            {!list.length && <li className="px-3 py-4 text-xs text-subtle">No typefaces match.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
