"use client";

import { AlignCenter, AlignJustify, AlignLeft, AlignRight, CaseUpper, Italic, Columns2 } from "lucide-react";
import type { TextLayer, TextRole } from "@/types/layer";
import { useEditor } from "@/stores/editor-store";
import { ColorField, IconButton, NumberField, Segmented, Select, Slider, Toggle, cx } from "@/components/shared/ui";
import { Row, Section } from "@/editor/panels/section";
import { FontPicker } from "./font-picker";
import { findFont, loadFont, nearestWeight } from "@/lib/fonts/catalog";
import { TEXT_ROLE_SCALE } from "@/core/document/factory";

const WEIGHT_NAMES: Record<number, string> = { 100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra Bold", 900: "Black" };

export const TEXT_STYLES: { role: TextRole; label: string }[] = [
  { role: "display", label: "Display" },
  { role: "heading", label: "Heading" },
  { role: "subheading", label: "Subheading" },
  { role: "body", label: "Body" },
  { role: "caption", label: "Caption" },
  { role: "metadata", label: "Metadata" },
];

/** Apply a text-style preset to one layer only — other text blocks are untouched. */
export function applyTextStyle(l: TextLayer, role: TextRole, docW: number, docH: number): Partial<TextLayer> {
  const r = TEXT_ROLE_SCALE[role];
  const base = Math.min(docW, docH * 0.8);
  const fontFamily = role === "metadata" ? "JetBrains Mono" : role === "body" || role === "caption" ? "Inter" : l.fontFamily === "JetBrains Mono" || l.fontFamily === "Inter" ? "Space Grotesk" : l.fontFamily;
  void loadFont(fontFamily);
  return {
    role,
    fontFamily,
    fontSize: Math.max(6, Math.round(base * r.size)),
    fontWeight: nearestWeight(fontFamily, r.weight),
    lineHeight: r.lineHeight,
    letterSpacing: r.tracking,
    uppercase: r.uppercase,
  };
}

export function TextProperties({ layer }: { layer: TextLayer }) {
  const update = useEditor((s) => s.updateLayer);
  const doc = useEditor((s) => s.doc)!;
  const set = (patch: Partial<TextLayer>, key?: string) => update(layer.id, patch, key ? { key: `${key}-${layer.id}` } : undefined);
  const font = findFont(layer.fontFamily);
  const weights = font?.weights ?? [300, 400, 500, 600, 700];

  return (
    <>
      <Section index="02" title="Text style">
        <div className="grid grid-cols-3 gap-1">
          {TEXT_STYLES.map((s) => (
            <button
              key={s.role}
              onClick={() => set(applyTextStyle(layer, s.role, doc.width, doc.height))}
              className={cx("h-7 border text-[11px] transition-colors", layer.role === s.role ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-line-strong hover:text-fg")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Section>
      <Section index="03" title="Typography">
        <FontPicker
          value={layer.fontFamily}
          onChange={(fontFamily) => {
            void loadFont(fontFamily);
            set({ fontFamily, fontWeight: nearestWeight(fontFamily, layer.fontWeight), italic: layer.italic && !!findFont(fontFamily)?.italic });
          }}
        />
        <Row>
          <Select
            value={String(nearestWeight(layer.fontFamily, layer.fontWeight))}
            options={weights.map((w) => ({ value: String(w), label: `${WEIGHT_NAMES[w] ?? w} ${w}` }))}
            onChange={(v) => set({ fontWeight: Number(v) })}
          />
          <NumberField label="Sz" value={layer.fontSize} min={1} max={4000} step={1} precision={1} onChange={(fontSize) => set({ fontSize }, "fs")} suffix="px" />
        </Row>
        <div className="flex items-center gap-1">
          <Segmented
            value={layer.align}
            onChange={(align) => set({ align })}
            options={[
              { value: "left", label: <AlignLeft size={13} />, title: "Align left" },
              { value: "center", label: <AlignCenter size={13} />, title: "Align centre" },
              { value: "right", label: <AlignRight size={13} />, title: "Align right" },
              { value: "justify", label: <AlignJustify size={13} />, title: "Justify" },
            ]}
          />
          <IconButton size="sm" label="Italic" active={layer.italic} disabled={font ? !font.italic : false} onClick={() => set({ italic: !layer.italic })}>
            <Italic size={13} />
          </IconButton>
          <IconButton size="sm" label="Uppercase" active={layer.uppercase} onClick={() => set({ uppercase: !layer.uppercase })}>
            <CaseUpper size={14} />
          </IconButton>
          <IconButton size="sm" label="Vertical typography" active={layer.vertical} onClick={() => set({ vertical: !layer.vertical })}>
            <Columns2 size={13} />
          </IconButton>
        </div>
        <Slider label="Line height" value={layer.lineHeight} min={0.6} max={3} step={0.01} onChange={(lineHeight) => set({ lineHeight }, "lh")} format={(v) => v.toFixed(2)} />
        <Slider label="Letter spacing" value={layer.letterSpacing} min={-150} max={800} step={1} onChange={(letterSpacing) => set({ letterSpacing }, "ls")} format={(v) => `${v}‰`} />
        <Slider label="Word spacing" value={layer.wordSpacing} min={-200} max={2000} step={5} onChange={(wordSpacing) => set({ wordSpacing }, "ws")} format={(v) => `${v}‰`} />
        <Toggle label="Auto height" checked={layer.autoHeight} onChange={(autoHeight) => set({ autoHeight })} />
      </Section>
      <Section index="04" title="Colour">
        <ColorField label="Text" value={layer.fill} onChange={(fill) => fill && set({ fill, fillRole: "none" }, "fill")} />
        <div className="text-[11px] text-muted">Background</div>
        <ColorField label="Background" value={layer.backgroundColor} allowNone onChange={(backgroundColor) => set({ backgroundColor, backgroundPadding: backgroundColor && !layer.backgroundPadding ? Math.round(layer.fontSize * 0.25) : layer.backgroundPadding }, "bg")} />
        {layer.backgroundColor && <Slider label="Padding" value={layer.backgroundPadding} min={0} max={Math.max(40, layer.fontSize)} onChange={(backgroundPadding) => set({ backgroundPadding }, "pad")} />}
      </Section>
      <Section index="05" title="Stroke & shadow" defaultOpen={false}>
        <ColorField label="Stroke" value={layer.stroke} allowNone onChange={(stroke) => set({ stroke, strokeWidth: stroke && !layer.strokeWidth ? Math.max(1, Math.round(layer.fontSize / 40)) : layer.strokeWidth })} />
        {layer.stroke && <Slider label="Stroke width" value={layer.strokeWidth} min={0} max={Math.max(20, layer.fontSize / 6)} step={0.5} onChange={(strokeWidth) => set({ strokeWidth }, "sw")} />}
        <Toggle label="Text shadow" checked={layer.shadow.enabled} onChange={(enabled) => set({ shadow: { ...layer.shadow, enabled } })} />
        {layer.shadow.enabled && (
          <>
            <ColorField label="Shadow" value={layer.shadow.color.startsWith("#") ? layer.shadow.color : "#000000"} onChange={(color) => color && set({ shadow: { ...layer.shadow, color } }, "shc")} />
            <Slider label="Blur" value={layer.shadow.blur} min={0} max={100} onChange={(blur) => set({ shadow: { ...layer.shadow, blur } }, "shb")} />
            <Row>
              <NumberField label="X" value={layer.shadow.offsetX} onChange={(offsetX) => set({ shadow: { ...layer.shadow, offsetX } }, "shx")} />
              <NumberField label="Y" value={layer.shadow.offsetY} onChange={(offsetY) => set({ shadow: { ...layer.shadow, offsetY } }, "shy")} />
            </Row>
          </>
        )}
      </Section>
    </>
  );
}
