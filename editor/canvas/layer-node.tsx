"use client";

import { memo, useCallback } from "react";
import { Shape } from "react-konva";
import type Konva from "konva";
import type { Layer } from "@/types/layer";
import { drawLayerContent, type DrawContext } from "@/core/rendering/draw";
import { BLEND_TO_COMPOSITE } from "@/core/rendering/image-pipeline";
import { getSource } from "@/lib/image/resources";

interface Props {
  layer: Layer;
  zoom: number;
  editing: boolean;
  draggable: boolean;
  /** Bumps when async resources (images, fonts) finish loading. */
  resourceVersion: number;
  onPointerDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, layer: Layer) => void;
  onDblClick: (layer: Layer) => void;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>, layer: Layer) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>, layer: Layer) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>, layer: Layer) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>, layer: Layer) => void;
  onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>, layer: Layer) => void;
}

/**
 * One Konva node per document layer. Painting is delegated to the shared
 * renderer through a custom sceneFunc, so the editor shows exactly what export
 * produces. Hit-testing uses the layer's box.
 */
export const LayerNode = memo(function LayerNode(p: Props) {
  const { layer, zoom, editing } = p;

  const sceneFunc = useCallback(
    (ctx: Konva.Context) => {
      const native = (ctx as unknown as { _context: CanvasRenderingContext2D })._context;
      const dc: DrawContext = { unit: zoom * (window.devicePixelRatio || 1), getSource, maxImageSide: 4096 };
      if (editing && layer.type === "text") {
        // While editing, the HTML textarea shows the glyphs; keep the box background only.
        if (layer.backgroundColor) {
          native.fillStyle = layer.backgroundColor;
          native.fillRect(0, 0, layer.width, layer.height);
        }
        return;
      }
      drawLayerContent(native, layer, dc);
    },
    // resourceVersion forces a new sceneFunc identity → redraw after loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layer, zoom, editing, p.resourceVersion],
  );

  const hitFunc = useCallback(
    (ctx: Konva.Context, shape: Konva.Shape) => {
      const pad = layer.type === "shape" && layer.shape === "line" ? Math.max(0, 6 / zoom - layer.height / 2) : 0;
      ctx.beginPath();
      ctx.rect(0, -pad, layer.width, layer.height + pad * 2);
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    },
    [layer, zoom],
  );

  return (
    <Shape
      id={layer.id}
      name="layer"
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      globalCompositeOperation={BLEND_TO_COMPOSITE[layer.blendMode] ?? "source-over"}
      listening={!layer.locked}
      draggable={p.draggable}
      sceneFunc={sceneFunc}
      hitFunc={hitFunc}
      perfectDrawEnabled={false}
      onMouseDown={(e) => p.onPointerDown(e, layer)}
      onTouchStart={(e) => p.onPointerDown(e, layer)}
      onDblClick={() => p.onDblClick(layer)}
      onDblTap={() => p.onDblClick(layer)}
      onDragStart={(e) => p.onDragStart(e, layer)}
      onDragMove={(e) => p.onDragMove(e, layer)}
      onDragEnd={(e) => p.onDragEnd(e, layer)}
      onTransformEnd={(e) => p.onTransformEnd(e, layer)}
      onContextMenu={(e) => p.onContextMenu(e, layer)}
    />
  );
});
