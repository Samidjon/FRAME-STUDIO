"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Lock } from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import { toast } from "@/stores/ui-store";
import { Button, Dialog, Segmented, SectionLabel, Slider, Spinner, Toggle, cx } from "@/components/shared/ui";
import { renderDocument } from "@/core/rendering/draw";
import { getSource, subscribeResources } from "@/lib/image/resources";
import { prepareDocument } from "@/lib/image/thumbnail";
import type { DesignDocument } from "@/types/project";
import { downloadBlob, formatBytes, safeFilename } from "./download";
import { MAX_CANVAS_SIDE, resolveRasterSize, type RasterFormat } from "./raster";
import type { PdfMode } from "./pdf";
import { pdfPageSize, type PdfPageSize } from "./pdf-page";

type ExportFormat = RasterFormat | "svg" | "pdf";
type ScaleChoice = "1" | "2" | "3" | "custom";

interface ExportSettings {
  format: ExportFormat;
  scale: ScaleChoice;
  customWidth: number;
  transparent: boolean;
  quality: number;
  pdfPage: PdfPageSize;
  pdfMode: PdfMode;
  pdfDpi: "150" | "300";
  embedFonts: boolean;
}

const STORAGE_KEY = "fs.export.settings.v1";

const DEFAULTS: ExportSettings = {
  format: "png",
  scale: "2",
  customWidth: 0,
  transparent: false,
  quality: 0.92,
  pdfPage: "match",
  pdfMode: "vector",
  pdfDpi: "300",
  embedFonts: true,
};

function loadSettings(): ExportSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ExportSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: ExportSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPG" },
  { value: "webp", label: "WebP" },
  { value: "svg", label: "SVG" },
  { value: "pdf", label: "PDF" },
];

const EXT: Record<ExportFormat, string> = { png: "png", jpeg: "jpg", webp: "webp", svg: "svg", pdf: "pdf" };

const FORMAT_NOTE: Record<ExportFormat, string> = {
  png: "Lossless raster. Supports transparency.",
  jpeg: "Compressed raster. No transparency — uses the background colour.",
  webp: "Modern compressed raster with transparency.",
  svg: "Vector shapes and live text. Images embedded as PNG.",
  pdf: "Print-ready. Vector shapes, high-resolution text and images.",
};

const PREVIEW_MAX = 520;

/* ------------------------------------------------------------------ preview */

function ExportPreview({ doc, transparent, jpeg }: { doc: DesignDocument; transparent: boolean; jpeg: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const off = subscribeResources(() => setTick((t) => t + 1));
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const opaque = jpeg || !transparent;
    (async () => {
      await prepareDocument(doc, 4000);
      if (cancelled || !ref.current) return;
      const scale = Math.min(1, PREVIEW_MAX / Math.max(doc.width, doc.height)) * Math.min(2, window.devicePixelRatio || 1);
      try {
        renderDocument(doc, {
          scale,
          canvas: ref.current,
          getSource,
          transparent: opaque ? false : true,
          background: opaque ? (doc.background.transparent ? "#FFFFFF" : doc.background.color) : undefined,
          maxImageSide: 2048,
        });
      } catch {
        /* preview is best-effort */
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, transparent, jpeg, tick]);

  const aspect = doc.width / doc.height;
  const showChecker = transparent && !jpeg;
  return (
    <div className="relative flex h-full min-h-[280px] items-center justify-center bg-sunken p-6">
      <div
        className={cx("relative max-h-full max-w-full border border-line shadow-[0_10px_40px_-18px_rgba(0,0,0,0.45)]", showChecker && "checker")}
        style={{ aspectRatio: `${aspect}`, width: aspect >= 1 ? "100%" : "auto", height: aspect >= 1 ? "auto" : "min(56vh, 520px)" }}
      >
        <canvas ref={ref} className="block h-full w-full" aria-label="Export preview" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <Spinner />
          </div>
        )}
      </div>
      <div className="label-mono absolute left-3 top-3">Preview</div>
    </div>
  );
}

/* ------------------------------------------------------------------ dialog */

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const project = useEditor((s) => s.project);
  const [settings, setSettings] = useState<ExportSettings>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastSize, setLastSize] = useState<{ key: string; doc: DesignDocument; bytes: number } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSettings(loadSettings());
  }, [open]);

  const update = useCallback((patch: Partial<ExportSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const { format } = settings;
  const isRaster = format === "png" || format === "jpeg" || format === "webp";
  const alphaCapable = format === "png" || format === "webp" || format === "svg";
  const transparent = alphaCapable && settings.transparent;

  const docW = doc?.width ?? 1;
  const docH = doc?.height ?? 1;
  const customW = settings.customWidth > 0 ? settings.customWidth : docW * 2;
  const customH = Math.max(1, Math.round((customW * docH) / docW));
  const numericScale = settings.scale === "custom" ? customW / docW : Number(settings.scale);

  const rasterSize = useMemo(
    () => resolveRasterSize({ width: docW, height: docH }, settings.scale === "custom" ? { width: customW } : { scale: numericScale }),
    [docW, docH, settings.scale, customW, numericScale],
  );

  const settingsKey = JSON.stringify(settings);
  const actualBytes = lastSize && lastSize.key === settingsKey && lastSize.doc === doc ? lastSize.bytes : null;

  const estimate = useMemo(() => {
    if (!isRaster) return null;
    const px = rasterSize.width * rasterSize.height;
    const bpp = format === "png" ? (transparent ? 1.4 : 1.1) : format === "jpeg" ? 0.15 + settings.quality * 0.45 : 0.1 + settings.quality * 0.35;
    return px * bpp;
  }, [isRaster, rasterSize, format, transparent, settings.quality]);

  const pdfPage = doc ? pdfPageSize(doc, settings.pdfPage) : null;

  const scaleLabel = settings.scale === "custom" ? `${rasterSize.width}x${rasterSize.height}` : `${settings.scale}x`;
  const baseName = safeFilename(project?.name);
  const filename =
    format === "pdf"
      ? `${baseName}${settings.pdfPage === "match" ? "" : `-${settings.pdfPage}`}.pdf`
      : format === "svg"
        ? `${baseName}.svg`
        : `${baseName}@${scaleLabel}.${EXT[format]}`;

  const runExport = async () => {
    if (!doc || busy) return;
    setBusy(true);
    setProgress(0);
    setNotes([]);
    try {
      let blob: Blob;
      let extraNotes: string[] = [];
      let name = filename;
      if (isRaster) {
        const { exportRasterDetailed } = await import("./raster");
        setProgress(0.2);
        const res = await exportRasterDetailed(doc, {
          format,
          ...(settings.scale === "custom" ? { width: customW } : { scale: numericScale }),
          transparent,
          quality: settings.quality,
        });
        blob = res.blob;
        if (res.clamped) extraNotes.push(`Output was clamped to ${res.width} × ${res.height}px (browser canvas limit).`);
        if (format === "webp" && res.mime !== "image/webp") {
          extraNotes.push("This browser cannot encode WebP; a PNG was produced instead.");
          name = name.replace(/\.webp$/, ".png");
        }
      } else if (format === "svg") {
        const { exportSvgDetailed } = await import("./svg");
        setProgress(0.2);
        const res = await exportSvgDetailed(doc, { transparent, embedFonts: settings.embedFonts, imageScale: Math.min(3, Math.max(1, numericScale)) });
        blob = new Blob([res.svg], { type: "image/svg+xml;charset=utf-8" });
        extraNotes = res.notes;
      } else {
        const { exportPdfDetailed } = await import("./pdf");
        const res = await exportPdfDetailed(doc, {
          pageSize: settings.pdfPage,
          mode: settings.pdfMode,
          dpi: Number(settings.pdfDpi),
          title: project?.name,
          onProgress: setProgress,
        });
        blob = res.blob;
        extraNotes = res.notes;
      }
      setProgress(1);
      downloadBlob(blob, name);
      setLastSize({ key: settingsKey, doc, bytes: blob.size });
      setNotes(extraNotes);
      toast({
        kind: "success",
        title: `Exported ${name}`,
        description: `${formatBytes(blob.size)}${extraNotes.length ? ` · ${extraNotes[0]}` : ""}`,
      });
    } catch (e) {
      toast({ kind: "error", title: "Export failed", description: e instanceof Error ? e.message : "Something went wrong while exporting." });
    } finally {
      setBusy(false);
    }
  };

  if (!doc) return null;

  const dimsReadout = isRaster
    ? `${rasterSize.width} × ${rasterSize.height} px`
    : format === "svg"
      ? `${docW} × ${docH} · vector`
      : pdfPage
        ? `${Math.round(pdfPage.width)} × ${Math.round(pdfPage.height)} pt · ${Math.round((pdfPage.width / 72) * 25.4)} × ${Math.round((pdfPage.height / 72) * 25.4)} mm`
        : "";

  let step = 0;
  const idx = () => String(++step).padStart(2, "0");

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Export"
      eyebrow={project?.name ?? "Document"}
      width="max-w-4xl"
      footer={
        <>
          <span className="mr-auto truncate font-mono text-[11px] text-subtle" title={filename}>
            {filename}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={runExport} disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <Spinner /> {format === "pdf" && progress > 0 ? `Exporting ${Math.round(progress * 100)}%` : "Exporting…"}
              </>
            ) : (
              <>
                <Download size={14} /> Export {FORMAT_OPTIONS.find((o) => o.value === format)?.label}
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <ExportPreview doc={doc} transparent={transparent} jpeg={format === "jpeg"} />

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <SectionLabel index={idx()}>Format</SectionLabel>
            <Segmented value={format} options={FORMAT_OPTIONS} onChange={(v) => update({ format: v })} size="md" />
            <p className="text-[11px] text-muted">{FORMAT_NOTE[format]}</p>
          </section>

          {(isRaster || format === "svg") && (
            <section className="flex flex-col gap-2">
              <SectionLabel index={idx()}>{format === "svg" ? "Embedded image density" : "Scale"}</SectionLabel>
              <Segmented
                value={settings.scale}
                options={[
                  { value: "1", label: "1×" },
                  { value: "2", label: "2×" },
                  { value: "3", label: "3×" },
                  ...(isRaster ? [{ value: "custom" as const, label: "Custom" }] : []),
                ]}
                onChange={(v) => update({ scale: v, ...(v === "custom" && settings.customWidth <= 0 ? { customWidth: docW * 2 } : {}) })}
              />
              {isRaster && settings.scale === "custom" && (
                <div className="flex items-center gap-2">
                  <DimInput label="W" value={customW} onChange={(w) => update({ customWidth: w })} />
                  <Lock size={12} className="shrink-0 text-subtle" aria-label="Aspect ratio locked" />
                  <DimInput label="H" value={customH} onChange={(h) => update({ customWidth: Math.max(1, Math.round((h * docW) / docH)) })} />
                </div>
              )}
            </section>
          )}

          {format === "pdf" && (
            <section className="flex flex-col gap-2">
              <SectionLabel index={idx()}>Page</SectionLabel>
              <Segmented
                value={settings.pdfPage}
                options={[
                  { value: "match", label: "Document" },
                  { value: "A4", label: "A4" },
                  { value: "A3", label: "A3" },
                  { value: "Letter", label: "Letter" },
                ]}
                onChange={(v) => update({ pdfPage: v })}
              />
              <div className="label-mono mt-1">Mode</div>
              <Segmented
                value={settings.pdfMode}
                options={[
                  { value: "vector", label: "Vector + raster", title: "Vector shapes, raster text and images" },
                  { value: "flatten", label: "Flatten", title: "Single full-page raster (exact blend modes)" },
                ]}
                onChange={(v) => update({ pdfMode: v })}
              />
              <div className="label-mono mt-1">Raster resolution</div>
              <Segmented
                value={settings.pdfDpi}
                options={[
                  { value: "150", label: "150 dpi" },
                  { value: "300", label: "300 dpi" },
                ]}
                onChange={(v) => update({ pdfDpi: v })}
              />
              <p className="text-[11px] text-muted">
                {settings.pdfMode === "vector"
                  ? "Shapes stay vector. Text, images and textures are rasterised at the chosen resolution to keep exact typography. Blend modes render as normal."
                  : "The whole page is one high-resolution image — most faithful for blend modes and effects."}
              </p>
            </section>
          )}

          <section className="flex flex-col gap-1.5">
            <SectionLabel index={idx()}>Output</SectionLabel>
            <div className="grid grid-cols-2 gap-px border border-line bg-line">
              <Readout label="Dimensions" value={dimsReadout} />
              <Readout
                label={actualBytes !== null ? "File size" : "Est. size"}
                value={actualBytes !== null ? formatBytes(actualBytes) : estimate !== null ? `≈ ${formatBytes(estimate)}` : "After export"}
              />
            </div>
            {isRaster && rasterSize.clamped && (
              <p className="text-[11px] text-accent">
                Clamped to the browser limit ({MAX_CANVAS_SIDE}px / 268 MP). Requested {Math.round(docW * rasterSize.requestedScale)} ×{" "}
                {Math.round(docH * rasterSize.requestedScale)} px.
              </p>
            )}
          </section>

          {format !== "pdf" && (
            <section className="flex flex-col gap-2">
              <SectionLabel index={idx()}>Options</SectionLabel>
              {alphaCapable && <Toggle label="Transparent background" checked={settings.transparent} onChange={(v) => update({ transparent: v })} />}
              {(format === "jpeg" || format === "webp") && (
                <Slider
                  label="Quality"
                  value={Math.round(settings.quality * 100)}
                  min={30}
                  max={100}
                  onChange={(v) => update({ quality: v / 100 })}
                  format={(v) => `${v}%`}
                />
              )}
              {format === "svg" && <Toggle label="Embed fonts (Google Fonts)" checked={settings.embedFonts} onChange={(v) => update({ embedFonts: v })} />}
            </section>
          )}

          {notes.length > 0 && (
            <ul className="flex flex-col gap-1 border-l border-accent pl-3 text-[11px] text-muted">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-bg px-2.5 py-2">
      <span className="label-mono">{label}</span>
      <span className="font-mono text-[12px] tabular-nums text-fg">{value}</span>
    </div>
  );
}

function DimInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (s: string) => {
    const v = Math.round(parseFloat(s));
    if (Number.isFinite(v) && v > 0) onChange(Math.min(MAX_CANVAS_SIDE * 4, v));
    setDraft(null);
  };
  return (
    <label className="flex h-7 flex-1 items-center rounded-[2px] border border-line focus-within:border-fg">
      <span className="label-mono w-6 text-center">{label}</span>
      <input
        aria-label={label === "W" ? "Width in pixels" : "Height in pixels"}
        inputMode="numeric"
        className="h-full w-full min-w-0 bg-transparent pr-1 text-right font-mono text-[11px] text-fg outline-none"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
        }}
      />
      <span className="pr-1.5 font-mono text-[10px] text-subtle">px</span>
    </label>
  );
}
