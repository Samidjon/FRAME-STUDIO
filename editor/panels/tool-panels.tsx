"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Minus, Pentagon, RectangleHorizontal, Star, Triangle, Upload, Egg, Spline, Search } from "lucide-react";
import type { ShapeKind, TextureKind } from "@/types/layer";
import type { AssetKind, AssetMeta } from "@/types/assets";
import { useEditor } from "@/stores/editor-store";
import { addAssetFromMeta, addFullBleedImage, addImage, addShape, addSvgPath, addText, addTexture, uploadAndPlace } from "@/editor/actions";
import { TEXT_STYLES } from "@/editor/typography/text-properties";
import { BUILTIN_IMAGES, getBuiltinImage } from "@/core/rendering/builtin-images";
import { TEXTURES, renderTexture } from "@/core/rendering/textures";
import { listAssets } from "@/lib/storage/assets";
import { Button, ColorField, Segmented, cx } from "@/components/shared/ui";
import { GridSettingsPanel } from "@/editor/grid/grid-settings";
import { Section } from "./section";
import { TEMPLATES } from "@/core/templates";
import { STYLE_PRESETS, applyStyle } from "@/core/presets/styles";
import { DocPreview } from "@/components/shared/doc-preview";
import { reidentifyLayers } from "@/core/document/factory";
import { allFonts, loadFont } from "@/lib/fonts/catalog";
import { toast } from "@/stores/ui-store";

function Drawer({ title, index, children }: { title: string; index: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="font-mono text-[9px] text-accent">{index}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{title}</span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export function TextPanel() {
  const [q, setQ] = useState("");
  const fonts = allFonts().filter((f) => f.family.toLowerCase().includes(q.toLowerCase()));
  return (
    <Drawer index="T" title="Typography">
      <Section index="01" title="Add text">
        {TEXT_STYLES.map((s, i) => (
          <button
            key={s.role}
            onClick={() => addText(s.role)}
            className="group flex items-baseline justify-between border-b border-line py-1.5 text-left last:border-0 hover:text-accent"
            data-testid={`add-text-${s.role}`}
          >
            <span
              className="font-display tracking-tight"
              style={{ fontSize: [26, 19, 15, 13, 11, 10][i], fontWeight: [700, 600, 500, 400, 400, 500][i], fontFamily: s.role === "metadata" ? "var(--font-mono)" : undefined, textTransform: s.role === "metadata" ? "uppercase" : undefined }}
            >
              {s.label}
            </span>
            <span className="font-mono text-[9px] text-subtle">{String(i + 1).padStart(2, "0")}</span>
          </button>
        ))}
      </Section>
      <Section index="02" title="Typeface catalogue">
        <div className="flex items-center gap-2 border border-line px-2">
          <Search size={12} className="text-subtle" />
          <input aria-label="Search typefaces" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="h-7 w-full bg-transparent text-[12px] outline-none" />
        </div>
        <ul className="flex flex-col">
          {fonts.map((f) => (
            <FontRow key={f.family} family={f.family} meta={`${f.category} · ${f.weights.length}w`} sample={f.sample} />
          ))}
        </ul>
        <p className="text-[11px] text-subtle">Click to add a heading in that typeface. Upload your own WOFF/WOFF2/TTF fonts in Assets.</p>
      </Section>
    </Drawer>
  );
}

function FontRow({ family, meta, sample }: { family: string; meta: string; sample?: string }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && void loadFont(family));
    io.observe(el);
    return () => io.disconnect();
  }, [family]);
  return (
    <li ref={ref}>
      <button onClick={() => addText("heading", undefined, { fontFamily: family } as never)} className="flex w-full items-center justify-between gap-2 border-b border-line py-2 text-left hover:text-accent">
        <span className="truncate text-[18px] leading-tight" style={{ fontFamily: `"${family}", Inter` }}>
          {sample ?? family}
        </span>
        <span className="shrink-0 font-mono text-[9px] text-subtle">{meta}</span>
      </button>
    </li>
  );
}

function BuiltinThumb({ id, label, onClick, onDouble }: { id: string; label: string; onClick: () => void; onDouble?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const src = getBuiltinImage(id);
      const c = ref.current;
      if (!src || !c) return;
      const ctx = c.getContext("2d")!;
      const s = Math.max(c.width / src.width, c.height / src.height);
      ctx.drawImage(src, (c.width - src.width * s) / 2, (c.height - src.height * s) / 2, src.width * s, src.height * s);
    }, 30);
    return () => clearTimeout(t);
  }, [id]);
  // Delay the single click so a double-click doesn't also insert a framed copy.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <button
      onClick={() => {
        if (!onDouble) return onClick();
        if (clickTimer.current) clearTimeout(clickTimer.current);
        clickTimer.current = setTimeout(onClick, 240);
      }}
      onDoubleClick={() => {
        if (clickTimer.current) clearTimeout(clickTimer.current);
        onDouble?.();
      }}
      className="group relative block" aria-label={`Add ${label}`} title={`${label} — click to add, double-click to fill page`}>
      <canvas ref={ref} width={160} height={160} className="aspect-square w-full border border-line bg-sunken group-hover:border-accent" />
      <span className="absolute bottom-1 left-1 bg-black/60 px-1 font-mono text-[8px] uppercase text-white">{label}</span>
    </button>
  );
}

export function ImagePanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<(AssetMeta & { thumbUrl: string | null })[]>([]);
  const refresh = () => listAssets().then((a) => setAssets(a.filter((x) => x.kind !== "font"))).catch(() => undefined);
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => () => assets.forEach((a) => a.thumbUrl && URL.revokeObjectURL(a.thumbUrl)), [assets]);
  return (
    <Drawer index="I" title="Images">
      <Section index="01" title="Upload">
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            await uploadAndPlace(e.dataTransfer.files);
            refresh();
          }}
          className="flex flex-col items-center gap-2 border border-dashed border-line-strong px-3 py-6 text-center hover:border-accent"
          data-testid="upload-image"
        >
          <Upload size={18} className="text-subtle" />
          <span className="text-[12px]">Drop or choose files</span>
          <span className="font-mono text-[9px] text-subtle">PNG · JPG · WEBP · SVG</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          data-testid="image-file-input"
          onChange={async (e) => {
            if (e.target.files) await uploadAndPlace(e.target.files);
            e.target.value = "";
            refresh();
          }}
        />
      </Section>
      {assets.length > 0 && (
        <Section index="02" title="Your library">
          <div className="grid grid-cols-3 gap-1.5">
            {assets.map((a) => (
              <button
                key={a.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("application/x-frame-asset", JSON.stringify({ id: a.id, kind: a.kind, width: a.width, height: a.height, name: a.name }))}
                onClick={() => addAssetFromMeta(a)}
                className="aspect-square overflow-hidden border border-line bg-sunken hover:border-accent"
                title={a.name}
                aria-label={`Add ${a.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.thumbUrl && <img src={a.thumbUrl} alt="" className="h-full w-full object-cover" />}
              </button>
            ))}
          </div>
        </Section>
      )}
      <Section index={assets.length ? "03" : "02"} title="Studio images">
        <p className="text-[11px] text-subtle">Procedurally generated photographs. Double-click to fill the page.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {BUILTIN_IMAGES.map((b) => (
            <BuiltinThumb key={b.id} id={b.id} label={b.label} onClick={() => addImage(`builtin:${b.id}`, b, undefined, b.label)} onDouble={() => addFullBleedImage(`builtin:${b.id}`, b.label)} />
          ))}
        </div>
      </Section>
    </Drawer>
  );
}

const SHAPES: { kind: ShapeKind; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { kind: "rect", label: "Rectangle", icon: RectangleHorizontal },
  { kind: "circle", label: "Circle", icon: Circle },
  { kind: "ellipse", label: "Ellipse", icon: Egg },
  { kind: "line", label: "Line", icon: Minus },
  { kind: "triangle", label: "Triangle", icon: Triangle },
  { kind: "polygon", label: "Polygon", icon: Pentagon },
  { kind: "star", label: "Star", icon: Star },
];

export function ShapesPanel() {
  const [svg, setSvg] = useState("");
  return (
    <Drawer index="S" title="Shapes">
      <Section index="01" title="Geometry">
        <div className="grid grid-cols-3 gap-1.5">
          {SHAPES.map((s) => (
            <button key={s.kind} onClick={() => addShape(s.kind)} data-testid={`add-shape-${s.kind}`} className="flex aspect-square flex-col items-center justify-center gap-1.5 border border-line hover:border-accent hover:text-accent">
              <s.icon size={20} />
              <span className="font-mono text-[9px] uppercase">{s.label}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section index="02" title="Custom SVG">
        <textarea
          aria-label="SVG path data"
          value={svg}
          onChange={(e) => setSvg(e.target.value)}
          placeholder={'Paste path data — e.g. M0 0 L100 0 L50 100 Z — or an <svg> with <path> elements'}
          className="h-24 w-full resize-none border border-line bg-transparent p-2 font-mono text-[10px] outline-none focus:border-fg"
        />
        <Button size="sm" variant="secondary" disabled={!svg.trim()} onClick={() => addSvgPath(svg)}>
          <Spline size={13} /> Add vector path
        </Button>
        <p className="text-[11px] text-subtle">Full SVG files (with colours) can be uploaded as images in the Images tab.</p>
      </Section>
    </Drawer>
  );
}

function TextureThumb({ kind }: { kind: TextureKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#F0EDE5";
    ctx.fillRect(0, 0, 120, 120);
    ctx.drawImage(renderTexture({ texture: kind, color: "#171717", scale: 0.6, seed: 7 }, 120, 120, 1), 0, 0);
  }, [kind]);
  return <canvas ref={ref} width={120} height={120} className="aspect-square w-full border border-line" />;
}

export function TexturesPanel() {
  return (
    <Drawer index="X" title="Textures">
      <Section index="01" title="Add texture layer">
        <div className="grid grid-cols-2 gap-1.5">
          {TEXTURES.map((t) => (
            <button key={t.id} onClick={() => addTexture(t.id)} className="group flex flex-col gap-1 text-left" aria-label={`Add ${t.label}`}>
              <div className="group-hover:outline group-hover:outline-1 group-hover:outline-accent">
                <TextureThumb kind={t.id} />
              </div>
              <span className="font-mono text-[9px] uppercase text-subtle group-hover:text-fg">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-subtle">Textures are full layers: change opacity, scale and blend mode in Properties.</p>
      </Section>
    </Drawer>
  );
}

const SWATCHES = ["#F0EDE5", "#FFFFFF", "#E9DAF5", "#FF4D00", "#171717", "#292929", "#888888", "#0E2A2C", "#C2361B", "#2B3245", "#D9D4C9", "#FFD400"];

export function BackgroundPanel() {
  const doc = useEditor((s) => s.doc)!;
  const setDoc = useEditor((s) => s.setDoc);
  const setBg = (color: string) => setDoc((d) => ({ ...d, background: { color, transparent: false } }), { key: "bg" });
  return (
    <Drawer index="B" title="Background">
      <Section index="01" title="Colour">
        <div className="grid grid-cols-6 gap-1.5">
          {SWATCHES.map((c) => (
            <button key={c} aria-label={`Background ${c}`} onClick={() => setBg(c)} className={cx("aspect-square border", doc.background.color.toUpperCase() === c ? "border-accent outline outline-1 outline-accent" : "border-line-strong")} style={{ background: c }} />
          ))}
        </div>
        <ColorField label="Background" value={doc.background.color} onChange={(c) => c && setBg(c)} />
        <Segmented
          value={doc.background.transparent ? "transparent" : "solid"}
          onChange={(v) => setDoc((d) => ({ ...d, background: { ...d.background, transparent: v === "transparent" } }))}
          options={[
            { value: "solid", label: "Solid" },
            { value: "transparent", label: "Transparent" },
          ]}
        />
      </Section>
      <Section index="02" title="Image background">
        <div className="grid grid-cols-2 gap-1.5">
          {BUILTIN_IMAGES.slice(0, 6).map((b) => (
            <BuiltinThumb key={b.id} id={b.id} label={b.label} onClick={() => addFullBleedImage(`builtin:${b.id}`, b.label)} />
          ))}
        </div>
      </Section>
    </Drawer>
  );
}

export function GridPanel() {
  return (
    <Drawer index="G" title="Swiss grid">
      <GridSettingsPanel index="01" />
    </Drawer>
  );
}

export function AssetsPanel() {
  const [kind, setKind] = useState<AssetKind | "all">("all");
  const [assets, setAssets] = useState<(AssetMeta & { thumbUrl: string | null })[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => listAssets().then(setAssets).catch(() => setAssets([]));
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    assets.filter((a) => a.kind === "font" && a.fontFamily).forEach((a) => void loadFont(a.fontFamily!));
  }, [assets]);
  const list = assets.filter((a) => kind === "all" || a.kind === kind);
  return (
    <Drawer index="A" title="Assets">
      <div className="flex flex-col gap-2 p-3">
        <div className="scroll-thin flex gap-1 overflow-x-auto">
          {(["all", "image", "logo", "svg", "font", "texture"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cx("shrink-0 px-1.5 py-0.5 font-mono text-[9px] uppercase", kind === k ? "bg-fg text-bg" : "text-subtle hover:text-fg")}>
              {k}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={13} /> Upload images or fonts
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/svg+xml,.woff,.woff2,.ttf,.otf"
          className="hidden"
          onChange={async (e) => {
            const files = e.target.files;
            if (!files) return;
            const { importFile } = await import("@/lib/storage/assets");
            for (const f of Array.from(files)) {
              try {
                await importFile(f, { kind: kind === "logo" || kind === "texture" ? kind : undefined, projectId: useEditor.getState().project?.id ?? null });
              } catch (err) {
                toast({ kind: "error", title: `Could not import ${f.name}`, description: err instanceof Error ? err.message : String(err) });
              }
            }
            e.target.value = "";
            refresh();
          }}
        />
        <p className="text-[11px] text-subtle">Drag assets onto the canvas, or click to insert. Manage everything in the Assets section.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {list.map((a) => (
            <button
              key={a.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/x-frame-asset", JSON.stringify({ id: a.id, kind: a.kind, width: a.width, height: a.height, fontFamily: a.fontFamily, name: a.name }))}
              onClick={() => addAssetFromMeta(a)}
              className="group flex flex-col gap-1 text-left"
              title={a.name}
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden border border-line bg-sunken group-hover:border-accent">
                {a.kind === "font" ? (
                  <span className="text-3xl" style={{ fontFamily: `"${a.fontFamily}"` }}>Aa</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  a.thumbUrl && <img src={a.thumbUrl} alt="" className="h-full w-full object-contain" />
                )}
              </div>
              <span className="truncate font-mono text-[9px] text-subtle">{a.name}</span>
            </button>
          ))}
        </div>
        {!list.length && <div className="border border-dashed border-line-strong p-5 text-center text-[11px] text-subtle">No assets yet.</div>}
      </div>
    </Drawer>
  );
}

export function TemplatesPanel() {
  const doc = useEditor((s) => s.doc)!;
  const built = useMemo(() => TEMPLATES.map((t) => ({ t, doc: t.build() })), []);
  const [mode, setMode] = useState<"replace" | "insert">("replace");
  const apply = (tdoc: typeof doc) => {
    if (mode === "replace") {
      useEditor.getState().setDoc((d) => ({ ...d, width: tdoc.width, height: tdoc.height, background: tdoc.background, grid: tdoc.grid, layers: reidentifyLayers(tdoc.layers), styleId: tdoc.styleId, guides: [] }));
      setTimeout(() => useEditor.getState().fitToScreen(), 0);
    } else {
      const sx = doc.width / tdoc.width;
      const sy = doc.height / tdoc.height;
      const k = Math.min(sx, sy);
      const hasLogo = doc.layers.some((l) => l.brandLocked);
      const layers = reidentifyLayers(tdoc.layers.filter((l) => !(hasLogo && l.brandLocked))).map((l) => {
        const scaled = { ...l, x: l.x * sx, y: l.y * sy, width: l.width * k, height: l.height * k };
        return l.type === "text" ? { ...scaled, fontSize: l.fontSize * k } : scaled;
      });
      useEditor.getState().addLayers(layers);
    }
    toast({ kind: "success", title: mode === "replace" ? "Template applied" : "Template layers inserted", description: "Undo with Ctrl+Z." });
  };
  return (
    <Drawer index="L" title="Templates">
      <div className="flex flex-col gap-2 p-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "replace", label: "Replace design" },
            { value: "insert", label: "Insert layers" },
          ]}
        />
        <div className="grid grid-cols-2 gap-2">
          {built.map(({ t, doc: td }) => (
            <button key={t.id} onClick={() => apply(td)} className="group flex flex-col gap-1 text-left" title={t.description}>
              <DocPreview doc={td} cacheKey={`tpl-${t.id}`} maxSide={260} className="w-full border border-line group-hover:border-accent" />
              <span className="truncate text-[11px]">{t.name}</span>
              <span className="font-mono text-[8px] uppercase text-subtle">{t.category}</span>
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

export function StylesPanel() {
  const doc = useEditor((s) => s.doc)!;
  const [pending, setPending] = useState<{ id: string; palette: number } | null>(null);
  const previewDoc = useMemo(() => (pending ? applyStyle(doc, pending.id, pending.palette) : null), [doc, pending]);
  return (
    <Drawer index="P" title="Style presets">
      <div className="flex flex-col gap-2 p-3">
        <p className="text-[11px] text-subtle">Preview a visual character, then apply. Positions and text are never changed; colours and typefaces are remapped by role.</p>
        {previewDoc && pending && (
          <div className="flex flex-col gap-2 border border-accent p-2">
            <DocPreview doc={previewDoc} cacheKey={`style-${pending.id}-${pending.palette}-${useEditor.getState().revision}`} maxSide={300} className="w-full" />
            <div className="flex gap-1.5">
              <Button size="sm" variant="primary" className="flex-1" onClick={() => {
                const next = applyStyle(doc, pending.id, pending.palette);
                [...new Set(next.layers.flatMap((l) => (l.type === "text" ? [l.fontFamily] : [])))].forEach((f) => void loadFont(f));
                useEditor.getState().setDoc(() => next);
                setPending(null);
                toast({ kind: "success", title: "Style applied", description: "Undo with Ctrl+Z." });
              }}>Apply</Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {STYLE_PRESETS.map((s) => (
          <div key={s.id} className={cx("border p-2", doc.styleId === s.id ? "border-fg" : "border-line")}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-medium">{s.name}</span>
              <span className="font-mono text-[9px] text-subtle">{s.fonts.display}</span>
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {s.palettes.map((p, i) => (
                <button key={i} onClick={() => setPending({ id: s.id, palette: i })} aria-label={`Preview ${s.name} palette ${i + 1}`} className={cx("flex h-6 flex-1 overflow-hidden border", pending?.id === s.id && pending.palette === i ? "border-accent" : "border-line-strong")}>
                  {[p.background, p.ink, p.accent, p.muted].map((c, j) => (
                    <span key={j} className="flex-1" style={{ background: c }} />
                  ))}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
