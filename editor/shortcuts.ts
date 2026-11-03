"use client";

import { useEffect } from "react";
import { useEditor } from "@/stores/editor-store";
import { useUi } from "@/stores/ui-store";
import { addShape, addText, copySelection, cutSelection, nudge, paste, toggleLock, toggleVisibility } from "./actions";

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = IS_MAC ? "⌘" : "Ctrl+";

/** True when the keyboard focus is somewhere typing should win over shortcuts. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function useEditorShortcuts(handlers: { save: () => void; exportOpen: () => void }) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      if (!st.doc) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();

      // Save works everywhere, even while typing.
      if (mod && k === "s") {
        e.preventDefault();
        handlers.save();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        st.setSpacePan(true);
        return;
      }
      const sel = st.selection;
      if (mod && k === "z" && !e.shiftKey) {
        e.preventDefault();
        st.undo();
      } else if ((mod && k === "z" && e.shiftKey) || (mod && k === "y")) {
        e.preventDefault();
        st.redo();
      } else if (mod && k === "d") {
        e.preventDefault();
        st.duplicateLayers(sel);
      } else if (mod && k === "a") {
        e.preventDefault();
        st.selectAll();
      } else if (mod && k === "g") {
        e.preventDefault();
        if (e.shiftKey) st.ungroup(sel);
        else st.group(sel);
      } else if (mod && k === "c") {
        copySelection();
      } else if (mod && k === "x") {
        e.preventDefault();
        cutSelection();
      } else if (mod && k === "v") {
        e.preventDefault();
        paste();
      } else if (mod && k === "l") {
        e.preventDefault();
        toggleLock(sel);
      } else if (mod && e.shiftKey && k === "h") {
        e.preventDefault();
        toggleVisibility(sel);
      } else if (mod && k === "e") {
        e.preventDefault();
        handlers.exportOpen();
      } else if (mod && (k === "]" || k === "}")) {
        e.preventDefault();
        st.reorder(sel, e.shiftKey ? "front" : "up");
      } else if (mod && (k === "[" || k === "{")) {
        e.preventDefault();
        st.reorder(sel, e.shiftKey ? "back" : "down");
      } else if (mod && (k === "0")) {
        e.preventDefault();
        st.fitToScreen();
      } else if (mod && k === "1") {
        e.preventDefault();
        st.zoomAt(1);
      } else if (mod && (k === "=" || k === "+")) {
        e.preventDefault();
        st.zoomAt(st.viewport.zoom * 1.25);
      } else if (mod && k === "-") {
        e.preventDefault();
        st.zoomAt(st.viewport.zoom / 1.25);
      } else if (k === "delete" || k === "backspace") {
        if (sel.length) {
          e.preventDefault();
          st.deleteLayers(sel);
        }
      } else if (k === "escape") {
        if (st.preview) st.setPreview(false);
        else st.clearSelection();
      } else if (k.startsWith("arrow") && sel.length) {
        e.preventDefault();
        const step = e.shiftKey ? useUi.getState().nudge : 1;
        nudge(k === "arrowleft" ? -step : k === "arrowright" ? step : 0, k === "arrowup" ? -step : k === "arrowdown" ? step : 0);
      } else if (!mod && !e.altKey) {
        if (k === "v") st.setTab("select");
        else if (k === "t") addText("heading");
        else if (k === "r") addShape("rect");
        else if (k === "o") addShape("ellipse");
        else if (k === "l") addShape("line");
        else if (k === "'" || k === "g") st.setGrid({ visible: !st.doc.grid.visible }, { history: false });
        else if (k === "p") st.setPreview(!st.preview);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") useEditor.getState().setSpacePan(false);
    };
    const blur = () => useEditor.getState().setSpacePan(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [handlers]);
}
