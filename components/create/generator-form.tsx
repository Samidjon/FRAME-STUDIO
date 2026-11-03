"use client";

import { useState, type ReactNode } from "react";
import { Pipette, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { Button, Segmented, Slider, Spinner, cx } from "@/components/shared/ui";
import { GEN_STYLES } from "@/core/composition/styles";
import { BUILTIN_IMAGES } from "@/core/rendering/builtin-images";
import { FORMAT_PRESETS } from "@/types/project";
import type { Direction } from "@/core/composition/types";
import { toast } from "@/stores/ui-store";
import { FormatGlyph } from "./format-glyph";
import { ImageDrop, builtinPick, extractPalette, useBuiltinThumbs, type PickedImage } from "./image-drop";

export interface GeneratorForm {
  image: PickedImage | null;
  logo: PickedImage | null;
  title: string;
  subtitle: string;
  body: string;
  palette: string[];
  style: string;
  formatId: string;
  count: number;
  direction: Direction;
  density: number;
  asymmetry: number;
}

export const DEFAULT_FORM: GeneratorForm = {
  image: null,
  logo: null,
  title: "Form Follows Light",
  subtitle: "An exhibition on construction, rhythm and the grid",
  body: "Twelve studios explore how systems of proportion shape what we see. Open daily 10–18, talks every Thursday.",
  palette: [],
  style: "swiss",
  formatId: "ig-portrait",
  count: 10,
  direction: "auto",
  density: 0.5,
  asymmetry: 0.5,
};

const MAX_COLOURS = 5;
const HEX = /^#[0-9a-f]{6}$/i;

const STYLE_SWATCH: Record<string, string[]> = Object.fromEntries(GEN_STYLES.map((s) => [s.id, [s.palettes[0].background, s.palettes[0].ink, s.palettes[0].accent]]));

function Section({ n, title, aside, children }: { n: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-4">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="label-mono flex items-center gap-2" aria-hidden>
          <span className="text-accent">{n}</span>
          <span>{title}</span>
        </div>
        {aside}
      </div>
      {children}
    </fieldset>
  );
}

function Field({ label, children, count }: { label: string; children: ReactNode; count?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[11px] text-muted">
        {label}
        {count && <span className="font-mono text-[10px] text-subtle">{count}</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-[2px] border border-line-strong bg-transparent px-3 text-[13px] text-fg placeholder:text-subtle outline-none transition-colors focus:border-fg";

export function GeneratorFormPanel({
  form,
  patch,
  onGenerate,
  onRegenerate,
  busy,
  hasResults,
}: {
  form: GeneratorForm;
  patch: (p: Partial<GeneratorForm>) => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  busy: boolean;
  hasResults: boolean;
}) {
  const thumbs = useBuiltinThumbs(true);
  const [extracting, setExtracting] = useState(false);

  const setColour = (i: number, v: string) => patch({ palette: form.palette.map((c, k) => (k === i ? v.toUpperCase() : c)) });

  const useImagePalette = async () => {
    if (!form.image) return;
    if (form.image.palette?.length) {
      patch({ palette: form.image.palette.slice(0, MAX_COLOURS).map((c) => c.toUpperCase()) });
      return;
    }
    if (!form.image.preview) return;
    setExtracting(true);
    try {
      const cols = await extractPalette(form.image.preview, MAX_COLOURS);
      if (cols.length) patch({ palette: cols });
    } catch {
      toast({ kind: "error", title: "Could not read colours from this image" });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate();
      }}
    >
      <Section n="01" title="Image">
        <ImageDrop kind="image" label="Image" hint="PNG, JPG, WebP or SVG · stored locally" value={form.image} onChange={(image) => patch({ image })} />
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] text-muted">Or pick a studio image</div>
          <div className="grid grid-cols-5 gap-1.5">
            {BUILTIN_IMAGES.map((b) => {
              const active = form.image?.assetId === `builtin:${b.id}`;
              return (
                <button
                  type="button"
                  key={b.id}
                  title={b.label}
                  aria-label={`Use ${b.label}`}
                  aria-pressed={active}
                  onClick={() => patch({ image: active ? null : { ...builtinPick(b.id), preview: thumbs[b.id] ?? null } })}
                  className={cx("relative aspect-square overflow-hidden border transition-[border-color,transform] active:scale-[0.97]", active ? "border-accent outline outline-1 outline-accent" : "border-line hover:border-fg")}
                  style={{ background: `linear-gradient(135deg, ${b.palette[0]}, ${b.palette[1] ?? b.palette[0]})` }}
                >
                  {thumbs[b.id] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbs[b.id]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </button>
              );
            })}
          </div>
          {!form.image && <p className="mt-1.5 text-[11px] text-subtle">Without an image the style’s studio image is used.</p>}
        </div>
      </Section>

      <Section n="02" title="Logo" aside={<span className="font-mono text-[10px] text-subtle">Optional</span>}>
        <ImageDrop kind="logo" compact label="Logo" hint="Transparent PNG or SVG works best" value={form.logo} onChange={(logo) => patch({ logo })} />
      </Section>

      <Section n="03" title="Text">
        <div className="flex flex-col gap-3">
          <Field label="Title" count={`${form.title.length}/80`}>
            <input className={cx(inputCls, "h-9")} value={form.title} maxLength={80} required placeholder="Headline" onChange={(e) => patch({ title: e.target.value })} />
          </Field>
          <Field label="Subtitle" count={`${form.subtitle.length}/120`}>
            <input className={cx(inputCls, "h-9")} value={form.subtitle} maxLength={120} placeholder="Optional" onChange={(e) => patch({ subtitle: e.target.value })} />
          </Field>
          <Field label="Additional text" count={`${form.body.length}/400`}>
            <textarea className={cx(inputCls, "min-h-[84px] resize-y py-2 leading-relaxed")} value={form.body} maxLength={400} placeholder="Dates, a short description, credits…" onChange={(e) => patch({ body: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section
        n="04"
        title="Palette"
        aside={
          form.image ? (
            <button type="button" onClick={useImagePalette} disabled={extracting} className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg disabled:opacity-50">
              {extracting ? <Spinner className="h-3 w-3" /> : <Pipette size={12} />} Use image palette
            </button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {form.palette.map((c, i) => (
            <div key={i} className="group relative">
              <label className="block h-10 w-10 cursor-pointer border border-line-strong" style={{ background: c }} title={c}>
                <input type="color" className="sr-only" aria-label={`Colour ${i + 1}`} value={HEX.test(c) ? c : "#000000"} onChange={(e) => setColour(i, e.target.value)} />
              </label>
              <button
                type="button"
                aria-label={`Remove colour ${i + 1}`}
                onClick={() => patch({ palette: form.palette.filter((_, k) => k !== i) })}
                className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full border border-line-strong bg-bg text-fg group-hover:flex group-focus-within:flex"
              >
                <X size={9} />
              </button>
              <div className="mt-1 w-10 truncate text-center font-mono text-[9px] text-subtle">{c.slice(1)}</div>
            </div>
          ))}
          {form.palette.length < MAX_COLOURS && (
            <button
              type="button"
              aria-label="Add colour"
              onClick={() => patch({ palette: [...form.palette, ["#171717", "#F0EDE5", "#FF4D00", "#E9DAF5", "#888888"][form.palette.length % 5]] })}
              className="mb-4 flex h-10 w-10 items-center justify-center border border-dashed border-line-strong text-muted hover:border-fg hover:text-fg"
            >
              <Plus size={14} />
            </button>
          )}
          {form.palette.length > 0 && (
            <button type="button" onClick={() => patch({ palette: [] })} className="mb-4 ml-auto text-[11px] text-muted hover:text-fg">
              Clear
            </button>
          )}
        </div>
        {!form.palette.length && <p className="text-[11px] text-subtle">Empty: the style palette is used. Add up to five colours — roles (background, ink, accent) are assigned by contrast.</p>}
      </Section>

      <Section n="05" title="Style">
        <div role="radiogroup" aria-label="Style" className="grid grid-cols-2 gap-1.5">
          {GEN_STYLES.map((s) => {
            const active = form.style === s.id;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={active}
                key={s.id}
                onClick={() => patch({ style: s.id })}
                className={cx("flex items-center gap-2 border px-2.5 py-2 text-left text-[12px] transition-colors", active ? "border-fg bg-fg text-bg" : "border-line hover:border-fg")}
              >
                <span className="flex shrink-0" aria-hidden>
                  {STYLE_SWATCH[s.id].map((c, i) => (
                    <span key={i} className="-ml-0.5 h-3 w-3 border border-black/10 first:ml-0" style={{ background: c }} />
                  ))}
                </span>
                <span className="truncate">{s.name}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section n="06" title="Format">
        <div role="radiogroup" aria-label="Format" className="grid grid-cols-2 gap-1.5">
          {FORMAT_PRESETS.map((f) => {
            const active = form.formatId === f.id;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={active}
                key={f.id}
                onClick={() => patch({ formatId: f.id })}
                className={cx("flex items-center gap-2 border px-2 py-1.5 text-left transition-colors", active ? "border-fg bg-raised" : "border-line hover:border-fg")}
              >
                <FormatGlyph width={f.width} height={f.height} size={22} active={active} />
                <span className="min-w-0">
                  <span className="block truncate text-[12px]">{f.label}</span>
                  <span className="block font-mono text-[9px] text-subtle">
                    {f.width}×{f.height}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section n="07" title="Composition">
        <div className="flex flex-col gap-4">
          <Slider label="Variants" min={8} max={12} step={1} value={form.count} onChange={(count) => patch({ count })} format={(v) => String(v)} />
          <div>
            <div className="mb-1.5 text-[11px] text-muted">Direction</div>
            <Segmented<Direction>
              value={form.direction}
              onChange={(direction) => patch({ direction })}
              options={[
                { value: "auto", label: "Auto", title: "Auto — decided by your content" },
                { value: "typographic", label: "Type", title: "Typographic" },
                { value: "image-led", label: "Image", title: "Image-led" },
                { value: "balanced", label: "Balanced", title: "Balanced" },
              ]}
            />
          </div>
          <Slider label="Density" min={0} max={1} step={0.05} value={form.density} onChange={(density) => patch({ density })} format={(v) => (v < 0.34 ? "Airy" : v < 0.67 ? "Even" : "Packed") + ` ${Math.round(v * 100)}`} />
          <Slider label="Asymmetry" min={0} max={1} step={0.05} value={form.asymmetry} onChange={(asymmetry) => patch({ asymmetry })} format={(v) => (v < 0.34 ? "Calm" : v < 0.67 ? "Tension" : "Radical") + ` ${Math.round(v * 100)}`} />
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-1 flex gap-2 border-t border-line bg-bg/95 px-1 py-3 backdrop-blur">
        <Button type="submit" variant="accent" size="lg" className="flex-1" disabled={busy || !form.title.trim()}>
          {busy ? <Spinner /> : <Sparkles size={16} />}
          {busy ? "Composing…" : "Generate"}
        </Button>
        {hasResults && (
          <Button type="button" variant="secondary" size="lg" onClick={onRegenerate} disabled={busy || !form.title.trim()} title="New seed — new set of variations" aria-label="Regenerate with a new seed">
            <RefreshCw size={16} />
          </Button>
        )}
      </div>
    </form>
  );
}
