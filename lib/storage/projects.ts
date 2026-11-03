"use client";

import { getDB } from "@/lib/indexeddb/db";
import { migrateProject } from "@/core/serialization/migrate";
import { createProject, reidentifyLayers, uid } from "@/core/document/factory";
import type { Project, ProjectSummary } from "@/types/project";
import { renderThumbnail } from "@/lib/image/thumbnail";

/**
 * Local project repository (IndexedDB). The cloud layer (lib/supabase/sync)
 * mirrors writes when a user is signed in; local storage is always the
 * primary copy so the editor never blocks on the network.
 */

const RECOVERY_PREFIX = "frame:recovery:";

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("projects", "updatedAt");
  const thumbs = await db.getAll("thumbnails");
  const tmap = new Map(thumbs.map((t) => [t.id, t.blob]));
  return all
    .reverse()
    .map((p) => {
      const blob = tmap.get(p.id);
      return {
        id: p.id,
        name: p.name,
        width: p.doc.width,
        height: p.doc.height,
        updatedAt: p.updatedAt,
        createdAt: p.createdAt,
        favorite: p.favorite,
        visibility: p.visibility,
        thumbnail: blob ? URL.createObjectURL(blob) : null,
      };
    });
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDB();
  const raw = await db.get("projects", id);
  let project = raw ? migrateProject(raw) : null;
  // Crash recovery: a newer snapshot in localStorage wins over IndexedDB.
  const rec = readRecovery(id);
  if (rec && (!project || rec.updatedAt > project.updatedAt)) project = rec;
  return project;
}

export async function saveProject(p: Project, opts: { thumbnail?: boolean } = {}): Promise<Project> {
  const db = await getDB();
  const next = { ...p, updatedAt: Date.now() };
  await db.put("projects", next);
  clearRecovery(p.id);
  if (opts.thumbnail !== false) {
    // Thumbnails are best-effort and must never fail a save.
    renderThumbnail(next.doc)
      .then((blob) => db.put("thumbnails", { id: p.id, blob, updatedAt: Date.now() }))
      .catch(() => undefined);
  }
  return next;
}

export async function updateProjectMeta(id: string, patch: Partial<Pick<Project, "name" | "favorite" | "visibility" | "publishedAt" | "category" | "tags">>) {
  const db = await getDB();
  const p = await db.get("projects", id);
  if (!p) throw new Error("Project not found");
  const next = { ...p, ...patch, updatedAt: Date.now() };
  await db.put("projects", next);
  return next;
}

export async function deleteProject(id: string) {
  const db = await getDB();
  await db.delete("projects", id);
  await db.delete("thumbnails", id);
  clearRecovery(id);
}

export async function duplicateProject(id: string, name?: string): Promise<Project> {
  const src = await getProject(id);
  if (!src) throw new Error("Project not found");
  const copy = createProject(name ?? `${src.name} — Copy`, { ...structuredClone(src.doc), layers: reidentifyLayers(src.doc.layers) }, {
    originId: src.id,
    category: src.category,
    tags: [...src.tags],
  });
  return saveProject(copy);
}

/** Create a fully independent project from any document (templates, generator, explore copies). */
export async function createProjectFromDoc(name: string, doc: Project["doc"], extra: Partial<Project> = {}) {
  const p = createProject(name, { ...structuredClone(doc), layers: reidentifyLayers(doc.layers) }, extra);
  return saveProject(p);
}

export async function getThumbnailUrl(id: string): Promise<string | null> {
  const db = await getDB();
  const t = await db.get("thumbnails", id);
  return t ? URL.createObjectURL(t.blob) : null;
}

/* ---------- synchronous crash-recovery snapshots (survive tab close) ---------- */

export function writeRecovery(p: Project) {
  try {
    localStorage.setItem(RECOVERY_PREFIX + p.id, JSON.stringify(p));
  } catch {
    /* quota exceeded — IndexedDB autosave remains the source of truth */
  }
}

export function readRecovery(id: string): Project | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(RECOVERY_PREFIX + id) : null;
    return raw ? migrateProject(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearRecovery(id: string) {
  try {
    localStorage.removeItem(RECOVERY_PREFIX + id);
  } catch {
    /* ignore */
  }
}

export function exportProjectFile(p: Project): Blob {
  return new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
}

export async function importProjectFile(file: File): Promise<Project> {
  const text = await file.text();
  const p = migrateProject(JSON.parse(text));
  return saveProject({ ...p, id: uid("prj"), name: `${p.name} (imported)` });
}
