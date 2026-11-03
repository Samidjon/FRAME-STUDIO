"use client";

import type { ShapeLayer, TextureLayer } from "@/types/layer";
import { useEditor } from "@/stores/editor-store";
import { ColorField, Segmented, Select, Slider } from "@/components/shared/ui";
import { Section } from "@/editor/panels/section";
import { TEXTURES } from "@/core/rendering/textures";

export function ShapeProperties({ layer }: { layer: ShapeLayer }) {
  const update = useEditor((s) => s.updateLayer);
  const set = (patch: Partial<ShapeLayer>, key?: string) => update(layer.id, patch, key ? { key: `${key}-${layer.id}` } : undefined);
  const isLine = layer.shape === "line";
  return (
    <>
      <Section index="02" title={isLine ? "Line" : "Shape"}>
        {!isLine && (
          <>
            <div className="text-[11px] text-muted">Fill</div>
            <ColorField label="Fill" value={layer.fill} allowNone onChange={(fill) => set({ fill, fillRole: "none" }, "fill")} />
          </>
        )}
        <div className="text-[11px] text-muted">{isLine ? "Colour" : "Stroke"}</div>
        <ColorField label="Stroke" value={layer.stroke} allowNone={!isLine} onChange={(stroke) => set({ stroke, strokeRole: "none", strokeWidth: stroke && !layer.strokeWidth && !isLine ? 4 : layer.strokeWidth }, "stroke")} />
        {isLine ? (
          <Slider label="Thickness" value={layer.height} min={0.5} max={Math.max(40, layer.height * 2)} step={0.5} onChange={(height) => set({ height }, "th")} format={(v) => `${v}px`} />
        ) : (
          layer.stroke && <Slider label="Stroke width" value={layer.strokeWidth} min={0} max={Math.max(40, layer.strokeWidth * 2)} step={0.5} onChange={(strokeWidth) => set({ strokeWidth }, "sw")} format={(v) => `${v}px`} />
        )}
        <Select
          label="Stroke style"
          value={layer.dash?.length ? (layer.dash[0] > layer.dash[1] ? "dashed" : "dotted") : "solid"}
          options={[
            { value: "solid", label: "Solid" },
            { value: "dashed", label: "Dashed" },
            { value: "dotted", label: "Dotted" },
          ]}
          onChange={(v) => {
            const w = isLine ? layer.height : Math.max(1, layer.strokeWidth);
            set({ dash: v === "solid" ? null : v === "dashed" ? [w * 4, w * 2] : [w * 0.01, w * 2] });
          }}
        />
        {layer.shape === "rect" && <Slider label="Corner radius" value={layer.cornerRadius} min={0} max={Math.round(Math.min(layer.width, layer.height) / 2)} onChange={(cornerRadius) => set({ cornerRadius }, "cr")} />}
        {(layer.shape === "polygon" || layer.shape === "star") && <Slider label={layer.shape === "star" ? "Points" : "Sides"} value={layer.sides} min={3} max={24} onChange={(sides) => set({ sides }, "sides")} />}
        {layer.shape === "star" && <Slider label="Inner radius" value={Math.round(layer.innerRatio * 100)} min={10} max={95} onChange={(v) => set({ innerRatio: v / 100 }, "inner")} format={(v) => `${v}%`} />}
        {(layer.shape === "circle" || layer.shape === "ellipse") && (
          <Segmented
            value={layer.shape}
            onChange={(shape) => set({ shape, ...(shape === "circle" ? { height: layer.width } : {}) })}
            options={[
              { value: "circle", label: "Circle" },
              { value: "ellipse", label: "Ellipse" },
            ]}
          />
        )}
      </Section>
    </>
  );
}

export function TextureProperties({ layer }: { layer: TextureLayer }) {
  const update = useEditor((s) => s.updateLayer);
  const set = (patch: Partial<TextureLayer>, key?: string) => update(layer.id, patch, key ? { key: `${key}-${layer.id}` } : undefined);
  return (
    <Section index="02" title="Texture">
      <Select label="Texture" value={layer.texture} options={TEXTURES.map((t) => ({ value: t.id, label: t.label }))} onChange={(texture) => set({ texture, name: TEXTURES.find((t) => t.id === texture)!.label })} />
      <ColorField label="Colour" value={layer.color} onChange={(color) => color && set({ color }, "col")} />
      <Slider label="Scale" value={layer.scale} min={0.25} max={6} step={0.05} onChange={(scale) => set({ scale }, "scale")} format={(v) => `${v.toFixed(2)}×`} />
      <button className="label-mono self-start hover:text-fg" onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}>
        ↻ Reseed pattern
      </button>
    </Section>
  );
}
