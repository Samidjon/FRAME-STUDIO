"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "@/stores/editor-store";
import type { TextLayer } from "@/types/layer";

/**
 * In-place text editing: a transparent textarea aligned with the text box,
 * using the same font metrics. The canvas hides the glyphs while editing.
 */
export function TextEditorOverlay({ layerId }: { layerId: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const layer = useEditor((s) => s.doc?.layers.find((l) => l.id === layerId)) as TextLayer | undefined;
  const viewport = useEditor((s) => s.viewport);
  const update = useEditor((s) => s.updateLayer);
  const keyRef = useRef(`text-${layerId}-${Date.now()}`);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  if (!layer || layer.type !== "text") return null;
  const z = viewport.zoom;
  const close = () => useEditor.getState().setEditingText(null);

  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      data-testid="text-editor"
      spellCheck={false}
      value={layer.text}
      onChange={(e) => update(layer.id, { text: e.target.value, name: e.target.value.split("\n")[0].slice(0, 28) || "Text" }, { key: keyRef.current })}
      onBlur={close}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          close();
        }
      }}
      className="absolute z-20 m-0 resize-none overflow-hidden border-0 bg-transparent p-0 outline outline-1 outline-accent"
      style={{
        left: viewport.panX + layer.x * z,
        top: viewport.panY + layer.y * z,
        width: Math.max(20, (layer.vertical ? layer.fontSize * 1.2 : layer.width) * z),
        height: Math.max(layer.height, layer.fontSize * layer.lineHeight) * z + 4,
        transform: `rotate(${layer.rotation}deg)`,
        transformOrigin: "0 0",
        fontFamily: `"${layer.fontFamily}", Inter, sans-serif`,
        fontSize: layer.fontSize * z,
        fontWeight: layer.fontWeight,
        fontStyle: layer.italic ? "italic" : "normal",
        lineHeight: `${layer.fontSize * layer.lineHeight * z}px`,
        letterSpacing: `${(layer.letterSpacing / 1000) * layer.fontSize * z}px`,
        wordSpacing: `${(layer.wordSpacing / 1000) * layer.fontSize * z}px`,
        textAlign: layer.align,
        textTransform: layer.uppercase ? "uppercase" : "none",
        color: layer.fill,
        caretColor: "#FF4D00",
        padding: layer.backgroundPadding * z,
        writingMode: layer.vertical ? "vertical-rl" : undefined,
        textOrientation: layer.vertical ? "upright" : undefined,
        opacity: Math.max(0.6, layer.opacity),
      }}
    />
  );
}
