"use client";

import { useEffect, useRef, useState } from "react";
import type { CropRect, ImageLayer } from "@/types/layer";
import { Button, Dialog, Segmented } from "@/components/shared/ui";
import { getSource } from "@/lib/image/resources";
import { sourceSize } from "@/core/rendering/image-pipeline";
import { useEditor } from "@/stores/editor-store";

type Handle = "move" | "nw" | "ne" | "sw" | "se";
const RATIOS = { free: 0, "1:1": 1, "4:5": 4 / 5, "3:2": 3 / 2, "16:9": 16 / 9, "9:16": 9 / 16 } as const;

/** Interactive crop: drag the frame or its corners over the full source image. */
export function CropDialog({ layer, open, onClose }: { layer: ImageLayer; open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [crop, setCrop] = useState<CropRect>(layer.crop);
  const [ratio, setRatio] = useState<keyof typeof RATIOS>("free");
  const src = getSource(layer.assetId);
  const size = src ? sourceSize(src) : { w: 1, h: 1 };
  const boxW = 560;
  const boxH = Math.min(420, (boxW * size.h) / size.w);
  const dispW = (boxH * size.w) / size.h;

  useEffect(() => setCrop(layer.crop), [layer.crop, open]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !src) return;
    c.width = dispW * 2;
    c.height = boxH * 2;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(src, 0, 0, c.width, c.height);
  }, [src, dispW, boxH, open]);

  const drag = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, c: { ...crop } };
    const r = RATIOS[ratio] ? RATIOS[ratio] * (size.h / size.w) : 0; // normalised w/h ratio
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / dispW;
      const dy = (ev.clientY - start.y) / boxH;
      const c = { ...start.c };
      if (handle === "move") {
        c.x = Math.min(1 - c.width, Math.max(0, c.x + dx));
        c.y = Math.min(1 - c.height, Math.max(0, c.y + dy));
      } else {
        let x0 = c.x, y0 = c.y, x1 = c.x + c.width, y1 = c.y + c.height;
        if (handle.includes("w")) x0 = Math.min(x1 - 0.02, Math.max(0, x0 + dx));
        if (handle.includes("e")) x1 = Math.max(x0 + 0.02, Math.min(1, x1 + dx));
        if (handle.includes("n")) y0 = Math.min(y1 - 0.02, Math.max(0, y0 + dy));
        if (handle.includes("s")) y1 = Math.max(y0 + 0.02, Math.min(1, y1 + dy));
        if (r) {
          const w = x1 - x0;
          const h = w / r;
          if (handle.includes("n")) y0 = Math.max(0, y1 - h);
          else y1 = Math.min(1, y0 + h);
        }
        Object.assign(c, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
      }
      setCrop(c);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const apply = () => {
    // Resize the frame so it shows exactly the cropped region (no hidden cover-crop).
    const aspect = (crop.width * size.w) / (crop.height * size.h);
    useEditor.getState().updateLayer(layer.id, { crop, height: Math.round((layer.width / aspect) * 100) / 100 } as Partial<ImageLayer>);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Image"
      title="Crop"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => setCrop({ x: 0, y: 0, width: 1, height: 1 })}>Reset</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={apply}>Apply crop</Button>
        </>
      }
    >
      <div className="mb-3">
        <Segmented
          value={ratio}
          onChange={(v) => setRatio(v)}
          options={(Object.keys(RATIOS) as (keyof typeof RATIOS)[]).map((k) => ({ value: k, label: k === "free" ? "Free" : k }))}
        />
      </div>
      <div className="flex justify-center bg-sunken p-4">
        {src ? (
          <div className="relative select-none" style={{ width: dispW, height: boxH }}>
            <canvas ref={canvasRef} style={{ width: dispW, height: boxH }} className="block" />
            <div className="absolute inset-0 bg-black/55" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0, ${crop.x * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${(crop.y + crop.height) * 100}%, ${(crop.x + crop.width) * 100}% ${(crop.y + crop.height) * 100}%, ${(crop.x + crop.width) * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${crop.y * 100}%)` }} />
            <div
              role="slider"
              aria-label="Crop area"
              aria-valuenow={Math.round(crop.width * 100)}
              tabIndex={0}
              onPointerDown={drag("move")}
              className="absolute cursor-move border border-accent"
              style={{ left: crop.x * dispW, top: crop.y * boxH, width: crop.width * dispW, height: crop.height * boxH }}
            >
              {[1, 2].map((i) => (
                <span key={`v${i}`} className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/40" style={{ left: `${(i * 100) / 3}%` }} />
              ))}
              {[1, 2].map((i) => (
                <span key={`h${i}`} className="pointer-events-none absolute left-0 right-0 h-px bg-white/40" style={{ top: `${(i * 100) / 3}%` }} />
              ))}
              {(["nw", "ne", "sw", "se"] as Handle[]).map((h) => (
                <span
                  key={h}
                  onPointerDown={drag(h)}
                  className="absolute h-3 w-3 border border-accent bg-white"
                  style={{ left: h.includes("w") ? -6 : undefined, right: h.includes("e") ? -6 : undefined, top: h.includes("n") ? -6 : undefined, bottom: h.includes("s") ? -6 : undefined, cursor: `${h}-resize` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="label-mono p-10">Image is loading…</div>
        )}
      </div>
      <div className="label-mono mt-3">
        {Math.round(crop.width * size.w)} × {Math.round(crop.height * size.h)} px of {size.w} × {size.h}
      </div>
    </Dialog>
  );
}
