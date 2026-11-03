"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ArrowRight, Copy, Maximize2 } from "lucide-react";
import { Button, Dialog, Spinner, cx } from "@/components/shared/ui";
import { DocPreview } from "@/components/shared/doc-preview";
import { FormatGlyph } from "@/components/create/format-glyph";
import { describeResizeModes, smartResize, type ResizeMode } from "@/core/resize/smart-resize";
import { browserMeasure } from "@/core/text/layout";
import { createProjectFromDoc } from "@/lib/storage/projects";
import { useEditor } from "@/stores/editor-store";
import { toast } from "@/stores/ui-store";
import { FORMAT_PRESETS, MAX_DOC_SIDE, MIN_DOC_SIDE } from "@/types/project";
import type { DesignDocument } from "@/types/project";

const MODES = describeResizeModes();
const clampSide = (v: number) => Math.max(MIN_DOC_SIDE, Math.min(MAX_DOC_SIDE, Math.round(v)));

/** Pixel box that fits a w × h page inside bw × bh (DocPreview needs a definite width). */
function fitBox(w: number, h: number, bw: number, bh: number) {
  const s = Math.min(bw / w, bh / h);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

function SizeInput({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = parseInt(draft, 10);
    if (Number.isFinite(v)) onCommit(clampSide(v));
    setDraft(null);
  };
  return (
    <label className="flex h-8 items-center gap-1.5 rounded-[2px] border border-line px-2 focus-within:border-fg">
      <span className="label-mono">{label}</span>
      <input
        inputMode="numeric"
        aria-label={`Target ${label === "W" ? "width" : "height"} in pixels`}
        className="w-16 bg-transparent text-right font-mono text-[12px] tabular-nums text-fg outline-none"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className="font-mono text-[10px] text-subtle">px</span>
    </label>
  );
}

export function SmartResizeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const project = useEditor((s) => s.project);
  const doc = useEditor((s) => s.doc);
  const revision = useEditor((s) => s.revision);

  const initial = useMemo(() => {
    if (!doc) return FORMAT_PRESETS[0];
    // Default to a format with a different orientation — the most common adaptation.
    const land = doc.width > doc.height;
    return FORMAT_PRESETS.find((f) => (land ? f.height > f.width : f.width > f.height) && !(f.width === doc.width && f.height === doc.height)) ?? FORMAT_PRESETS[0];
  }, [doc]);
  const [target, setTarget] = useState<{ w: number; h: number; presetId: string | null }>(() => ({ w: initial.width, h: initial.height, presetId: initial.id }));
  const [mode, setMode] = useState<ResizeMode>("reflow");
  const [busy, setBusy] = useState<"copy" | "apply" | null>(null);

  const results = useMemo(() => {
    if (!doc) return null;
    const out = {} as Record<ResizeMode, DesignDocument>;
    for (const m of MODES) {
      try {
        out[m.id] = smartResize(doc, target.w, target.h, m.id, browserMeasure);
      } catch {
        out[m.id] = smartResize(doc, target.w, target.h, "scale", browserMeasure);
      }
    }
    return out;
  }, [doc, target.w, target.h]);

  if (!open || !project || !doc || !results) return null;

  const same = target.w === doc.width && target.h === doc.height;
  const result = results[mode];
  const keyBase = `resize:${project.id}:${revision}:${target.w}x${target.h}`;
  const activeMode = MODES.find((m) => m.id === mode)!;

  const createCopy = async () => {
    setBusy("copy");
    try {
      const p = await createProjectFromDoc(`${project.name} — ${target.w}×${target.h}`, result, { originId: project.id, category: project.category, tags: [...project.tags] });
      toast({ kind: "success", title: "Adapted copy created", description: `${target.w} × ${target.h} · ${activeMode.label}` });
      onClose();
      router.push(`/editor/${p.id}`);
    } catch (e) {
      toast({ kind: "error", title: "Could not create the copy", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const apply = () => {
    const st = useEditor.getState();
    st.resizeDocument(target.w, target.h, result.layers);
    // Same undo step: grid margins / gutter and guides follow the new format.
    st.setDoc((d) => ({ ...d, grid: result.grid, guides: result.guides }), { history: false });
    toast({ kind: "success", title: `Resized to ${target.w} × ${target.h}`, description: "Undo restores the previous format." });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Smart resize"
      title="Adapt to a new format"
      width="max-w-6xl"
      footer={
        <>
          <span className="mr-auto hidden font-mono text-[10px] uppercase tracking-[0.08em] text-subtle sm:block">
            {doc.width} × {doc.height} → {target.w} × {target.h} · {activeMode.label}
          </span>
          <Button variant="secondary" onClick={apply} disabled={same || !!busy} title="Replaces this project’s format (undoable)">
            <Maximize2 size={14} /> Apply to this project
          </Button>
          <Button variant="primary" onClick={createCopy} disabled={same || !!busy}>
            {busy === "copy" ? <Spinner /> : <Copy size={14} />} Create adapted copy
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <div className="label-mono mb-2">
            <span className="text-accent">01</span> Target format
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {FORMAT_PRESETS.map((f) => {
              const active = target.presetId === f.id;
              const current = f.width === doc.width && f.height === doc.height;
              return (
                <button
                  key={f.id}
                  onClick={() => setTarget({ w: f.width, h: f.height, presetId: f.id })}
                  aria-pressed={active}
                  title={`${f.label} · ${f.width} × ${f.height}${current ? " (current)" : ""}`}
                  className={cx("flex items-center gap-1.5 border py-1 pl-1 pr-2.5 text-[11px] transition-colors", active ? "border-fg bg-fg text-bg" : "border-line hover:border-fg", current && !active && "opacity-50")}
                >
                  <FormatGlyph width={f.width} height={f.height} size={18} active={active} />
                  {f.label}
                </button>
              );
            })}
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            <SizeInput label="W" value={target.w} onCommit={(w) => setTarget((t) => ({ ...t, w, presetId: null }))} />
            <button aria-label="Swap width and height" title="Swap orientation" className="flex h-8 w-8 items-center justify-center text-muted hover:text-fg" onClick={() => setTarget((t) => ({ w: t.h, h: t.w, presetId: null }))}>
              <ArrowLeftRight size={13} />
            </button>
            <SizeInput label="H" value={target.h} onCommit={(h) => setTarget((t) => ({ ...t, h, presetId: null }))} />
          </div>
        </div>

        <div>
          <div className="label-mono mb-2">
            <span className="text-accent">02</span> Strategy
          </div>
          <div role="radiogroup" aria-label="Resize strategy" className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {MODES.map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(m.id)}
                  className={cx("flex flex-col border p-2 text-left transition-colors", active ? "border-accent bg-accent/10" : "border-line hover:border-fg")}
                >
                  <div className="flex h-24 items-center justify-center bg-sunken/70">
                    <div className="max-w-full border border-line" style={fitBox(target.w, target.h, 150, 84)}>
                      <DocPreview doc={results[m.id]} cacheKey={`${keyBase}:${m.id}`} maxSide={240} className="w-full" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className={cx("font-mono text-[10px]", active ? "text-accent" : "text-subtle")}>{m.n}</span>
                    <span className="text-[12px] font-medium">{m.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-muted">{activeMode.description}</p>
        </div>

        <div>
          <div className="label-mono mb-2">
            <span className="text-accent">03</span> Compare
          </div>
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1.3fr]">
            <figure className="flex flex-col">
              <div className="flex h-[300px] items-center justify-center overflow-hidden border border-line bg-sunken/60 p-4">
                <div className="max-w-full shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]" style={fitBox(doc.width, doc.height, 300, 260)}>
                  <DocPreview doc={doc} cacheKey={`resize:orig:${project.id}:${revision}`} maxSide={520} className="w-full" alt="Original design" />
                </div>
              </div>
              <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                Original · {doc.width} × {doc.height}
              </figcaption>
            </figure>
            <ArrowRight size={16} className="mx-auto hidden text-subtle md:block" aria-hidden />
            <figure className="flex flex-col">
              <div className="flex h-[300px] items-center justify-center overflow-hidden border border-line-strong bg-sunken/60 p-4">
                <div className="max-w-full shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]" style={fitBox(target.w, target.h, 440, 260)}>
                  <DocPreview doc={result} cacheKey={`${keyBase}:${mode}:main`} maxSide={720} className="w-full" alt={`Resized design, ${activeMode.label}`} />
                </div>
              </div>
              <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                Result · {target.w} × {target.h} · {activeMode.label}
              </figcaption>
            </figure>
          </div>
          {same && <p className="mt-2 text-[12px] text-accent">The target matches the current size — choose another format.</p>}
        </div>
      </div>
    </Dialog>
  );
}
