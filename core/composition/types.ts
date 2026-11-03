import type { MeasureFn } from "@/core/text/layout";
import type { DesignDocument } from "@/types/project";

/**
 * Contracts of the algorithmic composition engine. Everything here is pure
 * data so the engine runs in tests, workers and (later) behind an AI provider.
 */

export interface AssetRef {
  /** IndexedDB asset id or "builtin:<id>". */
  assetId: string;
  width: number;
  height: number;
}

export type Direction = "auto" | "typographic" | "image-led" | "balanced";

export interface GeneratorInput {
  image: AssetRef | null;
  logo: AssetRef | null;
  title: string;
  subtitle: string;
  body: string;
  /** User colours (hex). May be empty — the style palette is used then. */
  palette: string[];
  /** Style id (swiss, brutalist, minimal, experimental, japanese, modernist, bauhaus, retro-futurism, monochrome, acid). */
  style: string;
  format: { width: number; height: number };
  /** 8–12 variants. */
  count: number;
  direction: Direction;
  /** 0 = airy, 1 = packed. */
  density: number;
  /** 0 = symmetric / calm, 1 = strongly asymmetric. */
  asymmetry: number;
  seed: number;
}

export type AlgorithmId =
  | "type-top-image-bottom"
  | "full-bleed"
  | "asymmetric-editorial"
  | "modular-grid"
  | "centered-minimal"
  | "vertical-type"
  | "split"
  | "experimental-type"
  | "swiss"
  | "magazine";

export interface GeneratedVariant {
  /** Stable for (seed, algorithm, variant) — safe to use as a cache key. */
  id: string;
  algorithm: AlgorithmId;
  label: string;
  doc: DesignDocument;
  /** 0..100 — higher is better. */
  score: number;
  warnings: string[];
  /** Ids of text layers that overlap on purpose (experimental typography). */
  intentionalOverlap: string[];
  /** 0 = primary parameterisation, 1 = mirrored / alternative grid. */
  variant: number;
}

/** Pluggable generator backend (local algorithms today, AI later). */
export interface CompositionProvider {
  id: string;
  label: string;
  generate(input: GeneratorInput, measure: MeasureFn): Promise<GeneratedVariant[]>;
}
