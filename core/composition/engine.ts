import type { Layer } from "@/types/layer";
import { createDocument } from "@/core/document/factory";
import { layerBounds } from "@/core/geometry/transform";
import { hashString, mulberry32 } from "@/core/geometry/random";
import { approxMeasure, type MeasureFn } from "@/core/text/layout";
import { ALGORITHMS, getAlgorithm } from "./algorithms";
import { createCtx, mirrorLayers } from "./kit";
import { getGenStyle } from "./styles";
import { repairDocument, validateDocument } from "./validate";
import type { AlgorithmId, CompositionProvider, GeneratedVariant, GeneratorInput } from "./types";

/**
 * Composition engine: chooses distinct algorithms for the brief, builds each
 * with a seeded RNG, repairs and validates it, and rejects near-duplicates.
 */

export const MIN_COUNT = 8;
export const MAX_COUNT = 12;
const MAX_ATTEMPTS = 4;
/** Below this signature distance two variants count as the same layout. */
const DUPLICATE_THRESHOLD = 0.22;
/** Algorithms whose alternative parameterisation is a horizontal mirror. */
const MIRROR_ON_VARIANT = new Set<AlgorithmId>(["type-top-image-bottom", "magazine", "modular-grid", "swiss"]);

export function clampCount(n: number) {
  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.round(Number.isFinite(n) ? n : 10)));
}

/** Algorithm order for the brief: direction affinity + style preference + seeded jitter. */
export function rankAlgorithms(input: GeneratorInput): AlgorithmId[] {
  const style = getGenStyle(input.style);
  const rng = mulberry32(hashString(`rank:${input.seed}:${input.style}:${input.direction}`));
  const dir = input.direction === "auto" ? (input.image ? "balanced" : "typographic") : input.direction;
  const scored = ALGORITHMS.map((a) => {
    const pref = style.preferred.indexOf(a.id);
    const styleBonus = pref < 0 ? 0 : (style.preferred.length - pref) * 0.12;
    return { id: a.id, s: a.affinity[dir] + styleBonus + rng() * 0.25 };
  });
  return scored.sort((a, b) => b.s - a.s).map((x) => x.id);
}

interface Signature {
  image: number[] | null;
  title: number[] | null;
  texts: number;
}

function signature(layers: Layer[], W: number, H: number): Signature {
  const norm = (l: Layer) => {
    const b = layerBounds(l);
    return [b.x / W, b.y / H, b.width / W, b.height / H];
  };
  const images = layers.filter((l) => l.type === "image" && !/^logo/i.test(l.name));
  const biggest = images.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const texts = layers.filter((l) => l.type === "text");
  const title = texts.find((t) => t.type === "text" && (t.name === "Title" || t.name === "Masthead" || t.name.startsWith("Title"))) ?? texts[0];
  return { image: biggest ? norm(biggest) : null, title: title ? norm(title) : null, texts: texts.length };
}

export function signatureDistance(a: Signature, b: Signature): number {
  const part = (x: number[] | null, y: number[] | null) => (x && y ? x.reduce((s, v, i) => s + Math.abs(v - y[i]), 0) : x || y ? 1 : 0);
  return part(a.image, b.image) + part(a.title, b.title) + (a.texts === b.texts ? 0 : 0.05);
}

interface Built {
  variant: GeneratedVariant;
  sig: Signature;
  ok: boolean;
}

function buildVariant(input: GeneratorInput, algorithm: AlgorithmId, variantNo: number, attempt: number, measure: MeasureFn): Built {
  const def = getAlgorithm(algorithm);
  const rng = mulberry32(hashString(`${input.seed}:${algorithm}:${variantNo}:${attempt}`));
  const c = createCtx(input, algorithm, variantNo, rng, measure);
  const comp = def.build(c);
  let layers = c.layers;
  if (variantNo === 1 && MIRROR_ON_VARIANT.has(algorithm)) layers = mirrorLayers(layers, c.W);
  let doc = createDocument(c.W, c.H, {
    background: { color: comp.background, transparent: false },
    layers,
    grid: { ...comp.grid, visible: false },
    guides: [],
    styleId: input.style,
  });
  doc = repairDocument(doc, measure);
  const res = validateDocument(doc, measure, { intentionalOverlap: c.overlap });
  const label = variantNo === 1 ? `${def.label} · Alt` : def.label;
  return {
    ok: res.ok,
    sig: signature(doc.layers, c.W, c.H),
    variant: {
      id: `${algorithm}-v${variantNo}-s${input.seed}${attempt ? `-a${attempt}` : ""}`,
      algorithm,
      label,
      doc,
      score: res.score,
      warnings: res.warnings,
      intentionalOverlap: [...c.overlap],
      variant: variantNo,
    },
  };
}

/** Generate `count` distinct, validated compositions. Deterministic for a given input. */
export function generateCompositions(input: GeneratorInput, measure: MeasureFn = approxMeasure): GeneratedVariant[] {
  const count = clampCount(input.count);
  const order = rankAlgorithms(input);
  // Primary pool: each algorithm once. Extra pool (only for 11–12): alternative parameterisations.
  const queue: { id: AlgorithmId; v: number }[] = order.map((id) => ({ id, v: 0 }));
  const extras: { id: AlgorithmId; v: number }[] = order.map((id) => ({ id, v: 1 }));
  const accepted: Built[] = [];
  const deferred: Built[] = [];

  const tryCandidate = (cand: { id: AlgorithmId; v: number }) => {
    let best: Built | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const b = buildVariant(input, cand.id, cand.v, attempt, measure);
      const dup = accepted.some((a) => signatureDistance(a.sig, b.sig) < DUPLICATE_THRESHOLD);
      if (b.ok && !dup) return { built: b, accepted: true };
      if (!best || (b.ok && !best.ok) || (b.ok === best.ok && b.variant.score > best.variant.score)) best = b;
    }
    return { built: best!, accepted: false };
  };

  for (const cand of queue) {
    if (accepted.length >= Math.min(count, ALGORITHMS.length)) break;
    const r = tryCandidate(cand);
    if (r.accepted) accepted.push(r.built);
    else deferred.push(r.built);
  }
  const fillFromExtras = () => {
    for (const cand of extras) {
      if (accepted.length >= count) break;
      if (accepted.some((a) => a.variant.algorithm === cand.id && a.variant.variant === cand.v)) continue;
      const r = tryCandidate(cand);
      if (r.accepted || r.built.ok) accepted.push(r.built);
    }
  };
  // 11–12: alternative parameterisations (mirrored / different grid) of the best-ranked algorithms.
  if (count > ALGORITHMS.length) fillFromExtras();
  // Rejected near-duplicates that are otherwise valid come before repeating a structure.
  if (accepted.length < count) {
    const usable = deferred.filter((d) => d.ok).sort((a, b) => b.variant.score - a.variant.score);
    for (const d of usable) {
      if (accepted.length >= count) break;
      accepted.push(d);
    }
  }
  if (accepted.length < count) fillFromExtras();
  return accepted.slice(0, count).map((b) => b.variant);
}

// ── provider registry ────────────────────────────────────────────────────────

export const localProvider: CompositionProvider = {
  id: "local",
  label: "Local algorithms",
  async generate(input, measure) {
    return generateCompositions(input, measure);
  },
};

const providers = new Map<string, CompositionProvider>([[localProvider.id, localProvider]]);
let defaultProviderId = localProvider.id;

export function registerProvider(p: CompositionProvider, makeDefault = false) {
  providers.set(p.id, p);
  if (makeDefault) defaultProviderId = p.id;
}

export function getProvider(id?: string): CompositionProvider {
  return providers.get(id ?? defaultProviderId) ?? localProvider;
}

export function listProviders(): CompositionProvider[] {
  return [...providers.values()];
}
