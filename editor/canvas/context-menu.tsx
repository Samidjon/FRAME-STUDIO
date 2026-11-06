"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "@/stores/editor-store";
import { copySelection, cutSelection, paste, toggleLock, toggleVisibility } from "@/editor/actions";
import { cx } from "@/components/shared/ui";
import { MOD } from "@/editor/shortcuts";

export interface MenuState {
  x: number;
  y: number;
  layerId: string;
}

type Item = { label: string; shortcut?: string; run: () => void; danger?: boolean; disabled?: boolean } | "sep";

export function ContextMenu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ed = useEditor.getState();
  const sel = ed.selection.length ? ed.selection : [state.layerId];
  const layers = ed.doc?.layers.filter((l) => sel.includes(l.id)) ?? [];
  const grouped = layers.some((l) => l.groupId);
  const locked = layers.every((l) => l.locked);
  const hidden = layers.every((l) => !l.visible);
  const onlyBrand = layers.length > 0 && layers.every((l) => l.brandLocked);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const items: Item[] = [
    { label: "Cut", shortcut: `${MOD}X`, run: cutSelection, disabled: onlyBrand },
    { label: "Copy", shortcut: `${MOD}C`, run: copySelection },
    { label: "Paste", shortcut: `${MOD}V`, run: paste },
    { label: "Duplicate", shortcut: `${MOD}D`, run: () => ed.duplicateLayers(sel) },
    "sep",
    { label: "Bring to Front", shortcut: `${MOD}⇧]`, run: () => ed.reorder(sel, "front"), disabled: onlyBrand },
    { label: "Bring Forward", shortcut: `${MOD}]`, run: () => ed.reorder(sel, "up"), disabled: onlyBrand },
    { label: "Send Backward", shortcut: `${MOD}[`, run: () => ed.reorder(sel, "down"), disabled: onlyBrand },
    { label: "Send to Back", shortcut: `${MOD}⇧[`, run: () => ed.reorder(sel, "back"), disabled: onlyBrand },
    "sep",
    { label: "Group", shortcut: `${MOD}G`, run: () => ed.group(sel), disabled: sel.length < 2 },
    { label: "Ungroup", shortcut: `${MOD}⇧G`, run: () => ed.ungroup(sel), disabled: !grouped },
    { label: "Center on Page", run: () => (ed.align("hcenter", true), ed.align("vcenter", true)) },
    { label: locked ? "Unlock" : "Lock", shortcut: `${MOD}L`, run: () => toggleLock(sel), disabled: onlyBrand },
    { label: hidden ? "Show" : "Hide", shortcut: `${MOD}⇧H`, run: () => toggleVisibility(sel), disabled: onlyBrand },
    "sep",
    { label: "Delete", shortcut: "Del", run: () => ed.deleteLayers(sel), danger: true, disabled: onlyBrand },
  ];

  // Keep menu inside the container.
  const left = Math.min(state.x, (ref.current?.parentElement?.clientWidth ?? 9999) - 220);
  const top = Math.min(state.y, (ref.current?.parentElement?.clientHeight ?? 9999) - 420);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Layer actions"
      className="absolute z-40 w-[210px] border border-line-strong bg-bg py-1 text-fg shadow-[0_18px_50px_-18px_rgba(0,0,0,0.5)] animate-fade"
      style={{ left: Math.max(4, left), top: Math.max(4, top) }}
      onKeyDown={(e) => {
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          btns[(i + 1) % btns.length]?.focus();
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          btns[(i - 1 + btns.length) % btns.length]?.focus();
        }
      }}
    >
      {items.map((it, i) =>
        it === "sep" ? (
          <div key={i} className="my-1 border-t border-line" />
        ) : (
          <button
            key={it.label}
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              it.run();
              onClose();
            }}
            className={cx(
              "flex h-7 w-full items-center justify-between px-3 text-left text-[12px] outline-none hover:bg-sunken focus:bg-sunken disabled:opacity-35",
              it.danger && "text-danger",
            )}
          >
            <span>{it.label}</span>
            {it.shortcut && <span className="font-mono text-[10px] text-subtle">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
