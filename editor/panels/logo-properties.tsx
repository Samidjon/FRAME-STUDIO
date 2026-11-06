"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { Layer, ShapeLayer } from "@/types/layer";
import type { AssetMeta } from "@/types/assets";
import { useEditor } from "@/stores/editor-store";
import { Button, ColorField, Segmented } from "@/components/shared/ui";
import { SENITUKANG, replaceBrandLogo, type LogoVariant } from "@/core/brand/senitukang";
import { importFile, listAssets } from "@/lib/storage/assets";
import { toast } from "@/stores/ui-store";
import { Section } from "./section";

/** Change the design's protected logo: company version, colour, or an uploaded file. */
export function LogoProperties({ layer }: { layer: Layer }) {
  const setDoc = useEditor((s) => s.setDoc);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logos, setLogos] = useState<(AssetMeta & { thumbUrl: string | null })[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = () => listAssets("logo").then(setLogos).catch(() => setLogos([]));
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => () => logos.forEach((l) => l.thumbUrl && URL.revokeObjectURL(l.thumbUrl)), [logos]);

  const useVariant = (variant: LogoVariant) => setDoc((d) => replaceBrandLogo(d, { type: "vector", variant }));
  const useAsset = (a: Pick<AssetMeta, "id" | "width" | "height" | "name">) =>
    setDoc((d) => replaceBrandLogo(d, { type: "image", assetId: a.id, width: a.width ?? 512, height: a.height ?? 512, name: a.name }));

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const meta = await importFile(file, { kind: "logo", projectId: useEditor.getState().project?.id ?? null });
      useAsset(meta);
      await refresh();
      toast({ kind: "success", title: "Logo changed", description: "Undo with Ctrl+Z." });
    } catch (e) {
      toast({ kind: "error", title: `Could not use ${file.name}`, description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const shape = layer.type === "shape" ? (layer as ShapeLayer) : null;
  const variant: LogoVariant | null = shape ? (shape.pathData === SENITUKANG.lockup.path ? "lockup" : "symbol") : null;

  return (
    <Section index="02" title="Logo">
      <div data-testid="logo-versions">
        <Segmented
          value={variant ?? "custom"}
          onChange={(v) => v !== "custom" && useVariant(v)}
          options={[
            { value: "symbol", label: "Symbol" },
            { value: "lockup", label: "Full logo" },
            ...(variant ? [] : [{ value: "custom" as const, label: "Uploaded" }]),
          ]}
        />
      </div>
      {shape && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">Colour</span>
          <ColorField label="Logo" value={shape.fill} onChange={(fill) => fill && useEditor.getState().updateLayer(layer.id, { fill, fillRole: "none" } as Partial<Layer>, { key: `logo-fill-${layer.id}` })} />
        </div>
      )}
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="logo-upload">
        <Upload size={13} /> {busy ? "Uploading…" : "Upload another logo"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        data-testid="logo-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {logos.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">Your logos</span>
          <div className="grid grid-cols-4 gap-1.5">
            {logos.map((a) => (
              <button
                key={a.id}
                onClick={() => useAsset(a)}
                title={a.name}
                aria-label={`Use ${a.name} as the logo`}
                className="flex aspect-square items-center justify-center overflow-hidden border border-line bg-white hover:border-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.thumbUrl && <img src={a.thumbUrl} alt="" className="h-full w-full object-contain" />}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] leading-snug text-subtle">You can move, resize, rotate and change the logo, but a design always keeps one.</p>
    </Section>
  );
}
