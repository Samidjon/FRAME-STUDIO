"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/core/document/factory";

export type ThemePref = "light" | "dark" | "system";

export interface Toast {
  id: string;
  kind: "info" | "success" | "error";
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

interface UiState {
  theme: ThemePref;
  editorTheme: "dark" | "light" | "match";
  accent: string;
  reduceMotion: boolean;
  showRulers: boolean;
  nudge: number;
  autosaveDelay: number;
  toasts: Toast[];
  favoriteTemplates: string[];
  setTheme: (t: ThemePref) => void;
  setEditorTheme: (t: UiState["editorTheme"]) => void;
  setAccent: (c: string) => void;
  setPref: (patch: Partial<Pick<UiState, "reduceMotion" | "showRulers" | "nudge" | "autosaveDelay">>) => void;
  toggleFavoriteTemplate: (id: string) => void;
  toast: (t: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "light",
      editorTheme: "dark",
      accent: "#FF4D00",
      reduceMotion: false,
      showRulers: true,
      nudge: 10,
      autosaveDelay: 800,
      toasts: [],
      favoriteTemplates: [],
      setTheme: (theme) => set({ theme }),
      setEditorTheme: (editorTheme) => set({ editorTheme }),
      setAccent: (accent) => set({ accent }),
      setPref: (patch) => set(patch),
      toggleFavoriteTemplate: (id) => {
        const f = get().favoriteTemplates;
        set({ favoriteTemplates: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] });
      },
      toast: (t) => {
        const id = uid("t");
        set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
        setTimeout(() => get().dismiss(id), t.kind === "error" ? 7000 : 3800);
        return id;
      },
      dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
    }),
    {
      name: "frame-ui",
      partialize: (s) => ({
        theme: s.theme,
        editorTheme: s.editorTheme,
        accent: s.accent,
        reduceMotion: s.reduceMotion,
        showRulers: s.showRulers,
        nudge: s.nudge,
        autosaveDelay: s.autosaveDelay,
        favoriteTemplates: s.favoriteTemplates,
      }),
    },
  ),
);

/** Imperative helper usable outside React components. */
export const toast = (t: Omit<Toast, "id">) => useUi.getState().toast(t);
