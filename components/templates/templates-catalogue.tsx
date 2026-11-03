"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Search, X } from "lucide-react";
import { TEMPLATES, TEMPLATE_CATEGORIES, type Template, type TemplateCategory } from "@/core/templates";
import type { DesignDocument } from "@/types/project";
import { Button, EmptyState, Select, cx } from "@/components/shared/ui";
import { useUi } from "@/stores/ui-store";
import { TemplateCard } from "./template-card";
import { TemplatePreviewDialog } from "./template-preview-dialog";

type SortKey = "featured" | "name" | "format";
type Filter = "all" | "favorites" | TemplateCategory;

const SORTS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "name", label: "Name" },
  { value: "format", label: "Format" },
];

export const categorySlug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseFilter(param: string | null): Filter {
  if (!param) return "all";
  const p = param.toLowerCase();
  if (p === "favorites" || p === "favourites") return "favorites";
  return TEMPLATE_CATEGORIES.find((c) => categorySlug(c) === categorySlug(p) || c.toLowerCase() === p) ?? "all";
}

export function TemplatesCatalogue() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = parseFilter(params.get("category"));

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("featured");
  const [openId, setOpenId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const storedFavs = useUi((s) => s.favoriteTemplates);
  const toggleFavorite = useUi((s) => s.toggleFavoriteTemplate);
  // Favourites live in localStorage; only trust them after hydration.
  const favorites = mounted ? storedFavs : [];
  useEffect(() => setMounted(true), []);

  const docs = useMemo(() => new Map<string, DesignDocument>(TEMPLATES.map((t) => [t.id, t.build()])), []);

  const setFilter = useCallback(
    (f: Filter) => {
      const next = new URLSearchParams(params.toString());
      if (f === "all") next.delete("category");
      else next.set("category", f === "favorites" ? "favorites" : categorySlug(f));
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    TEMPLATES.forEach((t) => m.set(t.category, (m.get(t.category) ?? 0) + 1));
    return m;
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const list = TEMPLATES.filter((t) => {
      if (filter === "favorites" && !favorites.includes(t.id)) return false;
      if (filter !== "all" && filter !== "favorites" && t.category !== filter) return false;
      if (!terms.length) return true;
      const hay = [t.name, t.category, t.description, t.format, `${t.width}x${t.height}`, ...t.tags].join(" ").toLowerCase();
      return terms.every((term) => hay.includes(term));
    });
    const sorted = [...list];
    if (sort === "featured") sorted.sort((a, b) => a.featured - b.featured);
    else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => a.format.localeCompare(b.format) || a.width * a.height - b.width * b.height || a.name.localeCompare(b.name));
    return sorted;
  }, [query, filter, sort, favorites]);

  const openTemplate: Template | null = openId ? (TEMPLATES.find((t) => t.id === openId) ?? null) : null;
  const closeDialog = useCallback(() => setOpenId(null), []);

  const chips: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: TEMPLATES.length },
    ...TEMPLATE_CATEGORIES.map((c) => ({ value: c as Filter, label: c, count: counts.get(c) ?? 0 })),
    { value: "favorites", label: "Favorites", count: favorites.length },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 md:px-8 md:pt-14">
      <header className="grid gap-6 border-b border-line pb-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <div className="label-mono mb-4 flex items-center gap-2">
            <span className="text-accent">01</span>
            <span>Templates</span>
            <span className="text-subtle">/ {TEMPLATES.length} compositions</span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] md:text-6xl">
            Start from a<br />
            composition.
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted md:col-span-5 md:justify-self-end">
          Professional starting points built on mathematical grids. Every template opens as fully editable layers — type, shapes, images and
          textures — ready for your own visual language.
        </p>
      </header>

      <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-bg/90 px-4 py-4 backdrop-blur-md md:-mx-8 md:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-80">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="Search templates, tags, formats…"
              aria-label="Search templates"
              className="h-9 w-full rounded-[2px] border border-line-strong bg-transparent pl-9 pr-8 text-[13px] text-fg outline-none transition-colors placeholder:text-subtle focus:border-fg"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-subtle hover:text-fg">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 md:ml-auto">
            <span className="label-mono whitespace-nowrap" aria-live="polite">
              {results.length} {results.length === 1 ? "result" : "results"}
            </span>
            <div className="w-36">
              <Select<SortKey> value={sort} options={SORTS} onChange={setSort} label={undefined} className="[&_select]:h-9" />
            </div>
          </div>
        </div>
        <div role="toolbar" aria-label="Filter by category" className="scroll-thin -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {chips.map((c) => {
            const active = filter === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(c.value)}
                className={cx(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-[2px] border px-2.5 text-[12px] transition-colors",
                  active ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-fg hover:text-fg",
                )}
              >
                {c.value === "favorites" && <Heart size={11} fill={active ? "currentColor" : "none"} />}
                {c.label}
                <span className={cx("font-mono text-[9px]", active ? "text-bg/60" : "text-subtle")}>{c.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section aria-label="Template results" className="pt-8">
        {results.length ? (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 2xl:columns-4">
            {results.map((t, i) => (
              <TemplateCard
                key={t.id}
                template={t}
                doc={docs.get(t.id)!}
                index={i}
                favorite={favorites.includes(t.id)}
                onOpen={() => setOpenId(t.id)}
                onToggleFavorite={() => toggleFavorite(t.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            index="00 — No results"
            title={filter === "favorites" && !query ? "No favourites yet" : "Nothing matches"}
            body={
              filter === "favorites" && !query
                ? "Mark templates with the heart to collect them here."
                : "Try a different search term or another category — every template is listed under All."
            }
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Show all templates
              </Button>
            }
          />
        )}
      </section>

      <TemplatePreviewDialog
        template={openTemplate}
        doc={openTemplate ? (docs.get(openTemplate.id) ?? null) : null}
        favorite={openTemplate ? favorites.includes(openTemplate.id) : false}
        onToggleFavorite={() => openTemplate && toggleFavorite(openTemplate.id)}
        onClose={closeDialog}
      />
    </div>
  );
}
