"use client";

import { create } from "zustand";
import type { Layer, ShapeKind } from "@/types/layer";
import type { GridSettings, Guide, Viewport } from "@/types/canvas";
import type { DesignDocument, Project } from "@/types/project";
import { cloneLayer, uid } from "@/core/document/factory";
import { alignLayers, distributeLayers, layerBounds, unionBounds, type AlignMode } from "@/core/geometry/transform";
import { textLayoutFor } from "@/core/rendering/draw";

export type ToolTab = "select" | "text" | "image" | "shapes" | "background" | "grid" | "assets" | "templates" | "textures" | "layers" | "styles";
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const HISTORY_LIMIT = 120;
const COALESCE_MS = 700;

export interface ChangeOptions {
  /** false: transient (e.g. during drag) — no history entry. */
  history?: boolean;
  /** Coalesce consecutive changes with the same key into one undo step. */
  key?: string;
}

interface EditorState {
  project: Project | null;
  doc: DesignDocument | null;
  selection: string[];
  editingTextId: string | null;
  tab: ToolTab;
  shapeKind: ShapeKind;
  viewport: Viewport;
  stageSize: { width: number; height: number };
  past: DesignDocument[];
  future: DesignDocument[];
  lastKey: string | null;
  lastKeyAt: number;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  preview: boolean;
  spacePan: boolean;
  smartGuides: { x: number[]; y: number[] };
  revision: number;

  load: (p: Project) => void;
  unload: () => void;
  setProjectMeta: (patch: Partial<Omit<Project, "doc">>) => void;
  setDoc: (fn: (d: DesignDocument) => DesignDocument, opts?: ChangeOptions) => void;
  checkpoint: () => void;
  updateLayer: (id: string, patch: Partial<Layer>, opts?: ChangeOptions) => void;
  updateLayers: (ids: string[], fn: (l: Layer) => Layer, opts?: ChangeOptions) => void;
  addLayer: (l: Layer, opts?: { select?: boolean; index?: number }) => void;
  addLayers: (ls: Layer[]) => void;
  deleteLayers: (ids: string[]) => void;
  duplicateLayers: (ids: string[]) => void;
  reorder: (ids: string[], dir: "up" | "down" | "front" | "back") => void;
  moveLayerToIndex: (id: string, index: number) => void;
  group: (ids: string[]) => void;
  ungroup: (ids: string[]) => void;
  align: (mode: AlignMode, toPage?: boolean) => void;
  distribute: (axis: "x" | "y") => void;
  select: (ids: string[], mode?: "replace" | "add" | "toggle") => void;
  selectAll: () => void;
  clearSelection: () => void;
  setEditingText: (id: string | null) => void;
  setTab: (t: ToolTab) => void;
  setShapeKind: (k: ShapeKind) => void;
  setViewport: (v: Partial<Viewport>) => void;
  setStageSize: (s: { width: number; height: number }) => void;
  fitToScreen: () => void;
  zoomAt: (zoom: number, center?: { x: number; y: number }) => void;
  setGrid: (patch: Partial<GridSettings>, opts?: ChangeOptions) => void;
  addGuide: (axis: Guide["axis"], position: number) => string;
  moveGuide: (id: string, position: number, opts?: ChangeOptions) => void;
  removeGuide: (id: string) => void;
  resizeDocument: (width: number, height: number, layers?: Layer[]) => void;
  undo: () => void;
  redo: () => void;
  setSaveStatus: (s: SaveStatus, at?: number) => void;
  setPreview: (v: boolean) => void;
  setSpacePan: (v: boolean) => void;
  setSmartGuides: (g: { x: number[]; y: number[] }) => void;
}

/** Selecting any member of a group selects the whole group. */
export function expandGroups(doc: DesignDocument, ids: string[]): string[] {
  const groups = new Set(doc.layers.filter((l) => ids.includes(l.id) && l.groupId).map((l) => l.groupId));
  if (!groups.size) return ids;
  return [...new Set([...ids, ...doc.layers.filter((l) => l.groupId && groups.has(l.groupId)).map((l) => l.id)])];
}

/** Keep auto-height text boxes in sync with their content. */
function syncTextBox(l: Layer): Layer {
  if (l.type !== "text" || typeof document === "undefined") return l;
  if (!l.autoHeight && !l.vertical) return l;
  const lay = textLayoutFor(l);
  const height = Math.max(1, Math.round(lay.height * 100) / 100);
  const width = l.vertical ? Math.max(1, Math.round(lay.width * 100) / 100) : l.width;
  return height === l.height && width === l.width ? l : { ...l, height, width };
}

export const useEditor = create<EditorState>((set, get) => {
  const pushHistory = (opts?: ChangeOptions) => {
    const s = get();
    if (!s.doc || opts?.history === false) return;
    const now = Date.now();
    if (opts?.key && s.lastKey === opts.key && now - s.lastKeyAt < COALESCE_MS) {
      set({ lastKeyAt: now });
      return;
    }
    set({ past: [...s.past.slice(-HISTORY_LIMIT + 1), s.doc], future: [], lastKey: opts?.key ?? null, lastKeyAt: now });
  };

  const commitDoc = (doc: DesignDocument) => {
    const ids = new Set(doc.layers.map((l) => l.id));
    const s = get();
    set({
      doc,
      selection: s.selection.filter((id) => ids.has(id)),
      editingTextId: s.editingTextId && ids.has(s.editingTextId) ? s.editingTextId : null,
      saveStatus: "dirty",
      revision: s.revision + 1,
    });
  };

  return {
    project: null,
    doc: null,
    selection: [],
    editingTextId: null,
    tab: "select",
    shapeKind: "rect",
    viewport: { zoom: 0.5, panX: 0, panY: 0 },
    stageSize: { width: 800, height: 600 },
    past: [],
    future: [],
    lastKey: null,
    lastKeyAt: 0,
    saveStatus: "idle",
    lastSavedAt: null,
    preview: false,
    spacePan: false,
    smartGuides: { x: [], y: [] },
    revision: 0,

    load: (p) => {
      set({
        project: p,
        doc: { ...p.doc, layers: p.doc.layers.map(syncTextBox) },
        selection: [],
        editingTextId: null,
        past: [],
        future: [],
        saveStatus: "saved",
        lastSavedAt: p.updatedAt,
        revision: 0,
      });
      get().fitToScreen();
    },
    unload: () => set({ project: null, doc: null, selection: [], past: [], future: [], saveStatus: "idle" }),
    setProjectMeta: (patch) => {
      const p = get().project;
      if (p) set({ project: { ...p, ...patch }, saveStatus: "dirty", revision: get().revision + 1 });
    },

    setDoc: (fn, opts) => {
      const d = get().doc;
      if (!d) return;
      pushHistory(opts);
      commitDoc(fn(d));
    },
    checkpoint: () => pushHistory({}),

    updateLayer: (id, patch, opts) => {
      get().setDoc((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? syncTextBox({ ...l, ...patch } as Layer) : l)) }), opts);
    },
    updateLayers: (ids, fn, opts) => {
      const set_ = new Set(ids);
      get().setDoc((d) => ({ ...d, layers: d.layers.map((l) => (set_.has(l.id) ? syncTextBox(fn(l)) : l)) }), opts);
    },
    addLayer: (l, opts) => {
      get().setDoc((d) => {
        const layers = [...d.layers];
        const layer = syncTextBox(l);
        if (opts?.index !== undefined) layers.splice(opts.index, 0, layer);
        else layers.push(layer);
        return { ...d, layers };
      });
      if (opts?.select !== false) set({ selection: [l.id] });
    },
    addLayers: (ls) => {
      get().setDoc((d) => ({ ...d, layers: [...d.layers, ...ls.map(syncTextBox)] }));
      set({ selection: ls.map((l) => l.id) });
    },
    deleteLayers: (ids) => {
      const d = get().doc;
      if (!d) return;
      const kill = new Set(ids.filter((id) => !d.layers.find((l) => l.id === id)?.locked));
      if (!kill.size) return;
      get().setDoc((doc) => ({ ...doc, layers: doc.layers.filter((l) => !kill.has(l.id)) }));
      set({ selection: [] });
    },
    duplicateLayers: (ids) => {
      const d = get().doc;
      if (!d || !ids.length) return;
      const offset = Math.round(Math.min(d.width, d.height) * 0.02);
      const groupMap = new Map<string, string>();
      const copies: Layer[] = [];
      const top = Math.max(...ids.map((id) => d.layers.findIndex((l) => l.id === id)));
      for (const l of d.layers.filter((x) => ids.includes(x.id))) {
        const c = cloneLayer(l, offset);
        c.name = `${l.name} copy`;
        if (l.groupId) {
          if (!groupMap.has(l.groupId)) groupMap.set(l.groupId, uid("grp"));
          c.groupId = groupMap.get(l.groupId)!;
        }
        c.locked = false;
        copies.push(c);
      }
      // insert copies right above the top-most original
      const out = d.layers.flatMap((l, i) => (i === top ? [l, ...copies] : [l]));
      get().setDoc((doc) => ({ ...doc, layers: out }));
      set({ selection: copies.map((c) => c.id) });
    },
    reorder: (ids, dir) => {
      get().setDoc((d) => {
        const sel = new Set(ids);
        let layers = [...d.layers];
        if (dir === "front") layers = [...layers.filter((l) => !sel.has(l.id)), ...layers.filter((l) => sel.has(l.id))];
        else if (dir === "back") layers = [...layers.filter((l) => sel.has(l.id)), ...layers.filter((l) => !sel.has(l.id))];
        else if (dir === "up") {
          for (let i = layers.length - 2; i >= 0; i--)
            if (sel.has(layers[i].id) && !sel.has(layers[i + 1].id)) [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]];
        } else {
          for (let i = 1; i < layers.length; i++)
            if (sel.has(layers[i].id) && !sel.has(layers[i - 1].id)) [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]];
        }
        return { ...d, layers };
      });
    },
    moveLayerToIndex: (id, index) => {
      get().setDoc((d) => {
        const layers = [...d.layers];
        const from = layers.findIndex((l) => l.id === id);
        if (from < 0) return d;
        const [l] = layers.splice(from, 1);
        layers.splice(Math.max(0, Math.min(layers.length, index)), 0, l);
        return { ...d, layers };
      });
    },
    group: (ids) => {
      if (ids.length < 2) return;
      const gid = uid("grp");
      get().updateLayers(ids, (l) => ({ ...l, groupId: gid }));
    },
    ungroup: (ids) => {
      get().updateLayers(ids, (l) => ({ ...l, groupId: null }));
    },
    align: (mode, toPage) => {
      const d = get().doc;
      const ids = get().selection;
      if (!d || !ids.length) return;
      const sel = d.layers.filter((l) => ids.includes(l.id) && !l.locked);
      const page = { x: 0, y: 0, width: d.width, height: d.height };
      // Groups align as a unit: move each group by the delta of its bounds.
      const units = new Map<string, Layer[]>();
      sel.forEach((l) => {
        const k = l.groupId ?? l.id;
        units.set(k, [...(units.get(k) ?? []), l]);
      });
      const target = toPage || units.size === 1 ? page : unionBounds(sel.map(layerBounds))!;
      const moved = new Map<string, Layer>();
      for (const members of units.values()) {
        const b = unionBounds(members.map(layerBounds))!;
        const proxy = { ...members[0], x: b.x, y: b.y, width: b.width, height: b.height, rotation: 0 } as Layer;
        const [aligned] = alignLayers([proxy], mode, target);
        const dx = aligned.x - proxy.x;
        const dy = aligned.y - proxy.y;
        members.forEach((m) => moved.set(m.id, { ...m, x: m.x + dx, y: m.y + dy }));
      }
      get().setDoc((doc) => ({ ...doc, layers: doc.layers.map((l) => moved.get(l.id) ?? l) }));
    },
    distribute: (axis) => {
      const d = get().doc;
      const ids = get().selection;
      if (!d || ids.length < 3) return;
      const sel = d.layers.filter((l) => ids.includes(l.id) && !l.locked);
      const out = new Map(distributeLayers(sel, axis).map((l) => [l.id, l]));
      get().setDoc((doc) => ({ ...doc, layers: doc.layers.map((l) => out.get(l.id) ?? l) }));
    },
    select: (ids, mode = "replace") => {
      const d = get().doc;
      if (!d) return;
      const exp = expandGroups(d, ids);
      const cur = get().selection;
      let next = exp;
      if (mode === "add") next = [...new Set([...cur, ...exp])];
      if (mode === "toggle") next = exp.every((id) => cur.includes(id)) ? cur.filter((id) => !exp.includes(id)) : [...new Set([...cur, ...exp])];
      set({ selection: next, editingTextId: null });
    },
    selectAll: () => {
      const d = get().doc;
      if (d) set({ selection: d.layers.filter((l) => !l.locked && l.visible).map((l) => l.id) });
    },
    clearSelection: () => set({ selection: [], editingTextId: null }),
    setEditingText: (id) => set({ editingTextId: id, selection: id ? [id] : get().selection }),
    setTab: (tab) => set({ tab }),
    setShapeKind: (shapeKind) => set({ shapeKind }),
    setViewport: (v) => set({ viewport: { ...get().viewport, ...v } }),
    setStageSize: (stageSize) => set({ stageSize }),
    fitToScreen: () => {
      const { doc, stageSize } = get();
      if (!doc) return;
      const pad = 56;
      const zoom = Math.max(0.02, Math.min((stageSize.width - pad * 2) / doc.width, (stageSize.height - pad * 2) / doc.height, 4));
      set({ viewport: { zoom, panX: (stageSize.width - doc.width * zoom) / 2, panY: (stageSize.height - doc.height * zoom) / 2 } });
    },
    zoomAt: (zoom, center) => {
      const { viewport, stageSize } = get();
      const z = Math.max(0.02, Math.min(16, zoom));
      const c = center ?? { x: stageSize.width / 2, y: stageSize.height / 2 };
      const docX = (c.x - viewport.panX) / viewport.zoom;
      const docY = (c.y - viewport.panY) / viewport.zoom;
      set({ viewport: { zoom: z, panX: c.x - docX * z, panY: c.y - docY * z } });
    },
    setGrid: (patch, opts) => get().setDoc((d) => ({ ...d, grid: { ...d.grid, ...patch, margins: { ...d.grid.margins, ...(patch.margins ?? {}) } } }), opts ?? { key: "grid" }),
    addGuide: (axis, position) => {
      const id = uid("gd");
      get().setDoc((d) => ({ ...d, guides: [...d.guides, { id, axis, position }] }));
      return id;
    },
    moveGuide: (id, position, opts) => get().setDoc((d) => ({ ...d, guides: d.guides.map((g) => (g.id === id ? { ...g, position } : g)) }), opts),
    removeGuide: (id) => get().setDoc((d) => ({ ...d, guides: d.guides.filter((g) => g.id !== id) })),
    resizeDocument: (width, height, layers) => {
      get().setDoc((d) => ({ ...d, width, height, layers: layers ?? d.layers, guides: d.guides.filter((g) => g.position <= (g.axis === "x" ? width : height)) }));
      setTimeout(() => get().fitToScreen(), 0);
    },
    undo: () => {
      const { past, doc, future } = get();
      if (!past.length || !doc) return;
      const prev = past[past.length - 1];
      set({ past: past.slice(0, -1), future: [doc, ...future].slice(0, HISTORY_LIMIT), lastKey: null });
      commitDoc(prev);
    },
    redo: () => {
      const { past, doc, future } = get();
      if (!future.length || !doc) return;
      const next = future[0];
      set({ future: future.slice(1), past: [...past, doc].slice(-HISTORY_LIMIT), lastKey: null });
      commitDoc(next);
    },
    setSaveStatus: (saveStatus, at) => set({ saveStatus, ...(at ? { lastSavedAt: at } : {}) }),
    setPreview: (preview) => set({ preview, selection: preview ? [] : get().selection }),
    setSpacePan: (spacePan) => set({ spacePan }),
    setSmartGuides: (smartGuides) => set({ smartGuides }),
  };
});

export const selectedLayers = (s: Pick<EditorState, "doc" | "selection">): Layer[] =>
  s.doc ? s.doc.layers.filter((l) => s.selection.includes(l.id)) : [];
