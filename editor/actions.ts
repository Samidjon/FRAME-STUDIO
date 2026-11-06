"use client";

import type { Layer, ShapeKind, TextRole, TextureKind } from "@/types/layer";
import type { AssetMeta } from "@/types/assets";
import { cloneLayer, createImageLayer, createShapeLayer, createTextLayer, createTextureLayer, uid, TEXT_ROLE_SCALE } from "@/core/document/factory";
import { useEditor } from "@/stores/editor-store";
import { TEXTURES } from "@/core/rendering/textures";
import { loadFont } from "@/lib/fonts/catalog";
import { importFile, AssetError } from "@/lib/storage/assets";
import { toast } from "@/stores/ui-store";
import { parseSvgPath, pathBounds } from "@/core/rendering/paths";

/** Editor commands shared by toolbars, panels, menus and shortcuts. */

const ed = () => useEditor.getState();

function viewCenter() {
  const { viewport, stageSize, doc } = ed();
  if (!doc) return { x: 0, y: 0 };
  const x = (stageSize.width / 2 - viewport.panX) / viewport.zoom;
  const y = (stageSize.height / 2 - viewport.panY) / viewport.zoom;
  return { x: Math.max(0, Math.min(doc.width, x)), y: Math.max(0, Math.min(doc.height, y)) };
}

const SAMPLE: Record<TextRole, string> = {
  display: "Visual\nLanguage",
  heading: "Form follows grid",
  subheading: "A study in proportion and rhythm",
  body: "Typography is the craft of endowing human language with a durable visual form. Edit this text directly on the canvas.",
  caption: "Fig. 01 — Composition on a modular grid",
  metadata: "FS—001 / 2026 / Zürich",
};

export function addText(role: TextRole = "heading", at?: { x: number; y: number }, extra: Partial<Layer> = {}) {
  const doc = ed().doc;
  if (!doc) return;
  const scale = Math.min(doc.width, doc.height * 0.8);
  const r = TEXT_ROLE_SCALE[role];
  const fontFamily = role === "metadata" ? "JetBrains Mono" : role === "body" || role === "caption" ? "Inter" : "Space Grotesk";
  void loadFont(fontFamily);
  const width = Math.round(doc.width * (role === "display" ? 0.8 : role === "body" ? 0.5 : 0.6));
  const c = at ?? viewCenter();
  const l = createTextLayer(
    {
      role,
      text: SAMPLE[role],
      fontFamily,
      fontSize: Math.max(8, Math.round(scale * r.size)),
      width,
      x: Math.round(c.x - width / 2),
      y: Math.round(c.y - scale * r.size),
      fill: doc.background.color.toUpperCase() === "#171717" ? "#F0EDE5" : "#171717",
      ...(extra as object),
    },
    doc.width,
  );
  ed().addLayer(l);
  return l;
}

export function addShape(kind: ShapeKind, at?: { x: number; y: number }) {
  const doc = ed().doc;
  if (!doc) return;
  const s = Math.round(Math.min(doc.width, doc.height) * 0.3);
  const c = at ?? viewCenter();
  const isLine = kind === "line";
  const l = createShapeLayer(kind, {
    width: isLine ? Math.round(doc.width * 0.5) : kind === "ellipse" ? Math.round(s * 1.5) : s,
    height: isLine ? Math.max(2, Math.round(doc.width / 360)) : s,
  });
  l.x = Math.round(c.x - l.width / 2);
  l.y = Math.round(c.y - l.height / 2);
  ed().addLayer(l);
  return l;
}

/** Add a custom vector shape from pasted SVG path data (or a whole <svg> snippet). */
export function addSvgPath(input: string) {
  const doc = ed().doc;
  if (!doc) return;
  const ds = [...input.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  const d = ds.length ? ds.join(" ") : input.trim();
  const cmds = parseSvgPath(d);
  if (cmds.length < 2) {
    toast({ kind: "error", title: "No path data found", description: "Paste an SVG path (d attribute) or an <svg> with <path> elements." });
    return;
  }
  const b = pathBounds(cmds);
  // Normalise the path so its bounds start at 0,0.
  const norm = cmds
    .map((c) =>
      c.op === "Z" ? "Z" : c.op === "C" ? `C${c.x1 - b.x} ${c.y1 - b.y} ${c.x2 - b.x} ${c.y2 - b.y} ${c.x - b.x} ${c.y - b.y}` : `${c.op}${c.x - b.x} ${c.y - b.y}`,
    )
    .join(" ");
  const size = Math.min(doc.width, doc.height) * 0.4;
  const k = size / Math.max(b.width, b.height);
  const c = viewCenter();
  const l = createShapeLayer("path", {
    name: "Custom SVG",
    pathData: norm,
    pathViewBox: { width: b.width, height: b.height },
    width: Math.round(b.width * k),
    height: Math.round(b.height * k),
    fill: "#171717",
    fillRole: "ink",
  });
  l.x = Math.round(c.x - l.width / 2);
  l.y = Math.round(c.y - l.height / 2);
  ed().addLayer(l);
}

export function addImage(assetId: string, natural: { width: number; height: number }, at?: { x: number; y: number }, name = "Image") {
  const doc = ed().doc;
  if (!doc) return;
  const max = Math.min(doc.width, doc.height) * 0.6;
  const k = Math.min(1, max / Math.max(natural.width, natural.height));
  const w = Math.round(natural.width * k);
  const h = Math.round(natural.height * k);
  const c = at ?? viewCenter();
  const l = createImageLayer(assetId, { name, width: w, height: h, x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2) });
  ed().addLayer(l);
  return l;
}

/** Fill the page with an image (background photo). */
export function addFullBleedImage(assetId: string, name = "Background image") {
  const doc = ed().doc;
  if (!doc) return;
  const l = createImageLayer(assetId, { name, width: doc.width, height: doc.height, x: 0, y: 0 });
  ed().addLayer(l, { index: 0 });
}

export function addTexture(kind: TextureKind) {
  const doc = ed().doc;
  if (!doc) return;
  const def = TEXTURES.find((t) => t.id === kind)!;
  const dark = doc.background.color.toUpperCase() === "#171717";
  const l = createTextureLayer(kind, doc.width, doc.height, { opacity: def.opacity, blendMode: dark && def.blend === "multiply" ? "screen" : def.blend, color: dark ? "#F0EDE5" : "#171717" });
  ed().addLayer(l);
}

export function addAssetFromMeta(meta: Pick<AssetMeta, "id" | "kind" | "width" | "height" | "fontFamily" | "name">, at?: { x: number; y: number }) {
  if (meta.kind === "font") {
    addText("heading", at, { fontFamily: meta.fontFamily ?? meta.name, fontWeight: 400 } as Partial<Layer>);
    return;
  }
  const doc = ed().doc;
  if (meta.kind === "texture" && doc) {
    const l = createImageLayer(meta.id, { name: meta.name, width: doc.width, height: doc.height, opacity: 0.4, blendMode: "multiply" });
    ed().addLayer(l);
    return;
  }
  addImage(meta.id, { width: meta.width ?? 800, height: meta.height ?? 800 }, at, meta.name);
}

export async function uploadAndPlace(files: FileList | File[], at?: { x: number; y: number }) {
  const projectId = ed().project?.id ?? null;
  for (const f of Array.from(files)) {
    try {
      const meta = await importFile(f, { projectId });
      addAssetFromMeta(meta, at);
      toast({ kind: "success", title: `Added ${meta.name}` });
    } catch (e) {
      toast({ kind: "error", title: `Could not import ${f.name}`, description: e instanceof AssetError || e instanceof Error ? e.message : String(e) });
    }
  }
}

/** Replace the source image of an image layer, keeping its frame and effects. */
export async function replaceImage(layerId: string, file: File) {
  try {
    const meta = await importFile(file, { projectId: ed().project?.id ?? null });
    ed().updateLayer(layerId, { assetId: meta.id, crop: { x: 0, y: 0, width: 1, height: 1 } } as Partial<Layer>);
  } catch (e) {
    toast({ kind: "error", title: "Could not replace image", description: e instanceof Error ? e.message : String(e) });
  }
}

/* ---------------- clipboard (in-app; survives within the session) ---------------- */

let clipboard: Layer[] = [];

export function copySelection() {
  const { doc, selection } = ed();
  if (!doc) return;
  clipboard = doc.layers.filter((l) => selection.includes(l.id)).map((l) => structuredClone(l));
}

export function cutSelection() {
  copySelection();
  ed().deleteLayers(ed().selection);
}

export function paste() {
  if (!clipboard.length) return;
  const doc = ed().doc;
  if (!doc) return;
  const off = Math.round(Math.min(doc.width, doc.height) * 0.02);
  const groupMap = new Map<string, string>();
  const copies = clipboard.map((l) => {
    const c = cloneLayer(l, off);
    c.brandLocked = false;
    if (l.groupId) {
      if (!groupMap.has(l.groupId)) groupMap.set(l.groupId, uid("grp"));
      c.groupId = groupMap.get(l.groupId)!;
    }
    return c;
  });
  clipboard = copies.map((c) => structuredClone(c));
  ed().addLayers(copies);
}

export function toggleLock(ids: string[]) {
  const doc = ed().doc;
  if (!doc) return;
  const anyUnlocked = doc.layers.some((l) => ids.includes(l.id) && !l.locked);
  ed().updateLayers(ids, (l) => ({ ...l, locked: anyUnlocked }));
  if (anyUnlocked) ed().clearSelection();
}

export function toggleVisibility(ids: string[]) {
  const doc = ed().doc;
  if (!doc) return;
  const anyVisible = doc.layers.some((l) => ids.includes(l.id) && l.visible);
  ed().updateLayers(ids, (l) => ({ ...l, visible: !anyVisible }));
}

export function nudge(dx: number, dy: number) {
  const { selection, doc } = ed();
  if (!doc || !selection.length) return;
  ed().updateLayers(selection, (l) => (l.locked ? l : { ...l, x: l.x + dx, y: l.y + dy }), { key: "nudge" });
}
