"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Group, Layer as KLayer, Line, Rect, Shape, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import type { Layer } from "@/types/layer";
import { useEditor } from "@/stores/editor-store";
import { LayerNode } from "./layer-node";
import { GridOverlay } from "@/editor/grid/grid-overlay";
import { getResourceVersion, subscribeResources } from "@/lib/image/resources";
import { subscribeFonts } from "@/lib/fonts/catalog";
import { layerBounds, rectsIntersect, snapBox, unionBounds } from "@/core/geometry/transform";
import { snapTargets } from "./snapping";
import { TextEditorOverlay } from "./text-editor-overlay";
import { ContextMenu, type MenuState } from "./context-menu";
import { Rulers, RULER } from "./rulers";
import { addAssetFromMeta, uploadAndPlace } from "@/editor/actions";
import { useUi } from "@/stores/ui-store";

const fontVersionStore = (() => {
  let v = 0;
  return {
    subscribe: (cb: () => void) => {
      const un = subscribeFonts(() => {
        v++;
        cb();
      });
      return () => {
        un();
      };
    },
    get: () => v,
  };
})();

interface DragState {
  starts: Map<string, { x: number; y: number }>;
  layers: Layer[];
  targets: { x: number[]; y: number[] };
}

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const dragRef = useRef<DragState | null>(null);
  const transformKey = useRef("t");
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const viewport = useEditor((s) => s.viewport);
  const stageSize = useEditor((s) => s.stageSize);
  const editingTextId = useEditor((s) => s.editingTextId);
  const preview = useEditor((s) => s.preview);
  const spacePan = useEditor((s) => s.spacePan);
  const smartGuides = useEditor((s) => s.smartGuides);
  const showRulers = useUi((s) => s.showRulers) && !preview;
  const resourceVersion = useSyncExternalStore(subscribeResources, getResourceVersion, () => 0);
  const fontVersion = useSyncExternalStore(fontVersionStore.subscribe, fontVersionStore.get, () => 0);
  const rv = resourceVersion * 1000 + fontVersion;

  // Track container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      useEditor.getState().setStageSize({ width: Math.max(50, r.width), height: Math.max(50, r.height) });
      if (first) {
        first = false;
        useEditor.getState().fitToScreen();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Attach transformer to selected, unlocked, visible nodes.
  const selectedLayers = useMemo(() => (doc ? doc.layers.filter((l) => selection.includes(l.id)) : []), [doc, selection]);
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = selectedLayers
      .filter((l) => !l.locked && l.visible && l.id !== editingTextId)
      .map((l) => stage.findOne(`#${l.id}`))
      .filter(Boolean) as Konva.Node[];
    tr.nodes(preview ? [] : nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedLayers, editingTextId, preview, doc]);

  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const isLine = single?.type === "shape" && single.shape === "line";
  const isText = single?.type === "text";
  const isBrand = !!single?.brandLocked;
  const keepRatio = !!single && (single.type === "image" || single.type === "text" || isBrand);
  const anchors = isLine
    ? ["middle-left", "middle-right"]
    : isBrand
      ? ["top-left", "top-right", "bottom-left", "bottom-right"]
      : isText
      ? single!.type === "text" && single.vertical
        ? ["top-left", "top-right", "bottom-left", "bottom-right"]
        : ["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"]
      : ["top-left", "top-center", "top-right", "middle-right", "bottom-right", "bottom-center", "bottom-left", "middle-left"];

  const toDoc = useCallback(
    (clientX: number, clientY: number) => {
      const r = containerRef.current!.getBoundingClientRect();
      return { x: (clientX - r.left - viewport.panX) / viewport.zoom, y: (clientY - r.top - viewport.panY) / viewport.zoom };
    },
    [viewport],
  );

  /* ---------------------------- node handlers ---------------------------- */

  const onNodeDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, layer: Layer) => {
    const st = useEditor.getState();
    if (st.spacePan) return;
    const evt = e.evt as MouseEvent;
    if (evt.button === 1) return;
    e.cancelBubble = true;
    if (evt.shiftKey || evt.ctrlKey || evt.metaKey) st.select([layer.id], "toggle");
    else if (!st.selection.includes(layer.id)) st.select([layer.id]);
  }, []);

  const onNodeDbl = useCallback((layer: Layer) => {
    if (layer.locked) return;
    if (layer.type === "text") useEditor.getState().setEditingText(layer.id);
    if (layer.type === "image") window.dispatchEvent(new CustomEvent("frame:crop", { detail: layer.id }));
  }, []);

  const onDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>, layer: Layer) => {
    const st = useEditor.getState();
    if (!st.doc) return;
    let sel = st.selection;
    if (!sel.includes(layer.id)) {
      st.select([layer.id]);
      sel = useEditor.getState().selection;
    }
    const moving = st.doc.layers.filter((l) => sel.includes(l.id) && !l.locked);
    const starts = new Map(moving.map((l) => [l.id, { x: l.x, y: l.y }]));
    dragRef.current = { starts, layers: moving, targets: snapTargets(st.doc, new Set(moving.map((l) => l.id))) };
  }, []);

  const onDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>, layer: Layer) => {
    const d = dragRef.current;
    const stage = stageRef.current;
    if (!d || !stage) return;
    const node = e.target;
    const start = d.starts.get(layer.id);
    if (!start) return;
    let dx = node.x() - start.x;
    let dy = node.y() - start.y;
    const zoom = useEditor.getState().viewport.zoom;
    const altKey = (e.evt as DragEvent).altKey;
    if (!altKey) {
      const b = unionBounds(d.layers.map((l) => layerBounds({ ...l, x: l.x + dx, y: l.y + dy })))!;
      const s = snapBox(b, d.targets.x, d.targets.y, 6 / zoom);
      dx += s.dx;
      dy += s.dy;
      useEditor.getState().setSmartGuides({ x: s.guidesX, y: s.guidesY });
    } else useEditor.getState().setSmartGuides({ x: [], y: [] });
    if ((e.evt as DragEvent).shiftKey) {
      // constrain to dominant axis
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    for (const l of d.layers) {
      const st = d.starts.get(l.id)!;
      const n = l.id === layer.id ? node : stage.findOne(`#${l.id}`);
      n?.position({ x: st.x + dx, y: st.y + dy });
    }
  }, []);

  const onDragEnd = useCallback(() => {
    const d = dragRef.current;
    const stage = stageRef.current;
    dragRef.current = null;
    useEditor.getState().setSmartGuides({ x: [], y: [] });
    if (!d || !stage) return;
    const pos = new Map<string, { x: number; y: number }>();
    for (const l of d.layers) {
      const n = stage.findOne(`#${l.id}`);
      if (n) pos.set(l.id, { x: Math.round(n.x() * 100) / 100, y: Math.round(n.y() * 100) / 100 });
    }
    useEditor.getState().setDoc((doc) => ({ ...doc, layers: doc.layers.map((l) => (pos.has(l.id) ? { ...l, ...pos.get(l.id)! } : l)) }));
  }, []);

  const onTransformEnd = useCallback((e: Konva.KonvaEventObject<Event>, layer: Layer) => {
    const node = e.target;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const anchor = trRef.current?.getActiveAnchor() ?? "";
    const base = { x: node.x(), y: node.y(), rotation: Math.round(node.rotation() * 100) / 100 };
    let patch: Partial<Layer>;
    if (layer.type === "text") {
      const sideOnly = anchor === "middle-left" || anchor === "middle-right";
      if (sideOnly) patch = { ...base, width: Math.max(8, layer.width * sx) };
      else
        patch = {
          ...base,
          width: Math.max(8, layer.width * sx),
          fontSize: Math.max(1, Math.round(layer.fontSize * Math.abs(sy) * 10) / 10),
        } as Partial<Layer>;
    } else if (layer.type === "shape" && layer.shape === "line") {
      patch = { ...base, width: Math.max(1, layer.width * sx) };
    } else {
      patch = { ...base, width: Math.max(1, layer.width * sx), height: Math.max(1, layer.height * sy) };
    }
    useEditor.getState().updateLayer(layer.id, patch, { key: transformKey.current });
  }, []);

  const onContext = useCallback((e: Konva.KonvaEventObject<PointerEvent>, layer: Layer) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    const st = useEditor.getState();
    if (!st.selection.includes(layer.id)) st.select([layer.id]);
    const r = containerRef.current!.getBoundingClientRect();
    setMenu({ x: e.evt.clientX - r.left, y: e.evt.clientY - r.top, layerId: layer.id });
  }, []);

  /* ---------------------------- stage handlers ---------------------------- */

  const isBackground = (t: Konva.Node) => t === stageRef.current || t.name() === "page-bg";

  const onStageDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    setMenu(null);
    const evt = e.evt;
    if (spacePan || evt.button === 1) {
      evt.preventDefault();
      panRef.current = { x: evt.clientX, y: evt.clientY, px: viewport.panX, py: viewport.panY };
      return;
    }
    if (evt.button !== 0) return;
    if (!isBackground(e.target)) return;
    if (editingTextId) useEditor.getState().setEditingText(null);
    if (!evt.shiftKey) useEditor.getState().clearSelection();
    const p = toDoc(evt.clientX, evt.clientY);
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const onStageMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const evt = e.evt;
    if (panRef.current) {
      const p = panRef.current;
      useEditor.getState().setViewport({ panX: p.px + evt.clientX - p.x, panY: p.py + evt.clientY - p.y });
      return;
    }
    if (marquee) {
      const p = toDoc(evt.clientX, evt.clientY);
      setMarquee({ ...marquee, x1: p.x, y1: p.y });
    }
  };

  const finishPointer = (shift: boolean) => {
    panRef.current = null;
    if (marquee && doc) {
      const r = { x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) };
      if (r.width * viewport.zoom > 3 || r.height * viewport.zoom > 3) {
        const hits = doc.layers.filter((l) => l.visible && !l.locked && rectsIntersect(layerBounds(l), r)).filter((l) => !(l.width >= doc.width && l.height >= doc.height));
        useEditor.getState().select(hits.map((l) => l.id), shift ? "add" : "replace");
      }
      setMarquee(null);
    }
  };

  useEffect(() => {
    const up = (e: MouseEvent) => finishPointer(e.shiftKey);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  });

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const evt = e.evt;
    const st = useEditor.getState();
    if (evt.ctrlKey || evt.metaKey) {
      const pointer = stageRef.current!.getPointerPosition() ?? { x: stageSize.width / 2, y: stageSize.height / 2 };
      const factor = Math.exp(-evt.deltaY * (evt.deltaMode === 1 ? 0.05 : 0.0022));
      st.zoomAt(st.viewport.zoom * factor, pointer);
    } else {
      const dx = evt.shiftKey ? evt.deltaY : evt.deltaX;
      const dy = evt.shiftKey ? 0 : evt.deltaY;
      st.setViewport({ panX: st.viewport.panX - dx, panY: st.viewport.panY - dy });
    }
  };

  /* ------------------------------ drag & drop ------------------------------ */

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const at = toDoc(e.clientX, e.clientY);
    const assetJson = e.dataTransfer.getData("application/x-frame-asset");
    if (assetJson) {
      try {
        const meta = JSON.parse(assetJson);
        addAssetFromMeta({ id: meta.id, kind: meta.kind, width: meta.width ?? null, height: meta.height ?? null, fontFamily: meta.fontFamily ?? null, name: meta.name ?? "Asset" }, at);
      } catch {
        /* ignore malformed payload */
      }
      return;
    }
    if (e.dataTransfer.files?.length) await uploadAndPlace(e.dataTransfer.files, at);
  };

  if (!doc) return null;
  const z = viewport.zoom;
  const hover = hoverId && !selection.includes(hoverId) ? doc.layers.find((l) => l.id === hoverId) : null;
  const cursor = spacePan ? (panRef.current ? "grabbing" : "grab") : undefined;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-workspace"
      style={{ cursor }}
      data-testid="canvas-container"
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!dropActive) setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropActive(false);
      }}
      onDrop={onDrop}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={onStageDown}
        onMouseMove={onStageMove}
        onWheel={onWheel}
        onMouseLeave={() => setHoverId(null)}
      >
        <KLayer x={viewport.panX} y={viewport.panY} scaleX={z} scaleY={z}>
          <Rect
            name="page-bg"
            x={0}
            y={0}
            width={doc.width}
            height={doc.height}
            fill={doc.background.transparent ? "#FFFFFF" : doc.background.color}
            shadowColor="black"
            shadowOpacity={0.28}
            shadowBlur={preview ? 60 : 28}
            shadowOffsetY={preview ? 20 : 8}
            shadowForStrokeEnabled={false}
            perfectDrawEnabled={false}
          />
          {doc.background.transparent && (
            <Group listening={false} clipX={0} clipY={0} clipWidth={doc.width} clipHeight={doc.height}>
              <Checker width={doc.width} height={doc.height} zoom={z} />
            </Group>
          )}
          <Group clipX={0} clipY={0} clipWidth={doc.width} clipHeight={doc.height}>
            {doc.layers.map((l) => (
              <LayerNode
                key={l.id}
                layer={l}
                zoom={z}
                editing={editingTextId === l.id}
                draggable={!l.locked && !spacePan && !preview && editingTextId !== l.id}
                resourceVersion={rv}
                onPointerDown={onNodeDown}
                onDblClick={onNodeDbl}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onTransformEnd={onTransformEnd}
                onContextMenu={onContext}
              />
            ))}
          </Group>
        </KLayer>
        <KLayer x={viewport.panX} y={viewport.panY} scaleX={z} scaleY={z}>
          {!preview && doc.grid.visible && <GridOverlay width={doc.width} height={doc.height} grid={doc.grid} zoom={z} />}
          {!preview &&
            doc.guides.map((g) => (
              <Line
                key={g.id}
                x={g.axis === "x" ? g.position : 0}
                y={g.axis === "y" ? g.position : 0}
                points={g.axis === "x" ? [0, -1e5, 0, 1e5] : [-1e5, 0, 1e5, 0]}
                stroke="#3DD6F5"
                strokeWidth={1 / z}
                hitStrokeWidth={8 / z}
                draggable
                onMouseEnter={(e) => {
                  const c = e.target.getStage()?.container();
                  if (c) c.style.cursor = g.axis === "x" ? "ew-resize" : "ns-resize";
                }}
                onMouseLeave={(e) => {
                  const c = e.target.getStage()?.container();
                  if (c) c.style.cursor = "";
                }}
                onDragMove={(e) => {
                  if (g.axis === "x") e.target.y(0);
                  else e.target.x(0);
                }}
                onDragEnd={(e) => {
                  const pos = g.axis === "x" ? e.target.x() : e.target.y();
                  const limit = g.axis === "x" ? doc.width : doc.height;
                  if (pos < -20 / z || pos > limit + 20 / z) useEditor.getState().removeGuide(g.id);
                  else useEditor.getState().moveGuide(g.id, Math.round(pos));
                }}
                onDblClick={() => useEditor.getState().removeGuide(g.id)}
              />
            ))}
          {smartGuides.x.map((x) => (
            <Line key={`sx${x}`} points={[x, -1e4, x, 1e4]} stroke="#FF4D00" strokeWidth={1 / z} dash={[4 / z, 3 / z]} listening={false} />
          ))}
          {smartGuides.y.map((y) => (
            <Line key={`sy${y}`} points={[-1e4, y, 1e4, y]} stroke="#FF4D00" strokeWidth={1 / z} dash={[4 / z, 3 / z]} listening={false} />
          ))}
          {hover && !preview && (
            <Rect x={hover.x} y={hover.y} width={hover.width} height={Math.max(hover.height, 1)} rotation={hover.rotation} stroke="#FF4D00" strokeWidth={1 / z} listening={false} />
          )}
          {selectedLayers
            .filter((l) => l.locked && !preview)
            .map((l) => (
              <Rect key={`lk${l.id}`} x={l.x} y={l.y} width={l.width} height={Math.max(l.height, 1)} rotation={l.rotation} stroke="#888888" dash={[3 / z, 3 / z]} strokeWidth={1 / z} listening={false} />
            ))}
          <Transformer
            ref={trRef}
            rotateEnabled={!preview}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={4}
            keepRatio={keepRatio}
            enabledAnchors={anchors}
            anchorSize={8}
            anchorCornerRadius={0}
            anchorStroke="#FF4D00"
            anchorFill="#FFFFFF"
            anchorStrokeWidth={1}
            borderStroke="#FF4D00"
            borderStrokeWidth={1}
            rotateAnchorOffset={22}
            ignoreStroke
            flipEnabled={false}
            shouldOverdrawWholeArea={false}
            onTransformStart={() => {
              transformKey.current = `transform-${Date.now()}`;
            }}
            boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < (isLine ? 0 : 4) ? oldBox : newBox)}
          />
          {marquee && (
            <Rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(255,77,0,0.08)"
              stroke="#FF4D00"
              strokeWidth={1 / z}
              listening={false}
            />
          )}
        </KLayer>
      </Stage>
      <HoverTracker stageRef={stageRef} onHover={setHoverId} />
      {editingTextId && <TextEditorOverlay layerId={editingTextId} />}
      {showRulers && <Rulers containerRef={containerRef} />}
      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
      {dropActive && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center border-2 border-dashed border-accent bg-accent/5" style={{ top: showRulers ? RULER + 12 : 12, left: showRulers ? RULER + 12 : 12 }}>
          <span className="label-mono !text-accent">Drop to place on canvas</span>
        </div>
      )}
    </div>
  );
}

/** Track hovered layer id cheaply via stage pointer events. */
function HoverTracker({ stageRef, onHover }: { stageRef: React.RefObject<Konva.Stage | null>; onHover: (id: string | null) => void }) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const over = (e: Konva.KonvaEventObject<MouseEvent>) => onHover(e.target.name() === "layer" ? e.target.id() : null);
    stage.on("mouseover.hover", over);
    return () => {
      stage.off("mouseover.hover");
    };
  }, [stageRef, onHover]);
  return null;
}

function Checker({ width, height, zoom }: { width: number; height: number; zoom: number }) {
  const sceneFunc = useCallback(
    (kctx: Konva.Context) => {
      const ctx = (kctx as unknown as { _context: CanvasRenderingContext2D })._context;
      const cell = 10 / zoom;
      ctx.fillStyle = "#E6E6E6";
      for (let y = 0, r = 0; y < height; y += cell, r++)
        for (let x = (r % 2) * cell; x < width; x += cell * 2) ctx.fillRect(x, y, cell, cell);
    },
    [width, height, zoom],
  );
  return <Shape listening={false} sceneFunc={sceneFunc} perfectDrawEnabled={false} />;
}
