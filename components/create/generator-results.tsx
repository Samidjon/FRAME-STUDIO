"use client";

import { ArrowUpRight, Heart, TriangleAlert } from "lucide-react";
import { DocPreview } from "@/components/shared/doc-preview";
import { Button, Spinner, cx } from "@/components/shared/ui";
import { getAlgorithm } from "@/core/composition/algorithms";
import type { GeneratedVariant } from "@/core/composition/types";

export interface ResultItem {
  key: string;
  seed: number;
  title: string;
  variant: GeneratedVariant;
}

function ScoreBadge({ score, warnings }: { score: number; warnings: string[] }) {
  const tone = score >= 85 ? "bg-ok" : score >= 65 ? "bg-subtle" : "bg-accent";
  const tip = warnings.length ? warnings.join("\n") : "Passed all layout checks";
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-muted" title={tip}>
      {warnings.length > 0 && <TriangleAlert size={11} className="text-accent" aria-label={`${warnings.length} warning${warnings.length > 1 ? "s" : ""}`} />}
      <span className={cx("h-1.5 w-1.5 rounded-full", tone)} aria-hidden />
      <span aria-label={`Layout score ${score} of 100`}>{score}</span>
    </span>
  );
}

export function ResultCard({
  item,
  index,
  favourite,
  onToggleFavourite,
  onOpen,
  opening,
}: {
  item: ResultItem;
  index: number;
  favourite: boolean;
  onToggleFavourite: () => void;
  onOpen: () => void;
  opening: boolean;
}) {
  const v = item.variant;
  const algo = getAlgorithm(v.algorithm);
  return (
    <article className="group flex flex-col animate-rise" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <div className="relative border border-line bg-sunken transition-colors group-hover:border-fg">
        <button className="block w-full" onClick={onOpen} aria-label={`Open ${v.label} in the editor`} disabled={opening}>
          <DocPreview doc={v.doc} cacheKey={`${v.id}:${item.seed}`} maxSide={640} className="w-full" alt={`${v.label} composition`} />
        </button>
        <button
          onClick={onToggleFavourite}
          aria-pressed={favourite}
          aria-label={favourite ? "Remove from favourites" : "Add to favourites"}
          className={cx(
            "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border transition-all",
            favourite ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-bg/85 text-fg opacity-0 backdrop-blur group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          <Heart size={14} fill={favourite ? "currentColor" : "none"} />
        </button>
        {opening && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/60">
            <Spinner />
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label-mono">
            <span className="text-accent">{String(index + 1).padStart(2, "0")}</span> · Algorithm {algo.n}
            {v.variant ? " · Alt" : ""}
          </div>
          <div className="mt-0.5 truncate font-display text-[15px] font-semibold tracking-tight">{v.label}</div>
        </div>
        <ScoreBadge score={v.score} warnings={v.warnings} />
      </div>
      <Button size="sm" variant="secondary" className="mt-2.5 self-start" onClick={onOpen} disabled={opening}>
        Open in Editor <ArrowUpRight size={12} />
      </Button>
    </article>
  );
}

export function ResultSkeleton({ count, ratio }: { count: number; ratio: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col" aria-hidden>
          <div className="animate-pulse border border-line bg-sunken" style={{ aspectRatio: String(ratio), animationDelay: `${i * 60}ms` }} />
          <div className="mt-2.5 h-2.5 w-16 animate-pulse bg-sunken" />
          <div className="mt-1.5 h-3.5 w-32 animate-pulse bg-sunken" />
        </div>
      ))}
    </>
  );
}
