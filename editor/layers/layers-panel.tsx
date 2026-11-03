"use client";

import { useState } from "react";
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Eye, EyeOff, Image as ImageIcon, Lock, Shapes, Sparkles, Type, Unlock } from "lucide-react";
import type { Layer } from "@/types/layer";
import { useEditor } from "@/stores/editor-store";
import { IconButton, cx } from "@/components/shared/ui";

const ICON = { text: Type, image: ImageIcon, shape: Shapes, texture: Sparkles };

/** Layer list, top-most first. Drag rows to reorder, double-click to rename. */
export function LayersPanel() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const update = useEditor((s) => s.updateLayer);
  const reorder = useEditor((s) => s.reorder);
  const moveTo = useEditor((s) => s.moveLayerToIndex);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  if (!doc) return null;
  const rows = [...doc.layers].reverse();

  const groupColor = (gid: string | null | undefined) => {
    if (!gid) return null;
    let h = 0;
    for (const c of gid) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h} 60% 55%)`;
  };

  return (
    <div className="flex h-full flex-col" data-testid="layers-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="label-mono">{doc.layers.length} layers</span>
        <div className="flex">
          <IconButton size="sm" label="Bring to front" disabled={!selection.length} onClick={() => reorder(selection, "front")}><ArrowUpToLine size={13} /></IconButton>
          <IconButton size="sm" label="Move up" disabled={!selection.length} onClick={() => reorder(selection, "up")}><ArrowUp size={13} /></IconButton>
          <IconButton size="sm" label="Move down" disabled={!selection.length} onClick={() => reorder(selection, "down")}><ArrowDown size={13} /></IconButton>
          <IconButton size="sm" label="Send to back" disabled={!selection.length} onClick={() => reorder(selection, "back")}><ArrowDownToLine size={13} /></IconButton>
        </div>
      </div>
      <ul role="listbox" aria-label="Layers" aria-multiselectable className="scroll-thin min-h-0 flex-1 overflow-y-auto py-1">
        {rows.map((l: Layer, i) => {
          const Icon = ICON[l.type];
          const sel = selection.includes(l.id);
          const gc = groupColor(l.groupId);
          return (
            <li
              key={l.id}
              role="option"
              aria-selected={sel}
              tabIndex={0}
              draggable={renaming !== l.id}
              data-testid="layer-row"
              onDragStart={(e) => {
                setDragId(l.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIdx(i);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== l.id) moveTo(dragId, doc.layers.length - 1 - i);
                setDragId(null);
                setOverIdx(null);
              }}
              onClick={(e) => select([l.id], e.shiftKey || e.metaKey || e.ctrlKey ? "toggle" : "replace")}
              onDoubleClick={() => setRenaming(l.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setRenaming(l.id);
                if (e.key === " ") {
                  e.preventDefault();
                  select([l.id]);
                }
              }}
              className={cx(
                "group relative flex h-8 cursor-default items-center gap-2 px-3 text-[12px] outline-none",
                sel ? "bg-fg text-bg" : "hover:bg-sunken focus-visible:bg-sunken",
                !l.visible && "opacity-45",
                overIdx === i && dragId && "shadow-[inset_0_2px_0_var(--accent)]",
              )}
            >
              {gc && <span className="absolute bottom-1 left-0 top-1 w-[2px]" style={{ background: gc }} aria-label="Grouped" />}
              <Icon size={12} className="shrink-0 opacity-70" />
              {renaming === l.id ? (
                <input
                  autoFocus
                  aria-label="Layer name"
                  defaultValue={l.name}
                  className="h-6 min-w-0 flex-1 border border-accent bg-bg px-1 text-[12px] text-fg outline-none"
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    update(l.id, { name: e.target.value.trim() || l.name });
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
              )}
              <button
                aria-label={l.locked ? `Unlock ${l.name}` : `Lock ${l.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  update(l.id, { locked: !l.locked });
                }}
                className={cx("shrink-0", l.locked ? "opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100 focus:opacity-100")}
              >
                {l.locked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
              <button
                aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  update(l.id, { visible: !l.visible });
                }}
                className={cx("shrink-0", !l.visible ? "opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100 focus:opacity-100")}
              >
                {l.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </li>
          );
        })}
        {!rows.length && (
          <li className="px-3 py-8 text-center">
            <div className="label-mono">Empty canvas</div>
            <p className="mt-1 text-[11px] text-subtle">Add text, images or shapes from the toolbar.</p>
          </li>
        )}
      </ul>
    </div>
  );
}
