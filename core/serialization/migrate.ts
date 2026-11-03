import { CURRENT_SCHEMA_VERSION, type Project } from "@/types/project";
import { defaultEffects, defaultGrid } from "@/core/document/factory";
import type { Layer } from "@/types/layer";

/**
 * Versioned project migrations. Each step upgrades a raw object from version
 * N to N+1. Never edit an existing step — add a new one and bump
 * CURRENT_SCHEMA_VERSION in types/project.ts.
 */
type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const steps: Record<number, (p: Raw) => Raw> = {
  // v1 → v2: layers gained blendMode/groupId; grid gained ratios + snap.
  1: (p) => {
    const doc = p.doc ?? {};
    doc.layers = (doc.layers ?? []).map((l: Raw) => ({ blendMode: "normal", groupId: null, ...l }));
    const g = doc.grid ?? defaultGrid(doc.width ?? 1080, doc.height ?? 1350);
    doc.grid = { columnRatios: [1, 2], rowRatios: [1, 1, 1], snap: true, ...g };
    return { ...p, doc, schemaVersion: 2 };
  },
  // v2 → v3: image effects gained duotone/overlay/halftone objects; projects gained publishing consent.
  2: (p) => {
    const doc = p.doc;
    doc.layers = doc.layers.map((l: Raw) =>
      l.type === "image" ? { ...l, effects: { ...defaultEffects(), ...(l.effects ?? {}) }, border: l.border ?? { width: 0, color: "#171717" } } : l,
    );
    return { publishedAt: null, tags: [], originId: null, ownerId: null, category: null, ...p, doc, schemaVersion: 3 };
  },
};

export class ProjectFormatError extends Error {}

export function migrateProject(input: unknown): Project {
  if (!input || typeof input !== "object") throw new ProjectFormatError("Project data is not an object");
  let p = structuredClone(input) as Raw;
  if (!p.doc || !Array.isArray(p.doc.layers)) throw new ProjectFormatError("Project is missing its document");
  let v = typeof p.schemaVersion === "number" ? p.schemaVersion : 1;
  if (v > CURRENT_SCHEMA_VERSION) throw new ProjectFormatError(`Project was saved by a newer version (v${v}) of FRAME STUDIO`);
  while (v < CURRENT_SCHEMA_VERSION) {
    const step = steps[v];
    if (!step) throw new ProjectFormatError(`No migration from schema v${v}`);
    p = step(p);
    v = p.schemaVersion;
  }
  p.doc.layers = (p.doc.layers as Layer[]).filter((l) => l && typeof l.id === "string" && ["text", "image", "shape", "texture"].includes(l.type));
  return p as Project;
}

export function serializeProject(p: Project): string {
  return JSON.stringify({ ...p, schemaVersion: CURRENT_SCHEMA_VERSION });
}

export function parseProject(json: string): Project {
  return migrateProject(JSON.parse(json));
}
