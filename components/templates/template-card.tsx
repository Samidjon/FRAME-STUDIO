"use client";

import { Heart } from "lucide-react";
import type { DesignDocument } from "@/types/project";
import type { Template } from "@/core/templates";
import { DocPreview } from "@/components/shared/doc-preview";
import { cx } from "@/components/shared/ui";

export function TemplateCard({
  template,
  doc,
  index,
  favorite,
  onOpen,
  onToggleFavorite,
}: {
  template: Template;
  doc: DesignDocument;
  index: number;
  favorite: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <article className="group relative mb-5 break-inside-avoid">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Preview template ${template.name} — ${template.category}, ${template.format}`}
        className="block w-full text-left outline-none"
      >
        <div className="relative overflow-hidden border border-line bg-sunken transition-colors duration-200 group-hover:border-fg group-focus-within:border-fg">
          <DocPreview doc={doc} cacheKey={template.id} maxSide={560} alt={`${template.name} template preview`} />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pb-3 pt-10 text-white opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
            aria-hidden
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/70">{template.category}</div>
            <div className="mt-1 flex items-end justify-between gap-3">
              <span className="font-display text-base font-semibold leading-tight tracking-tight">{template.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-white/70">
                {template.width}×{template.height}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-[10px] text-accent">{String(index + 1).padStart(2, "0")}</span>
          <span className="truncate text-[13px] font-medium tracking-tight">{template.name}</span>
          <span className="label-mono ml-auto shrink-0">{template.format}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? `Remove ${template.name} from favourites` : `Add ${template.name} to favourites`}
        className={cx(
          "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-[2px] border transition-all duration-150",
          favorite
            ? "border-accent bg-accent text-accent-ink opacity-100"
            : "border-line bg-bg/85 text-fg opacity-0 backdrop-blur group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100",
        )}
      >
        <Heart size={14} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
