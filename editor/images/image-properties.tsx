"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, FlipHorizontal2, FlipVertical2, Maximize, RefreshCw, RotateCcw } from "lucide-react";
import type { ImageEffects, ImageLayer, MaskShape } from "@/types/layer";
import { useEditor } from "@/stores/editor-store";
import { Button, ColorField, IconButton, Select, Slider, Toggle, cx } from "@/components/shared/ui";
import { Row, Section } from "@/editor/panels/section";
import { defaultEffects } from "@/core/document/factory";
import { replaceImage } from "@/editor/actions";
import { CropDialog } from "./crop-dialog";
import { getSource } from "@/lib/image/resources";
import { processImage } from "@/core/rendering/image-pipeline";
import { BLEND_MODES } from "@/editor/panels/common-properties";

const MASKS: { value: MaskShape; label: string }[] = [
  { value: "none", label: "None" },
  { value: "circle", label: "Circle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "arch", label: "Arch" },
  { value: "triangle", label: "Triangle" },
  { value: "diamond", label: "Diamond" },
  { value: "hexagon", label: "Hexagon" },
  { value: "star", label: "Star" },
];

/** One-click effect looks; each previewed on the actual image. */
const LOOKS: { id: string; label: string; fx: (e: ImageEffects) => ImageEffects }[] = [
  { id: "original", label: "Original", fx: () => defaultEffects() },
  { id: "mono", label: "Mono", fx: (e) => ({ ...e, grayscale: 100, contrast: 18 }) },
  { id: "signal", label: "Signal", fx: (e) => ({ ...e, duotone: { enabled: true, shadow: "#171717", highlight: "#FF4D00" } }) },
  { id: "lavender", label: "Lavender", fx: (e) => ({ ...e, duotone: { enabled: true, shadow: "#292929", highlight: "#E9DAF5" } }) },
  { id: "film", label: "Film", fx: (e) => ({ ...e, grain: 35, contrast: 12, saturation: -20, exposure: 5 }) },
  { id: "halftone", label: "Halftone", fx: (e) => ({ ...e, halftone: { enabled: true, size: 10, angle: 45, color: "#171717" } }) },
  { id: "faded", label: "Faded", fx: (e) => ({ ...e, contrast: -30, brightness: 12, saturation: -35 }) },
  { id: "punch", label: "Punch", fx: (e) => ({ ...e, contrast: 35, saturation: 30 }) },
];

function LookThumb({ layer, look, onPick }: { layer: ImageLayer; look: (typeof LOOKS)[number]; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const src = getSource(layer.assetId);
    const c = ref.current;
    if (!src || !c) return;
    const preview: ImageLayer = { ...layer, width: 64, height: 64, mask: "none", cornerRadius: 0, border: { width: 0, color: "#000" }, effects: look.fx(defaultEffects()) };
    const out = processImage(src, preview, 128, 128);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.drawImage(out, 0, 0);
  }, [layer.assetId, layer.crop, look, layer]);
  return (
    <button onClick={onPick} className="group flex flex-col items-center gap-1" aria-label={`Apply ${look.label} look`}>
      <canvas ref={ref} width={128} height={128} className="h-12 w-12 border border-line group-hover:border-accent" />
      <span className="font-mono text-[9px] text-subtle group-hover:text-fg">{look.label}</span>
    </button>
  );
}

export function ImageProperties({ layer }: { layer: ImageLayer }) {
  const update = useEditor((s) => s.updateLayer);
  const doc = useEditor((s) => s.doc)!;
  const [cropOpen, setCropOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ImageLayer>, key?: string) => update(layer.id, patch, key ? { key: `${key}-${layer.id}` } : undefined);
  const fx = (patch: Partial<ImageEffects>, key?: string) => set({ effects: { ...layer.effects, ...patch } }, key ? `fx-${key}` : undefined);
  const e = layer.effects;

  useEffect(() => {
    const onCrop = (ev: Event) => (ev as CustomEvent<string>).detail === layer.id && setCropOpen(true);
    window.addEventListener("frame:crop", onCrop);
    return () => window.removeEventListener("frame:crop", onCrop);
  }, [layer.id]);

  return (
    <>
      <Section index="02" title="Image">
        <div className="flex items-center gap-1">
          <IconButton size="sm" label="Crop (double-click image)" onClick={() => setCropOpen(true)}><Crop size={14} /></IconButton>
          <IconButton size="sm" label="Flip horizontal" active={layer.flipX} onClick={() => set({ flipX: !layer.flipX })}><FlipHorizontal2 size={14} /></IconButton>
          <IconButton size="sm" label="Flip vertical" active={layer.flipY} onClick={() => set({ flipY: !layer.flipY })}><FlipVertical2 size={14} /></IconButton>
          <IconButton size="sm" label="Fill page" onClick={() => set({ x: 0, y: 0, width: doc.width, height: doc.height, rotation: 0 })}><Maximize size={14} /></IconButton>
          <IconButton size="sm" label="Replace image" onClick={() => fileRef.current?.click()}><RefreshCw size={14} /></IconButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) void replaceImage(layer.id, f);
              ev.target.value = "";
            }}
          />
        </div>
        <Row>
          <Select label="Mask" value={layer.mask} options={MASKS} onChange={(mask) => set({ mask })} />
          <div className="flex flex-col gap-1">
            <span className="label-mono">Radius</span>
            <input type="range" className="fs-range mt-1.5" aria-label="Corner radius" min={0} max={Math.round(Math.min(layer.width, layer.height) / 2)} value={layer.cornerRadius} onChange={(ev) => set({ cornerRadius: Number(ev.target.value) }, "radius")} />
          </div>
        </Row>
        <Row>
          <Slider label="Border" value={layer.border.width} min={0} max={Math.max(40, Math.round(layer.width / 20))} onChange={(width) => set({ border: { ...layer.border, width } }, "bw")} />
          <div className="pt-4">
            <ColorField label="Border" value={layer.border.color} onChange={(color) => color && set({ border: { ...layer.border, color } }, "bc")} />
          </div>
        </Row>
      </Section>
      <Section index="03" title="Looks">
        <div className="grid grid-cols-4 gap-2">
          {LOOKS.map((l) => (
            <LookThumb key={l.id} layer={layer} look={l} onPick={() => set({ effects: l.fx(defaultEffects()) })} />
          ))}
        </div>
      </Section>
      <Section
        index="04"
        title="Adjustments"
        action={
          <IconButton size="sm" label="Reset effects" onClick={() => set({ effects: defaultEffects() })}>
            <RotateCcw size={12} />
          </IconButton>
        }
      >
        <Slider label="Exposure" value={e.exposure} min={-100} max={100} onChange={(v) => fx({ exposure: v }, "exp")} />
        <Slider label="Brightness" value={e.brightness} min={-100} max={100} onChange={(v) => fx({ brightness: v }, "bri")} />
        <Slider label="Contrast" value={e.contrast} min={-100} max={100} onChange={(v) => fx({ contrast: v }, "con")} />
        <Slider label="Saturation" value={e.saturation} min={-100} max={100} onChange={(v) => fx({ saturation: v }, "sat")} />
        <Slider label="Hue" value={e.hue} min={-180} max={180} onChange={(v) => fx({ hue: v }, "hue")} format={(v) => `${v}°`} />
        <Slider label="Grayscale" value={e.grayscale} min={0} max={100} onChange={(v) => fx({ grayscale: v }, "gray")} format={(v) => `${v}%`} />
        <Slider label="Blur" value={e.blur} min={0} max={50} step={0.5} onChange={(v) => fx({ blur: v }, "blur")} format={(v) => `${v}px`} />
        <Slider label="Grain" value={e.grain} min={0} max={100} onChange={(v) => fx({ grain: v }, "grain")} />
      </Section>
      <Section index="05" title="Colour effects" defaultOpen={e.duotone.enabled || e.overlay.enabled || e.halftone.enabled}>
        <Toggle label="Duotone" checked={e.duotone.enabled} onChange={(enabled) => fx({ duotone: { ...e.duotone, enabled } })} />
        {e.duotone.enabled && (
          <Row>
            <ColorField label="Shadows" value={e.duotone.shadow} onChange={(c) => c && fx({ duotone: { ...e.duotone, shadow: c } }, "dts")} />
            <ColorField label="Highlights" value={e.duotone.highlight} onChange={(c) => c && fx({ duotone: { ...e.duotone, highlight: c } }, "dth")} />
          </Row>
        )}
        <Toggle label="Colour overlay" checked={e.overlay.enabled} onChange={(enabled) => fx({ overlay: { ...e.overlay, enabled } })} />
        {e.overlay.enabled && (
          <>
            <ColorField label="Overlay" value={e.overlay.color} onChange={(c) => c && fx({ overlay: { ...e.overlay, color: c } }, "ovc")} />
            <Slider label="Overlay opacity" value={Math.round(e.overlay.opacity * 100)} onChange={(v) => fx({ overlay: { ...e.overlay, opacity: v / 100 } }, "ovo")} format={(v) => `${v}%`} />
            <Select value={e.overlay.blend} options={BLEND_MODES} onChange={(blend) => fx({ overlay: { ...e.overlay, blend } })} />
          </>
        )}
        <Toggle label="Halftone" checked={e.halftone.enabled} onChange={(enabled) => fx({ halftone: { ...e.halftone, enabled } })} />
        {e.halftone.enabled && (
          <>
            <Slider label="Dot size" value={e.halftone.size} min={2} max={60} onChange={(size) => fx({ halftone: { ...e.halftone, size } }, "hts")} />
            <Slider label="Angle" value={e.halftone.angle} min={0} max={90} onChange={(angle) => fx({ halftone: { ...e.halftone, angle } }, "hta")} format={(v) => `${v}°`} />
            <ColorField label="Dots" value={e.halftone.color} onChange={(c) => c && fx({ halftone: { ...e.halftone, color: c } }, "htc")} />
          </>
        )}
      </Section>
      <div className={cx("px-3 py-3")}>
        <Button size="sm" variant="secondary" className="w-full" onClick={() => setCropOpen(true)}>
          <Crop size={13} /> Crop image…
        </Button>
      </div>
      {cropOpen && <CropDialog layer={layer} open={cropOpen} onClose={() => setCropOpen(false)} />}
    </>
  );
}
