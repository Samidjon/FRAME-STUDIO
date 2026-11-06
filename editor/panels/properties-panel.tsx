"use client";

import { useState } from "react";
import { Group, Ungroup } from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import { Button, ColorField, IconButton, NumberField, Toggle } from "@/components/shared/ui";
import { AlignBar, LayerActionsBar, TransformSection } from "./common-properties";
import { Row, Section } from "./section";
import { TextProperties } from "@/editor/typography/text-properties";
import { ImageProperties } from "@/editor/images/image-properties";
import { ShapeProperties, TextureProperties } from "@/editor/shapes/shape-properties";
import { GridSettingsPanel } from "@/editor/grid/grid-settings";
import { SmartResizeDialog } from "@/editor/resize/smart-resize-dialog";
import { FORMAT_PRESETS } from "@/types/project";

const TYPE_LABEL = { text: "Text", image: "Image", shape: "Shape", texture: "Texture" } as const;

function DocumentProperties() {
  const doc = useEditor((s) => s.doc)!;
  const setDoc = useEditor((s) => s.setDoc);
  const [resizeOpen, setResizeOpen] = useState(false);
  const preset = FORMAT_PRESETS.find((p) => p.width === doc.width && p.height === doc.height);
  return (
    <>
      <Section index="01" title="Document">
        <div className="font-display text-sm font-semibold">{preset?.label ?? "Custom size"}</div>
        <Row>
          <NumberField label="W" value={doc.width} min={16} max={10000} onChange={(width) => useEditor.getState().resizeDocument(Math.round(width), doc.height)} suffix="px" />
          <NumberField label="H" value={doc.height} min={16} max={10000} onChange={(height) => useEditor.getState().resizeDocument(doc.width, Math.round(height))} suffix="px" />
        </Row>
        <Button size="sm" variant="secondary" onClick={() => setResizeOpen(true)}>
          Smart resize…
        </Button>
      </Section>
      <Section index="02" title="Background">
        <ColorField label="Background" value={doc.background.color} onChange={(color) => color && setDoc((d) => ({ ...d, background: { ...d.background, color } }), { key: "bg" })} />
        <Toggle label="Transparent background" checked={doc.background.transparent} onChange={(transparent) => setDoc((d) => ({ ...d, background: { ...d.background, transparent } }))} />
      </Section>
      <GridSettingsPanel index="03" />
      <Section index="04" title="Guides" defaultOpen={doc.guides.length > 0}>
        <p className="text-[11px] text-subtle">Drag from the rulers to create guides. Drag a guide off the page or double-click it to remove.</p>
        {doc.guides.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setDoc((d) => ({ ...d, guides: [] }))}>
            Clear {doc.guides.length} guide{doc.guides.length > 1 ? "s" : ""}
          </Button>
        )}
      </Section>
      {resizeOpen && <SmartResizeDialog open={resizeOpen} onClose={() => setResizeOpen(false)} />}
    </>
  );
}

export function PropertiesPanel() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const group = useEditor((s) => s.group);
  const ungroup = useEditor((s) => s.ungroup);
  if (!doc) return null;
  const layers = doc.layers.filter((l) => selection.includes(l.id));
  const single = layers.length === 1 ? layers[0] : null;
  const grouped = layers.length > 1 && layers.every((l) => l.groupId && l.groupId === layers[0].groupId);

  return (
    <aside aria-label="Properties" className="scroll-thin flex h-full w-[272px] shrink-0 flex-col overflow-y-auto border-l border-line bg-raised" data-testid="properties-panel">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="label-mono">Properties</span>
          <span className="truncate text-[12px] font-medium">{single ? single.name : layers.length > 1 ? `${layers.length} layers` : "Document"}</span>
        </div>
        {layers.length > 0 && <LayerActionsBar ids={selection} />}
      </div>
      {!layers.length && <DocumentProperties />}
      {single && (
        <div key={single.id}>
          <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-subtle">{TYPE_LABEL[single.type]}{single.type === "shape" ? ` · ${single.shape}` : ""}</span>
            <span className="font-mono text-[9px] text-subtle">{single.id.slice(-6)}</span>
          </div>
          <TransformSection layer={single} />
          {single.type === "text" && <TextProperties layer={single} />}
          {single.type === "image" && <ImageProperties layer={single} />}
          {single.type === "shape" && !single.brandLocked && <ShapeProperties layer={single} />}
          {single.brandLocked && (
            <p className="border-b border-line px-3 py-3 text-[11px] leading-snug text-muted" data-testid="brand-note">
              This is the Senitukang logo. You can move, resize and rotate it, but it always stays on the design.
            </p>
          )}
          {single.type === "texture" && <TextureProperties layer={single} />}
        </div>
      )}
      {layers.length > 1 && (
        <>
          <Section index="01" title="Arrange">
            <AlignBar count={layers.length} />
            <div className="flex gap-1">
              <IconButton size="sm" label="Group" shortcut="Ctrl+G" onClick={() => group(selection)} disabled={grouped}><Group size={14} /></IconButton>
              <IconButton size="sm" label="Ungroup" shortcut="Ctrl+Shift+G" onClick={() => ungroup(selection)} disabled={!layers.some((l) => l.groupId)}><Ungroup size={14} /></IconButton>
            </div>
          </Section>
          <Section index="02" title="Opacity">
            <input
              type="range"
              className="fs-range"
              aria-label="Opacity of selection"
              min={0}
              max={100}
              value={Math.round((layers.reduce((s, l) => s + l.opacity, 0) / layers.length) * 100)}
              onChange={(e) => useEditor.getState().updateLayers(selection, (l) => ({ ...l, opacity: Number(e.target.value) / 100 }), { key: "multi-o" })}
            />
          </Section>
        </>
      )}
    </aside>
  );
}
