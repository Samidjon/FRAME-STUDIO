"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, RefreshCw } from "lucide-react";
import { Button, EmptyState, Toggle, cx } from "@/components/shared/ui";
import { getProvider } from "@/core/composition/engine";
import { withSenitukangBrand } from "@/core/brand/senitukang";
import { getGenStyle, styleFontFamilies } from "@/core/composition/styles";
import type { GeneratorInput } from "@/core/composition/types";
import { browserMeasure } from "@/core/text/layout";
import { loadFonts } from "@/lib/fonts/catalog";
import { createProjectFromDoc } from "@/lib/storage/projects";
import { toast } from "@/stores/ui-store";
import { FORMAT_PRESETS } from "@/types/project";
import { DEFAULT_FORM, GeneratorFormPanel, type GeneratorForm } from "./generator-form";
import { ResultCard, ResultSkeleton, type ResultItem } from "./generator-results";

type Status = "idle" | "loading" | "ready" | "error";

const newSeed = () => Math.floor(Math.random() * 2_000_000_000);
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

export function GeneratorStudio() {
  const router = useRouter();
  const [form, setForm] = useState<GeneratorForm>(DEFAULT_FORM);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ResultItem[]>([]);
  const [seed, setSeed] = useState<number | null>(null);
  const [favs, setFavs] = useState<Map<string, ResultItem>>(new Map());
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<{ style: string; format: string; ms: number } | null>(null);
  const req = useRef(0);

  const patch = useCallback((p: Partial<GeneratorForm>) => setForm((f) => ({ ...f, ...p })), []);
  const format = FORMAT_PRESETS.find((f) => f.id === form.formatId) ?? FORMAT_PRESETS[0];

  const run = useCallback(
    async (s: number) => {
      const id = ++req.current;
      setStatus("loading");
      setError(null);
      setOnlyFavs(false);
      setSeed(s);
      const fmt = FORMAT_PRESETS.find((f) => f.id === form.formatId) ?? FORMAT_PRESETS[0];
      const input: GeneratorInput = {
        image: form.image ? { assetId: form.image.assetId, width: form.image.width, height: form.image.height } : null,
        logo: form.logo ? { assetId: form.logo.assetId, width: form.logo.width, height: form.logo.height } : null,
        title: form.title,
        subtitle: form.subtitle,
        body: form.body,
        palette: form.palette,
        style: form.style,
        format: { width: fmt.width, height: fmt.height },
        count: form.count,
        direction: form.direction,
        density: form.density,
        asymmetry: form.asymmetry,
        seed: s,
      };
      try {
        const t0 = performance.now();
        // Measure with the real faces: load the style's families first (guarded by a timeout).
        await withTimeout(loadFonts(styleFontFamilies(form.style)), 5000);
        // Yield a frame so the loading state paints before the synchronous layout work.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const generated = await getProvider().generate(input, browserMeasure);
        // Every result carries the company logo; the title stays what the user typed.
        const variants = generated.map((v) => ({ ...v, doc: withSenitukangBrand(v.doc, browserMeasure, { keepTitle: true }) }));
        if (id !== req.current) return;
        if (!variants.length) throw new Error("No composition passed the layout checks. Try a shorter title or a different format.");
        const title = form.title.trim() || "Untitled";
        setItems(variants.map((v) => ({ key: `${s}:${v.id}`, seed: s, title, variant: v })));
        setLastMeta({ style: getGenStyle(form.style).name, format: fmt.label, ms: Math.round(performance.now() - t0) });
        setStatus("ready");
      } catch (e) {
        if (id !== req.current) return;
        setError(e instanceof Error ? e.message : "The generator stopped unexpectedly.");
        setStatus("error");
      }
    },
    [form],
  );

  const generate = () => void run(seed ?? newSeed());
  const regenerate = () => void run(newSeed());

  const toggleFav = (it: ResultItem) =>
    setFavs((m) => {
      const n = new Map(m);
      if (n.has(it.key)) n.delete(it.key);
      else n.set(it.key, it);
      return n;
    });

  const open = async (it: ResultItem) => {
    if (opening) return;
    setOpening(it.key);
    try {
      const p = await createProjectFromDoc(`${it.title} — ${it.variant.label}`, it.variant.doc, { tags: ["generated", it.variant.algorithm] });
      router.push(`/editor/${p.id}`);
    } catch (e) {
      setOpening(null);
      toast({ kind: "error", title: "Could not open in the editor", description: e instanceof Error ? e.message : undefined });
    }
  };

  const shown = useMemo(() => (onlyFavs ? [...favs.values()] : items), [onlyFavs, favs, items]);
  const ratio = format.width / format.height;
  const gridCols = ratio > 1.2 ? "sm:grid-cols-2" : ratio < 0.85 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="grid gap-10 lg:grid-cols-[360px_1fr] xl:grid-cols-[380px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-3 scroll-thin">
        <div className="mb-4">
          <div className="label-mono">
            <span className="text-accent">C</span> Composition generator
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Ten layout algorithms — each builds its own grid, fits every line of type and checks contrast, margins and collisions before a variant is shown.
          </p>
        </div>
        <GeneratorFormPanel form={form} patch={patch} onGenerate={generate} onRegenerate={regenerate} busy={status === "loading"} hasResults={items.length > 0} />
      </aside>

      <section aria-live="polite" aria-busy={status === "loading"} className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Results</h2>
            {status === "ready" && lastMeta && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                {items.length} variants · {lastMeta.style} · {lastMeta.format} · seed {seed} · {lastMeta.ms} ms
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-44">
              <Toggle label={`Show favourites (${favs.size})`} checked={onlyFavs} onChange={setOnlyFavs} />
            </div>
            {items.length > 0 && (
              <Button size="sm" variant="ghost" onClick={regenerate} disabled={status === "loading"}>
                <RefreshCw size={12} /> New seed
              </Button>
            )}
          </div>
        </div>

        {status === "error" && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-danger/50 p-4">
            <div>
              <div className="label-mono !text-danger">Generation failed</div>
              <p className="mt-1 text-sm">{error}</p>
            </div>
            <Button size="sm" onClick={generate}>
              Try again
            </Button>
          </div>
        )}

        {status === "loading" && (
          <div className={cx("grid grid-cols-1 gap-x-5 gap-y-8", gridCols)}>
            <ResultSkeleton count={form.count} ratio={ratio} />
          </div>
        )}

        {status !== "loading" && shown.length > 0 && (
          <div className={cx("grid grid-cols-1 gap-x-5 gap-y-8", gridCols)}>
            {shown.map((it, i) => (
              <ResultCard key={it.key} item={it} index={i} favourite={favs.has(it.key)} onToggleFavourite={() => toggleFav(it)} onOpen={() => open(it)} opening={opening === it.key} />
            ))}
          </div>
        )}

        {status !== "loading" && shown.length === 0 && (
          onlyFavs ? (
            <EmptyState
              index="♡"
              title="No favourites yet"
              body="Mark variants with the heart to collect them here — favourites stay available when you regenerate with a new seed."
              action={
                <Button size="sm" onClick={() => setOnlyFavs(false)}>
                  <Heart size={12} /> Show all results
                </Button>
              }
            />
          ) : status !== "error" ? (
            <EmptyState
              index="00"
              title="Your compositions appear here"
              body="Add an image and a headline, choose a style and a format, then generate 8–12 distinct layouts: editorial, Swiss, modular, experimental and more."
              action={
                <Button variant="accent" onClick={generate}>
                  Generate with the sample text
                </Button>
              }
            />
          ) : null
        )}
      </section>
    </div>
  );
}
