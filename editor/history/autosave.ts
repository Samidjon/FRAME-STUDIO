"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditor } from "@/stores/editor-store";
import { useUi } from "@/stores/ui-store";
import { saveProject, writeRecovery } from "@/lib/storage/projects";
import type { Project } from "@/types/project";

/**
 * Debounced autosave to IndexedDB with a synchronous localStorage recovery
 * snapshot, so a crash or closed tab never loses more than a keystroke.
 * Emits `frame:project-saved` for the optional cloud mirror.
 */
export function useAutosave() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const queued = useRef(false);

  const current = (): Project | null => {
    const { project, doc } = useEditor.getState();
    return project && doc ? { ...project, doc } : null;
  };

  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const p = current();
    if (!p) return;
    if (saving.current) {
      queued.current = true;
      return;
    }
    saving.current = true;
    const rev = useEditor.getState().revision;
    useEditor.getState().setSaveStatus("saving");
    try {
      const saved = await saveProject(p);
      // Only mark clean if nothing changed while saving.
      if (useEditor.getState().revision === rev) useEditor.getState().setSaveStatus("saved", saved.updatedAt);
      else useEditor.getState().setSaveStatus("dirty");
      window.dispatchEvent(new CustomEvent("frame:project-saved", { detail: { project: saved } }));
    } catch (e) {
      console.error("[autosave] failed", e);
      writeRecovery(p);
      useEditor.getState().setSaveStatus("error");
    } finally {
      saving.current = false;
      if (queued.current) {
        queued.current = false;
        void saveNow();
      }
    }
  }, []);

  useEffect(() => {
    let lastRecovery = 0;
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.revision === prev.revision || !s.project) return;
      if (s.saveStatus !== "dirty") return;
      const now = Date.now();
      if (now - lastRecovery > 400) {
        lastRecovery = now;
        const p = current();
        if (p) writeRecovery({ ...p, updatedAt: now });
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveNow(), useUi.getState().autosaveDelay);
    });
    const beforeUnload = (e: BeforeUnloadEvent) => {
      const st = useEditor.getState().saveStatus;
      const p = current();
      if (p && (st === "dirty" || st === "saving" || st === "error")) {
        writeRecovery({ ...p, updatedAt: Date.now() });
        if (st === "error") {
          e.preventDefault();
          e.returnValue = "";
        }
      }
    };
    const hidden = () => document.visibilityState === "hidden" && useEditor.getState().saveStatus === "dirty" && void saveNow();
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [saveNow]);

  return saveNow;
}
