"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart } from "lucide-react";
import type { DesignDocument } from "@/types/project";
import type { LayerType } from "@/types/layer";
import type { Template } from "@/core/templates";
import { getStyle } from "@/core/presets/styles";
import { DocPreview } from "@/components/shared/doc-preview";
import { Button, Dialog, Spinner } from "@/components/shared/ui";
import { createProjectFromDoc } from "@/lib/storage/projects";
import { useUi } from "@/stores/ui-store";

const TYPE_LABEL: Record<LayerType, string> = { text: "Text", shape: "Shape", image: "Image", texture: "Texture" };

export function TemplatePreviewDialog({
  template,
  doc,
  favorite,
  onToggleFavorite,
  onClose,
}: {
  template: Template | null;
  doc: DesignDocument | null;
  favorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useUi((s) => s.toast);
  const [opening, setOpening] = useState(false);

  const breakdown = useMemo(() => {
    const counts: Record<LayerType, number> = { text: 0, shape: 0, image: 0, texture: 0 };
    doc?.layers.forEach((l) => counts[l.type]++);
    return counts;
  }, [doc]);

  const open = async () => {
    if (!template || opening) return;
    setOpening(true);
    try {
      const project = await createProjectFromDoc(template.name, template.build(), { category: template.category, originId: template.id });
      router.push(`/editor/${project.id}`);
    } catch (err) {
      setOpening(false);
      toast({
        kind: "error",
        title: "Could not open template",
        description: err instanceof Error ? err.message : "The project could not be saved in this browser.",
      });
    }
  };

  const style = template ? getStyle(template.styleId) : undefined;

  return (
    <Dialog
      open={!!template && !!doc}
      onClose={onClose}
      title={template?.name ?? ""}
      eyebrow={template ? `${template.category} — ${template.format}` : undefined}
      width="max-w-5xl"
      footer={
        template && (
          <>
            <Button variant="ghost" onClick={onToggleFavorite} aria-pressed={favorite} className="mr-auto">
              <Heart size={14} fill={favorite ? "currentColor" : "none"} className={favorite ? "text-accent" : undefined} />
              {favorite ? "Favourited" : "Add to favourites"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={open} disabled={opening} aria-busy={opening}>
              {opening ? <Spinner /> : null}
              {opening ? "Opening…" : "Open in Editor"}
              {!opening && <ArrowRight size={14} />}
            </Button>
          </>
        )
      }
    >
      {template && doc && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex items-center justify-center border border-line bg-sunken p-4 md:p-6">
            <DocPreview doc={doc} cacheKey={template.id} maxSide={1100} alt={`${template.name} large preview`} className="max-h-[62vh] w-full shadow-[0_20px_50px_-25px_rgba(0,0,0,0.45)]" />
          </div>
          <div className="flex flex-col gap-6">
            <p className="text-sm leading-relaxed text-muted">{template.description}</p>
            <dl className="grid grid-cols-2 border-t border-line">
              {[
                ["01", "Format", template.format],
                ["02", "Size", `${template.width} × ${template.height} px`],
                ["03", "Style", style?.name ?? "—"],
                ["04", "Grid", `${doc.grid.type} · ${doc.grid.columns}×${doc.grid.rows}`],
              ].map(([n, k, v]) => (
                <div key={k} className="border-b border-line py-3 pr-3">
                  <dt className="label-mono">
                    <span className="text-accent">{n}</span> {k}
                  </dt>
                  <dd className="mt-1 text-[13px] capitalize">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <div className="label-mono mb-3 flex items-center justify-between">
                <span>
                  <span className="text-accent">05</span> Layers
                </span>
                <span className="font-display text-xl font-semibold text-fg">{doc.layers.length}</span>
              </div>
              <ul className="space-y-2">
                {(Object.keys(breakdown) as LayerType[]).map((t) => (
                  <li key={t} className="flex items-center gap-3 text-[12px]">
                    <span className="w-16 text-muted">{TYPE_LABEL[t]}</span>
                    <span className="h-[6px] flex-1 bg-sunken" aria-hidden>
                      <span className="block h-full bg-fg" style={{ width: `${(breakdown[t] / Math.max(1, doc.layers.length)) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right font-mono text-[11px] tabular-nums">{breakdown[t]}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {template.tags.map((t) => (
                <span key={t} className="border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                  {t}
                </span>
              ))}
            </div>
            <p className="text-[12px] text-subtle">Every element stays editable — text, shapes, images and textures open as separate layers on the original grid.</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
