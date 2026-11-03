"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ArrowRight } from "lucide-react";
import { Button, SectionLabel, Spinner, TextInput, cx } from "@/components/shared/ui";
import { createDocument } from "@/core/document/factory";
import { createProjectFromDoc } from "@/lib/storage/projects";
import { toast } from "@/stores/ui-store";
import { FORMAT_PRESETS, MAX_DOC_SIDE, MIN_DOC_SIDE, type FormatPreset } from "@/types/project";
import { FormatGlyph, formatDims, ratioLabel } from "./format-glyph";

const GROUPS: FormatPreset["group"][] = ["Social", "Print", "Wallpaper", "Music"];
const clampSide = (v: number) => Math.max(MIN_DOC_SIDE, Math.min(MAX_DOC_SIDE, Math.round(v)));

export function BlankCanvas() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("ig-portrait");
  const [customW, setCustomW] = useState("1600");
  const [customH, setCustomH] = useState("900");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const preset = FORMAT_PRESETS.find((p) => p.id === selected);
  const cw = parseInt(customW, 10);
  const ch = parseInt(customH, 10);
  const customValid = Number.isFinite(cw) && Number.isFinite(ch) && cw >= MIN_DOC_SIDE && ch >= MIN_DOC_SIDE && cw <= MAX_DOC_SIDE && ch <= MAX_DOC_SIDE;
  const size = preset ? { w: preset.width, h: preset.height } : customValid ? { w: cw, h: ch } : null;

  const create = async () => {
    if (!size || busy) return;
    setBusy(true);
    try {
      const label = preset ? preset.label : `Custom ${formatDims(size.w, size.h)}`;
      const p = await createProjectFromDoc(name.trim() || `Untitled — ${label}`, createDocument(size.w, size.h));
      router.push(`/editor/${p.id}`);
    } catch (e) {
      setBusy(false);
      toast({ kind: "error", title: "Could not create the project", description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-10">
        {GROUPS.map((g, gi) => (
          <div key={g}>
            <SectionLabel index={String(gi + 1).padStart(2, "0")}>{g}</SectionLabel>
            <div role="radiogroup" aria-label={`${g} formats`} className="mt-3 grid grid-cols-2 border-l border-t border-line sm:grid-cols-3 xl:grid-cols-4">
              {FORMAT_PRESETS.filter((p) => p.group === g).map((p) => {
                const active = selected === p.id;
                return (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelected(p.id)}
                    onDoubleClick={create}
                    className={cx("flex items-center gap-4 border-b border-r border-line p-4 text-left transition-colors", active ? "bg-raised outline outline-1 -outline-offset-1 outline-fg" : "hover:bg-sunken")}
                  >
                    <FormatGlyph width={p.width} height={p.height} active={active} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{p.label}</span>
                      <span className="mt-1 block font-mono text-[10px] tracking-[0.06em] text-subtle">
                        {formatDims(p.width, p.height)} · {ratioLabel(p.width, p.height)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <SectionLabel index="05">Custom size</SectionLabel>
          <div
            className={cx("mt-3 flex flex-wrap items-end gap-3 border p-4 transition-colors", selected === "custom" ? "border-fg bg-raised" : "border-line")}
            onFocusCapture={() => setSelected("custom")}
          >
            <FormatGlyph width={customValid ? cw : 1} height={customValid ? ch : 1} active={selected === "custom"} />
            <div className="w-28">
              <TextInput label="Width px" inputMode="numeric" value={customW} onChange={(e) => setCustomW(e.target.value.replace(/[^\d]/g, ""))} onBlur={() => Number.isFinite(cw) && setCustomW(String(clampSide(cw)))} />
            </div>
            <Button
              variant="ghost"
              aria-label="Swap orientation"
              title="Swap orientation"
              onClick={() => {
                setSelected("custom");
                setCustomW(customH);
                setCustomH(customW);
              }}
            >
              <ArrowLeftRight size={14} />
            </Button>
            <div className="w-28">
              <TextInput label="Height px" inputMode="numeric" value={customH} onChange={(e) => setCustomH(e.target.value.replace(/[^\d]/g, ""))} onBlur={() => Number.isFinite(ch) && setCustomH(String(clampSide(ch)))} />
            </div>
            <p className={cx("basis-full text-[12px]", selected === "custom" && !customValid ? "text-danger" : "text-subtle")}>
              {MIN_DOC_SIDE}–{MAX_DOC_SIDE} px per side.{customValid ? ` Ratio ${ratioLabel(cw, ch)}.` : ""}
            </p>
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border border-line-strong p-5">
          <SectionLabel index="→">New project</SectionLabel>
          <div className="mt-5 flex items-center gap-4">
            <FormatGlyph width={size?.w ?? 1} height={size?.h ?? 1} size={72} active />
            <div>
              <div className="font-display text-xl font-semibold tracking-tight">{preset ? preset.label : "Custom size"}</div>
              <div className="font-mono text-[11px] text-muted">{size ? `${formatDims(size.w, size.h)} px` : "Invalid size"}</div>
            </div>
          </div>
          <div className="mt-6">
            <TextInput label="Project name" placeholder="Untitled" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          </div>
          <Button variant="primary" size="lg" className="mt-5 w-full" disabled={!size || busy} onClick={create}>
            {busy ? <Spinner /> : <ArrowRight size={16} />}
            Create
          </Button>
          <p className="mt-3 text-[11px] text-subtle">Opens the editor with an empty page and a proportional modular grid.</p>
        </div>
      </aside>
    </div>
  );
}
