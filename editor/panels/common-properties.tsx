"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Trash2,
  Unlock,
} from "lucide-react";
import type { BlendMode, Layer } from "@/types/layer";
import { useEditor } from "@/stores/editor-store";
import { IconButton, NumberField, Select, Slider } from "@/components/shared/ui";
import { Row, Section } from "./section";
import { toggleLock, toggleVisibility } from "@/editor/actions";

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity",
].map((v) => ({ value: v as BlendMode, label: v.replace("-", " ").replace(/^./, (c) => c.toUpperCase()) }));

export function AlignBar({ count }: { count: number }) {
  const align = useEditor((s) => s.align);
  const distribute = useEditor((s) => s.distribute);
  const toPage = count < 2;
  return (
    <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Align">
      <IconButton size="sm" label={toPage ? "Align left to page" : "Align left"} onClick={() => align("left", toPage)}><AlignStartVertical size={14} /></IconButton>
      <IconButton size="sm" label="Align horizontal centres" onClick={() => align("hcenter", toPage)}><AlignCenterVertical size={14} /></IconButton>
      <IconButton size="sm" label="Align right" onClick={() => align("right", toPage)}><AlignEndVertical size={14} /></IconButton>
      <IconButton size="sm" label="Align top" onClick={() => align("top", toPage)}><AlignStartHorizontal size={14} /></IconButton>
      <IconButton size="sm" label="Align vertical centres" onClick={() => align("vcenter", toPage)}><AlignCenterHorizontal size={14} /></IconButton>
      <IconButton size="sm" label="Align bottom" onClick={() => align("bottom", toPage)}><AlignEndHorizontal size={14} /></IconButton>
      <span className="mx-1 h-4 w-px bg-line" />
      <IconButton size="sm" label="Distribute horizontally (equal spacing)" disabled={count < 3} onClick={() => distribute("x")}><AlignHorizontalSpaceAround size={14} /></IconButton>
      <IconButton size="sm" label="Distribute vertically (equal spacing)" disabled={count < 3} onClick={() => distribute("y")}><AlignVerticalSpaceAround size={14} /></IconButton>
    </div>
  );
}

/** Position / size / rotation / opacity / blend — shared by every layer type. */
export function TransformSection({ layer }: { layer: Layer }) {
  const update = useEditor((s) => s.updateLayer);
  const set = (patch: Partial<Layer>, key: string) => update(layer.id, patch, { key: `${key}-${layer.id}` });
  const isAutoText = layer.type === "text" && (layer.autoHeight || layer.vertical);
  const isLine = layer.type === "shape" && layer.shape === "line";
  return (
    <Section index="01" title="Transform">
      <AlignBar count={1} />
      <Row>
        <NumberField label="X" value={layer.x} onChange={(x) => set({ x }, "x")} precision={1} />
        <NumberField label="Y" value={layer.y} onChange={(y) => set({ y }, "y")} precision={1} />
        <NumberField label="W" value={layer.width} min={1} onChange={(width) => set({ width }, "w")} precision={1} />
        {isLine ? (
          <NumberField label="T" value={layer.height} min={0.5} onChange={(height) => set({ height }, "h")} precision={1} />
        ) : (
          <div className={isAutoText ? "pointer-events-none opacity-50" : ""} title={isAutoText ? "Height follows the text (auto height)" : undefined}>
            <NumberField label="H" value={layer.height} min={1} onChange={(height) => set({ height }, "h")} precision={1} />
          </div>
        )}
        <NumberField label="R" value={layer.rotation} min={-360} max={360} onChange={(rotation) => set({ rotation }, "r")} suffix="°" precision={1} />
        {!layer.brandLocked && <NumberField label="O" value={Math.round(layer.opacity * 100)} min={0} max={100} onChange={(o) => set({ opacity: o / 100 }, "o")} suffix="%" />}
      </Row>
      {!layer.brandLocked && (
        <>
          <Slider label="Opacity" value={Math.round(layer.opacity * 100)} onChange={(o) => set({ opacity: o / 100 }, "o")} format={(v) => `${v}%`} />
          <Select label="Blend mode" value={layer.blendMode} options={BLEND_MODES} onChange={(blendMode) => update(layer.id, { blendMode })} />
        </>
      )}
    </Section>
  );
}

export function LayerActionsBar({ ids }: { ids: string[] }) {
  const doc = useEditor((s) => s.doc);
  const dup = useEditor((s) => s.duplicateLayers);
  const del = useEditor((s) => s.deleteLayers);
  const layers = doc?.layers.filter((l) => ids.includes(l.id)) ?? [];
  const locked = layers.length > 0 && layers.every((l) => l.locked);
  const hidden = layers.length > 0 && layers.every((l) => !l.visible);
  const onlyBrand = layers.length > 0 && layers.every((l) => l.brandLocked);
  return (
    <div className="flex items-center gap-0.5">
      <IconButton size="sm" disabled={onlyBrand} label={hidden ? "Show" : "Hide"} onClick={() => toggleVisibility(ids)}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</IconButton>
      <IconButton size="sm" disabled={onlyBrand} label={locked ? "Unlock" : "Lock"} onClick={() => toggleLock(ids)}>{locked ? <Lock size={14} /> : <Unlock size={14} />}</IconButton>
      <IconButton size="sm" label="Duplicate" shortcut="Ctrl+D" onClick={() => dup(ids)}><Copy size={14} /></IconButton>
      <IconButton size="sm" disabled={onlyBrand} label="Delete" shortcut="Del" onClick={() => del(ids)} className="hover:!text-danger"><Trash2 size={14} /></IconButton>
    </div>
  );
}
