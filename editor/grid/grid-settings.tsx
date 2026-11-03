"use client";

import type { GridSettings, GridType } from "@/types/canvas";
import { useEditor } from "@/stores/editor-store";
import { ColorField, NumberField, Select, Slider, TextInput, Toggle } from "@/components/shared/ui";
import { Row, Section } from "@/editor/panels/section";
import { computeGrid } from "@/core/geometry/grid";

export const GRID_TYPES: { value: GridType; label: string }[] = [
  { value: "column", label: "Column grid" },
  { value: "modular", label: "Modular grid" },
  { value: "baseline", label: "Baseline grid" },
  { value: "symmetrical", label: "Symmetrical" },
  { value: "asymmetrical", label: "Asymmetrical" },
  { value: "golden", label: "Golden ratio" },
  { value: "fibonacci", label: "Fibonacci" },
  { value: "thirds", label: "Rule of thirds" },
  { value: "custom", label: "Custom" },
];

const parseRatios = (s: string) =>
  s
    .split(/[,:\s]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 24);

export function GridSettingsPanel({ index = "03" }: { index?: string }) {
  const doc = useEditor((s) => s.doc)!;
  const setGrid = useEditor((s) => s.setGrid);
  const g = doc.grid;
  const set = (patch: Partial<GridSettings>, key = "grid") => setGrid(patch, { key });
  const usesCols = ["column", "modular", "baseline", "symmetrical"].includes(g.type);
  const usesRows = ["modular", "symmetrical", "asymmetrical"].includes(g.type);
  const geo = computeGrid(doc.width, doc.height, g);
  const colW = geo.columns[0]?.size ?? 0;

  return (
    <Section index={index} title="Grid system">
      <Toggle label="Show grid" checked={g.visible} onChange={(visible) => set({ visible }, "grid-vis")} />
      <Select label="Type" value={g.type} options={GRID_TYPES} onChange={(type) => set({ type, visible: true })} />
      {usesCols && <Slider label="Columns" value={g.columns} min={1} max={24} onChange={(columns) => set({ columns }, "grid-cols")} />}
      {usesRows && <Slider label="Rows" value={g.rows} min={1} max={24} onChange={(rows) => set({ rows }, "grid-rows")} />}
      {g.type === "asymmetrical" && (
        <TextInput label="Column ratios" defaultValue={g.columnRatios.join(" : ")} key={`a${g.columnRatios.join()}`} onBlur={(e) => set({ columnRatios: parseRatios(e.target.value).length ? parseRatios(e.target.value) : [1, 2] })} placeholder="1 : 2" />
      )}
      {g.type === "custom" && (
        <>
          <TextInput label="Column ratios" defaultValue={g.columnRatios.join(" : ")} key={`c${g.columnRatios.join()}`} onBlur={(e) => set({ columnRatios: parseRatios(e.target.value).length ? parseRatios(e.target.value) : [1] })} placeholder="1 : 2 : 1" />
          <TextInput label="Row ratios" defaultValue={g.rowRatios.join(" : ")} key={`r${g.rowRatios.join()}`} onBlur={(e) => set({ rowRatios: parseRatios(e.target.value).length ? parseRatios(e.target.value) : [1] })} placeholder="1 : 1 : 2" />
        </>
      )}
      {g.type !== "thirds" && g.type !== "golden" && g.type !== "fibonacci" && (
        <Slider label="Gutter" value={g.gutter} min={0} max={Math.round(Math.min(doc.width, doc.height) / 8)} onChange={(gutter) => set({ gutter }, "grid-gutter")} format={(v) => `${v}px`} />
      )}
      <div className="label-mono mt-1">Margins</div>
      <Row>
        <NumberField label="T" value={g.margins.top} min={0} onChange={(top) => set({ margins: { ...g.margins, top } }, "grid-m")} />
        <NumberField label="B" value={g.margins.bottom} min={0} onChange={(bottom) => set({ margins: { ...g.margins, bottom } }, "grid-m")} />
        <NumberField label="L" value={g.margins.left} min={0} onChange={(left) => set({ margins: { ...g.margins, left } }, "grid-m")} />
        <NumberField label="R" value={g.margins.right} min={0} onChange={(right) => set({ margins: { ...g.margins, right } }, "grid-m")} />
      </Row>
      <Slider
        label="All margins"
        value={Math.round((g.margins.top + g.margins.bottom + g.margins.left + g.margins.right) / 4)}
        min={0}
        max={Math.round(Math.min(doc.width, doc.height) / 4)}
        onChange={(m) => set({ margins: { top: m, right: m, bottom: m, left: m } }, "grid-m")}
        format={(v) => `${v}px`}
      />
      <Toggle label="Baseline grid" checked={g.showBaseline || g.type === "baseline"} onChange={(showBaseline) => set({ showBaseline })} />
      {(g.showBaseline || g.type === "baseline") && <Slider label="Baseline" value={g.baseline} min={2} max={Math.max(48, Math.round(doc.height / 40))} onChange={(baseline) => set({ baseline }, "grid-bl")} format={(v) => `${v}px`} />}
      <Row>
        <ColorField label="Grid colour" value={g.color} onChange={(color) => color && set({ color }, "grid-c")} />
        <Slider label="Opacity" value={Math.round(g.opacity * 100)} min={5} max={100} onChange={(o) => set({ opacity: o / 100 }, "grid-o")} format={(v) => `${v}%`} />
      </Row>
      <Toggle label="Snap to grid & guides" checked={g.snap} onChange={(snap) => set({ snap })} />
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-2 font-mono text-[10px] text-subtle">
        <span>Live area</span>
        <span className="text-right text-muted">
          {Math.round(geo.content.width)} × {Math.round(geo.content.height)}
        </span>
        <span>Modules</span>
        <span className="text-right text-muted">{geo.modules.length}</span>
        <span>Column</span>
        <span className="text-right text-muted">{colW.toFixed(1)} px</span>
      </div>
      <p className="text-[11px] leading-snug text-subtle">The grid is a construction aid. It is never exported.</p>
    </Section>
  );
}
