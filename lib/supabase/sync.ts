"use client";

/**
 * Cloud mirror for Senitukang Studio.
 *
 * IndexedDB is always the primary copy (lib/storage/*). When Supabase is
 * configured AND a user is signed in, this module mirrors projects / assets to
 * Postgres + Storage and powers the public gallery. Every function throws a
 * friendly `CloudError` when the cloud is unavailable — callers can show
 * `err.message` directly.
 *
 * Wiring:
 *   - The editor autosave dispatches `window.dispatchEvent(new CustomEvent("frame:project-saved", { detail: { project } }))`.
 *   - `useCloudSync()` (or the `<CloudSyncBridge/>` null component) listens for
 *     that event and pushes the project (debounced per project), and pulls the
 *     user's remote projects once per sign-in.
 *   - It dispatches `frame:cloud-sync` with detail `CloudSyncStatus` whenever
 *     the sync status changes, and `frame:projects-changed` after a pull wrote
 *     projects locally (list views can refresh on it).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ASSET_BUCKET, THUMB_BUCKET, getSupabase, isCloudConfigured } from "@/lib/supabase/client";
import { getDB } from "@/lib/indexeddb/db";
import { createProjectFromDoc, getProject, saveProject, updateProjectMeta } from "@/lib/storage/projects";
import { migrateProject } from "@/core/serialization/migrate";
import { useAuth } from "@/stores/auth-store";
import type { DesignDocument, Project } from "@/types/project";
import type { AssetKind, AssetMeta, StoredAsset } from "@/types/assets";

/* ------------------------------------------------------------------ */
/* Errors & guards                                                     */
/* ------------------------------------------------------------------ */

export type CloudErrorCode = "not_configured" | "auth_required" | "consent_required" | "not_found" | "remote";

export class CloudError extends Error {
  constructor(
    message: string,
    public code: CloudErrorCode,
  ) {
    super(message);
    this.name = "CloudError";
  }
}

export const PROJECT_SAVED_EVENT = "frame:project-saved";
export const CLOUD_SYNC_EVENT = "frame:cloud-sync";
export const PROJECTS_CHANGED_EVENT = "frame:projects-changed";

export interface ProjectSavedDetail {
  project: Project;
}

function requireClient(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) throw new CloudError("Cloud not configured — Senitukang Studio is running in local mode.", "not_configured");
  return sb;
}

async function requireUser(): Promise<{ sb: SupabaseClient; user: User }> {
  const sb = requireClient();
  let user = useAuth.getState().user;
  if (!user) {
    const { data } = await sb.auth.getSession();
    user = data.session?.user ?? null;
  }
  if (!user) throw new CloudError("Sign in required to use cloud features.", "auth_required");
  return { sb, user };
}

function remote(err: { message: string } | null, what: string): void {
  if (err) throw new CloudError(`${what}: ${err.message}`, "remote");
}

export function cloudAvailable(): boolean {
  return isCloudConfigured && Boolean(useAuth.getState().user);
}

/* ------------------------------------------------------------------ */
/* Row types & mapping                                                 */
/* ------------------------------------------------------------------ */

interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  doc: DesignDocument;
  schema_version: number;
  visibility: "private" | "public";
  published_at: string | null;
  category: string | null;
  tags: string[] | null;
  thumbnail_path: string | null;
  favorite: boolean;
  origin_id: string | null;
  created_at: string;
  updated_at: string;
}

interface GalleryRow {
  id: string;
  owner_id: string;
  name: string;
  doc: DesignDocument;
  schema_version: number;
  category: string | null;
  tags: string[] | null;
  thumbnail_path: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  author_username: string | null;
  author_display_name: string | null;
  like_count: number;
}

interface AssetRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  kind: AssetKind;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  font_family: string | null;
  favorite: boolean;
  folder: string | null;
  storage_path: string;
  created_at: string;
}

export interface GalleryItem {
  id: string;
  ownerId: string;
  name: string;
  doc: DesignDocument;
  category: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  publishedAt: number;
  likeCount: number;
  likedByMe: boolean;
  author: { username: string | null; displayName: string | null };
}

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);
const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString() : null);

function rowToProject(r: ProjectRow): Project {
  return migrateProject({
    schemaVersion: r.schema_version,
    id: r.id,
    name: r.name,
    doc: r.doc,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
    favorite: r.favorite,
    visibility: r.visibility,
    publishedAt: r.published_at ? ms(r.published_at) : null,
    category: r.category,
    originId: r.origin_id,
    ownerId: r.owner_id,
    tags: r.tags ?? [],
  });
}

/** Migrate a bare document coming from the network (gallery rows). */
function migrateDoc(doc: DesignDocument, schemaVersion: number): DesignDocument {
  return migrateProject({ schemaVersion, id: "remote", name: "remote", doc, createdAt: 0, updatedAt: 0, favorite: false, visibility: "private", publishedAt: null, category: null, originId: null, ownerId: null, tags: [] }).doc;
}

function thumbPublicUrl(sb: SupabaseClient, path: string | null): string | null {
  if (!path) return null;
  return sb.storage.from(THUMB_BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

async function localThumbnail(id: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return (await db.get("thumbnails", id))?.blob ?? null;
  } catch {
    return null;
  }
}

/**
 * Upsert a project row owned by the current user and upload its thumbnail to
 * `thumbnails/{uid}/{projectId}.webp`. Visibility is mirrored only when the
 * local project carries an explicit publishing consent timestamp.
 */
export async function pushProject(project: Project, thumbnailBlob?: Blob | null): Promise<void> {
  const { sb, user } = await requireUser();
  if (project.ownerId && project.ownerId !== user.id) throw new CloudError("This project belongs to another account.", "auth_required");

  let thumbnailPath: string | null = null;
  const thumb = thumbnailBlob ?? (await localThumbnail(project.id));
  if (thumb) {
    const path = `${user.id}/${project.id}.webp`;
    const { error } = await sb.storage.from(THUMB_BUCKET).upload(path, thumb, { upsert: true, contentType: thumb.type || "image/webp", cacheControl: "60" });
    if (!error) thumbnailPath = path; // thumbnails are best-effort
  }

  const published = project.visibility === "public" && project.publishedAt != null;
  const row: Omit<ProjectRow, "created_at" | "updated_at" | "thumbnail_path"> & { created_at: string; updated_at: string; thumbnail_path?: string } = {
    id: project.id,
    owner_id: user.id,
    name: project.name.slice(0, 120),
    doc: project.doc,
    schema_version: project.schemaVersion,
    visibility: published ? "public" : "private",
    published_at: published ? iso(project.publishedAt) : null,
    category: project.category,
    tags: project.tags.slice(0, 12),
    favorite: project.favorite,
    origin_id: project.originId,
    created_at: iso(project.createdAt) ?? new Date().toISOString(),
    updated_at: iso(project.updatedAt) ?? new Date().toISOString(),
  };
  if (thumbnailPath) row.thumbnail_path = thumbnailPath;
  const { error } = await sb.from("projects").upsert(row, { onConflict: "id" });
  remote(error, "Could not save project to the cloud");
}

export async function deleteRemoteProject(id: string): Promise<void> {
  const { sb, user } = await requireUser();
  const { error } = await sb.from("projects").delete().eq("id", id).eq("owner_id", user.id);
  remote(error, "Could not delete the cloud copy");
  await sb.storage.from(THUMB_BUCKET).remove([`${user.id}/${id}.webp`]);
}

/** Download any image assets a document references that are missing locally. */
async function ensureRemoteAssets(sb: SupabaseClient, userId: string, doc: DesignDocument) {
  const ids = [...new Set(doc.layers.flatMap((l) => (l.type === "image" ? [l.assetId] : [])))];
  if (!ids.length) return;
  const db = await getDB();
  const missing: string[] = [];
  for (const id of ids) if (!(await db.get("assets", id))) missing.push(id);
  if (!missing.length) return;
  const { data } = await sb.from("assets").select("*").eq("owner_id", userId).in("id", missing);
  for (const r of (data ?? []) as AssetRow[]) {
    const { data: blob } = await sb.storage.from(ASSET_BUCKET).download(r.storage_path);
    if (!blob) continue;
    const stored: StoredAsset = {
      id: r.id, kind: r.kind, name: r.name, mime: r.mime, size: r.size, width: r.width, height: r.height,
      fontFamily: r.font_family, favorite: r.favorite, folder: r.folder, projectId: r.project_id, ownerId: r.owner_id,
      createdAt: ms(r.created_at), remotePath: r.storage_path, blob, thumb: null,
    };
    await db.put("assets", stored);
  }
}

export interface PullResult {
  pulled: number;
  pushed: number;
  failed: number;
}

/**
 * Two-way merge by updatedAt (newer wins):
 *   - remote newer / missing locally → written to IndexedDB (thumbnail regenerated)
 *   - local newer / missing remotely (and owned by nobody or this user) → pushed
 */
export async function pullProjects(): Promise<PullResult> {
  const { sb, user } = await requireUser();
  const { data, error } = await sb.from("projects").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false });
  remote(error, "Could not load your cloud projects");
  const rows = (data ?? []) as ProjectRow[];
  const db = await getDB();
  const result: PullResult = { pulled: 0, pushed: 0, failed: 0 };
  const remoteIds = new Map<string, number>();

  for (const row of rows) {
    remoteIds.set(row.id, ms(row.updated_at));
    try {
      const local = await db.get("projects", row.id);
      const remoteUpdated = ms(row.updated_at);
      if (local && local.updatedAt >= remoteUpdated) continue;
      const project = rowToProject(row);
      await ensureRemoteAssets(sb, user.id, project.doc).catch(() => undefined);
      await saveProject(project, { thumbnail: true });
      // saveProject stamps "now"; restore the remote timestamp so the merge stays stable.
      await db.put("projects", { ...project, updatedAt: remoteUpdated });
      result.pulled++;
    } catch {
      result.failed++;
    }
  }

  const locals = await db.getAll("projects");
  for (const p of locals) {
    if (p.ownerId && p.ownerId !== user.id) continue;
    const r = remoteIds.get(p.id);
    if (r !== undefined && r >= p.updatedAt) continue;
    try {
      await pushProject(migrateProject(p));
      result.pushed++;
    } catch {
      result.failed++;
    }
  }

  if (result.pulled && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED_EVENT));
  return result;
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export async function uploadAsset(meta: AssetMeta, blob: Blob): Promise<string> {
  const { sb, user } = await requireUser();
  const path = `${user.id}/${meta.id}`;
  const contentType = meta.kind === "font" ? "application/octet-stream" : meta.mime;
  const up = await sb.storage.from(ASSET_BUCKET).upload(path, blob, { upsert: true, contentType });
  remote(up.error, "Upload failed");
  const row: AssetRow = {
    id: meta.id, owner_id: user.id, project_id: meta.projectId, kind: meta.kind, name: meta.name.slice(0, 120), mime: meta.mime.slice(0, 64),
    size: blob.size, width: meta.width, height: meta.height, font_family: meta.fontFamily, favorite: meta.favorite,
    folder: meta.folder, storage_path: path, created_at: new Date(meta.createdAt).toISOString(),
  };
  const { error } = await sb.from("assets").upsert(row, { onConflict: "id" });
  remote(error, "Could not register the asset");
  try {
    const db = await getDB();
    const local = await db.get("assets", meta.id);
    if (local) await db.put("assets", { ...local, remotePath: path, ownerId: user.id });
  } catch {
    /* local bookkeeping is best-effort */
  }
  return path;
}

/* ------------------------------------------------------------------ */
/* Publishing (explicit consent only)                                  */
/* ------------------------------------------------------------------ */

export interface PublishOptions {
  category?: string | null;
  tags?: string[];
}

/** Publish a project to the public gallery. `consent` must be literally `true`. */
export async function publishProject(id: string, consent: true, opts: PublishOptions = {}): Promise<Project> {
  if (consent !== true) throw new CloudError("Publishing requires your explicit consent.", "consent_required");
  await requireUser();
  const local = await getProject(id);
  if (!local) throw new CloudError("Project not found.", "not_found");
  const next = await updateProjectMeta(id, {
    visibility: "public",
    publishedAt: Date.now(),
    category: opts.category ?? local.category,
    tags: opts.tags ?? local.tags,
  });
  try {
    await pushProject(next);
  } catch (e) {
    // Roll back the local flag so local state never claims a publish that failed.
    await updateProjectMeta(id, { visibility: local.visibility, publishedAt: local.publishedAt });
    throw e;
  }
  return next;
}

export async function unpublishProject(id: string): Promise<void> {
  const { sb, user } = await requireUser();
  const { error } = await sb.from("projects").update({ visibility: "private", published_at: null }).eq("id", id).eq("owner_id", user.id);
  remote(error, "Could not unpublish");
  await updateProjectMeta(id, { visibility: "private", publishedAt: null }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Gallery & likes                                                     */
/* ------------------------------------------------------------------ */

export type GallerySort = "featured" | "recent" | "liked";

export interface GalleryQuery {
  search?: string;
  category?: string | null;
  sort?: GallerySort;
  limit?: number;
  ownerId?: string;
}

/** Strip characters that have meaning in PostgREST filter syntax. */
function safeTerm(s: string) {
  return s.replace(/[%_,.()*{}"'\\:]/g, " ").trim().slice(0, 60);
}

export async function fetchPublicGallery(q: GalleryQuery = {}): Promise<GalleryItem[]> {
  const sb = requireClient();
  const limit = Math.min(Math.max(q.limit ?? 48, 1), 120);
  let query = sb.from("public_gallery").select("*");
  if (q.ownerId) query = query.eq("owner_id", q.ownerId);
  if (q.category) query = query.eq("category", q.category);
  const term = q.search ? safeTerm(q.search) : "";
  if (term) {
    const tag = term.toLowerCase().split(/\s+/)[0];
    query = query.or(`name.ilike.%${term}%,tags.cs.{${tag}}`);
  }
  if (q.sort === "liked") query = query.order("like_count", { ascending: false }).order("published_at", { ascending: false });
  else query = query.order("published_at", { ascending: false });
  const { data, error } = await query.limit(q.sort === "featured" ? Math.min(limit * 3, 200) : limit);
  remote(error, "Could not load the gallery");
  const rows = (data ?? []) as GalleryRow[];

  const user = useAuth.getState().user;
  let liked = new Set<string>();
  if (user && rows.length) {
    const { data: l } = await sb.from("likes").select("project_id").eq("user_id", user.id).in("project_id", rows.map((r) => r.id));
    liked = new Set(((l ?? []) as { project_id: string }[]).map((x) => x.project_id));
  }

  let items: GalleryItem[] = [];
  for (const r of rows) {
    try {
      items.push({
        id: r.id,
        ownerId: r.owner_id,
        name: r.name,
        doc: migrateDoc(r.doc, r.schema_version),
        category: r.category,
        tags: r.tags ?? [],
        thumbnailUrl: thumbPublicUrl(sb, r.thumbnail_path),
        publishedAt: ms(r.published_at),
        likeCount: r.like_count ?? 0,
        likedByMe: liked.has(r.id),
        author: { username: r.author_username, displayName: r.author_display_name },
      });
    } catch {
      /* skip rows with unreadable documents */
    }
  }
  if (q.sort === "featured") {
    const now = Date.now();
    const score = (i: GalleryItem) => (i.likeCount + 1) / Math.pow((now - i.publishedAt) / 3.6e6 + 2, 1.2);
    items = items.sort((a, b) => score(b) - score(a)).slice(0, limit);
  }
  return items;
}

export async function likeProject(projectId: string): Promise<void> {
  const { sb, user } = await requireUser();
  const { error } = await sb.from("likes").upsert({ user_id: user.id, project_id: projectId }, { onConflict: "user_id,project_id", ignoreDuplicates: true });
  remote(error, "Could not like");
}

export async function unlikeProject(projectId: string): Promise<void> {
  const { sb, user } = await requireUser();
  const { error } = await sb.from("likes").delete().eq("user_id", user.id).eq("project_id", projectId);
  remote(error, "Could not remove like");
}

/** Copy a published design into the local library as an independent project. */
export async function copyPublicProject(item: Pick<GalleryItem, "id" | "name" | "doc" | "category" | "tags">): Promise<Project> {
  return createProjectFromDoc(item.name, item.doc, { originId: item.id, category: item.category, tags: [...item.tags], visibility: "private", publishedAt: null, ownerId: null });
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

export interface PublicProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at?: string;
}

export async function getProfileByUsername(username: string): Promise<PublicProfile | null> {
  const sb = requireClient();
  const u = username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
  if (!u) return null;
  const { data, error } = await sb.from("profiles").select("id, username, display_name, bio, avatar_url, created_at").eq("username", u).maybeSingle();
  remote(error, "Could not load profile");
  return (data as PublicProfile | null) ?? null;
}

export async function updateMyProfile(patch: { display_name?: string | null; bio?: string | null; username?: string | null }): Promise<PublicProfile> {
  const { sb, user } = await requireUser();
  const { data, error } = await sb.from("profiles").update(patch).eq("id", user.id).select("id, username, display_name, bio, avatar_url, created_at").single();
  if (error) {
    if (error.code === "23505") throw new CloudError("That username is already taken.", "remote");
    if (error.code === "23514") throw new CloudError("Username must be 3–24 characters: a–z, 0–9 or underscore.", "remote");
    remote(error, "Could not update profile");
  }
  const p = data as PublicProfile;
  useAuth.getState().setProfile({ id: p.id, username: p.username, display_name: p.display_name, bio: p.bio, avatar_url: p.avatar_url });
  return p;
}

export async function fetchMyCloudStats(): Promise<{ projects: number; published: number; likes: number }> {
  const { sb, user } = await requireUser();
  const [all, pub] = await Promise.all([
    sb.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    sb.from("public_gallery").select("like_count").eq("owner_id", user.id),
  ]);
  remote(all.error, "Could not load stats");
  remote(pub.error, "Could not load stats");
  const rows = (pub.data ?? []) as { like_count: number }[];
  return { projects: all.count ?? 0, published: rows.length, likes: rows.reduce((s, r) => s + (r.like_count ?? 0), 0) };
}

/* ------------------------------------------------------------------ */
/* Collections                                                         */
/* ------------------------------------------------------------------ */

export interface CloudCollection {
  id: string;
  name: string;
  isPublic: boolean;
  projectIds: string[];
}

export async function listCollections(): Promise<CloudCollection[]> {
  const { sb, user } = await requireUser();
  const { data, error } = await sb.from("collections").select("id, name, is_public, collection_items(project_id)").eq("owner_id", user.id).order("created_at");
  remote(error, "Could not load collections");
  type Row = { id: string; name: string; is_public: boolean; collection_items: { project_id: string }[] | null };
  return ((data ?? []) as Row[]).map((r) => ({ id: r.id, name: r.name, isPublic: r.is_public, projectIds: (r.collection_items ?? []).map((i) => i.project_id) }));
}

export async function createCollection(name: string, isPublic = false): Promise<CloudCollection> {
  const { sb, user } = await requireUser();
  const { data, error } = await sb.from("collections").insert({ owner_id: user.id, name: name.trim().slice(0, 80), is_public: isPublic }).select("id, name, is_public").single();
  remote(error, "Could not create collection");
  const r = data as { id: string; name: string; is_public: boolean };
  return { id: r.id, name: r.name, isPublic: r.is_public, projectIds: [] };
}

export async function addToCollection(collectionId: string, projectId: string): Promise<void> {
  const { sb } = await requireUser();
  const { error } = await sb.from("collection_items").upsert({ collection_id: collectionId, project_id: projectId }, { onConflict: "collection_id,project_id", ignoreDuplicates: true });
  remote(error, "Could not add to collection");
}

export async function removeFromCollection(collectionId: string, projectId: string): Promise<void> {
  const { sb } = await requireUser();
  const { error } = await sb.from("collection_items").delete().eq("collection_id", collectionId).eq("project_id", projectId);
  remote(error, "Could not remove from collection");
}

/* ------------------------------------------------------------------ */
/* React hook                                                          */
/* ------------------------------------------------------------------ */

export interface CloudSyncStatus {
  state: "off" | "idle" | "syncing" | "error";
  lastSyncedAt: number | null;
  error: string | null;
}

let pulledFor: string | null = null;

/**
 * Mount once (e.g. in Providers) while the app runs. When signed in it pulls
 * the user's projects on mount and pushes on every `frame:project-saved`
 * event (debounced 1.5 s per project so the async thumbnail can land first).
 */
export function useCloudSync(): CloudSyncStatus & { syncNow: () => Promise<PullResult | null> } {
  const userId = useAuth((s) => s.user?.id ?? null);
  const [status, setStatus] = useState<CloudSyncStatus>({ state: "off", lastSyncedAt: null, error: null });
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const update = useCallback((s: CloudSyncStatus) => {
    setStatus(s);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<CloudSyncStatus>(CLOUD_SYNC_EVENT, { detail: s }));
  }, []);

  const syncNow = useCallback(async () => {
    if (!isCloudConfigured || !userId) return null;
    update({ state: "syncing", lastSyncedAt: null, error: null });
    try {
      const r = await pullProjects();
      update({ state: "idle", lastSyncedAt: Date.now(), error: null });
      return r;
    } catch (e) {
      update({ state: "error", lastSyncedAt: null, error: e instanceof Error ? e.message : "Sync failed" });
      return null;
    }
  }, [userId, update]);

  useEffect(() => {
    if (!isCloudConfigured || !userId) {
      setStatus({ state: "off", lastSyncedAt: null, error: null });
      return;
    }
    if (pulledFor !== userId) {
      pulledFor = userId;
      void syncNow();
    } else {
      setStatus((s) => (s.state === "off" ? { ...s, state: "idle" } : s));
    }
    const map = timers.current;
    const onSaved = (ev: Event) => {
      const project = (ev as CustomEvent<ProjectSavedDetail>).detail?.project;
      if (!project?.id) return;
      const prev = map.get(project.id);
      if (prev) clearTimeout(prev);
      map.set(
        project.id,
        setTimeout(() => {
          map.delete(project.id);
          pushProject(project)
            .then(() => update({ state: "idle", lastSyncedAt: Date.now(), error: null }))
            .catch((e: unknown) => update({ state: "error", lastSyncedAt: null, error: e instanceof Error ? e.message : "Push failed" }));
        }, 1500),
      );
    };
    window.addEventListener(PROJECT_SAVED_EVENT, onSaved);
    return () => {
      window.removeEventListener(PROJECT_SAVED_EVENT, onSaved);
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, [userId, syncNow, update]);

  return { ...status, syncNow };
}

/** Null component wrapper so the hook can be mounted from a layout/provider. */
export function CloudSyncBridge(): null {
  useCloudSync();
  return null;
}
