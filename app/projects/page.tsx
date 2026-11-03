"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, Copy, Download, ExternalLink, Globe, Lock, Pencil, Plus, Search, Star, Trash2, Upload } from "lucide-react";
import { SiteShell } from "@/components/navigation/site-header";
import { Button, Dialog, EmptyState, Segmented, Select, Spinner, TextInput, cx } from "@/components/shared/ui";
import { deleteProject, duplicateProject, exportProjectFile, getProject, importProjectFile, listProjects, updateProjectMeta } from "@/lib/storage/projects";
import { PROJECTS_CHANGED_EVENT, deleteRemoteProject, pullProjects } from "@/lib/supabase/sync";
import { PublishDialog } from "@/components/gallery/publish-dialog";
import { ErrorPanel, OverflowMenu, PageHeader, SkeletonGrid, downloadBlob, errorMessage, relativeTime, slugify } from "@/components/gallery/utils";
import { useAuth } from "@/stores/auth-store";
import { useUi } from "@/stores/ui-store";
import type { ProjectSummary } from "@/types/project";

type Tab = "all" | "recent" | "favorites";
type Sort = "edited" | "name" | "created";

const RECENT_MS = 14 * 24 * 3600 * 1000;

export default function ProjectsPage() {
  const router = useRouter();
  const toast = useUi((s) => s.toast);
  const cloud = useAuth((s) => s.cloud);
  const user = useAuth((s) => s.user);

  const [items, setItems] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("edited");
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);

  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const urls = useRef<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const revokeAll = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listProjects();
      revokeAll();
      urls.current = list.flatMap((p) => (p.thumbnail ? [p.thumbnail] : []));
      setItems(list);
    } catch (e) {
      setError(errorMessage(e, "Your local library could not be opened."));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const onChanged = () => void load();
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
      revokeAll();
    };
  }, [load]);

  const visible = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    let list = items.filter((p) => !q || p.name.toLowerCase().includes(q));
    if (tab === "favorites") list = list.filter((p) => p.favorite);
    if (tab === "recent") list = list.filter((p) => Date.now() - p.updatedAt < RECENT_MS);
    const by: Record<Sort, (a: ProjectSummary, b: ProjectSummary) => number> = {
      edited: (a, b) => b.updatedAt - a.updatedAt,
      name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
      created: (a, b) => b.createdAt - a.createdAt,
    };
    return [...list].sort(tab === "recent" ? by.edited : by[sort]);
  }, [items, query, tab, sort]);

  const patchLocal = (id: string, patch: Partial<ProjectSummary>) => setItems((list) => list?.map((p) => (p.id === id ? { ...p, ...patch } : p)) ?? null);

  const toggleFavorite = async (p: ProjectSummary) => {
    patchLocal(p.id, { favorite: !p.favorite });
    try {
      await updateProjectMeta(p.id, { favorite: !p.favorite });
    } catch (e) {
      patchLocal(p.id, { favorite: p.favorite });
      toast({ kind: "error", title: "Could not update favourite", description: errorMessage(e) });
    }
  };

  const doRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim().slice(0, 120);
    if (!name) return;
    try {
      await updateProjectMeta(renaming.id, { name });
      patchLocal(renaming.id, { name, updatedAt: Date.now() });
      setRenaming(null);
    } catch (e) {
      toast({ kind: "error", title: "Rename failed", description: errorMessage(e) });
    }
  };

  const doDuplicate = async (p: ProjectSummary) => {
    try {
      const copy = await duplicateProject(p.id);
      toast({ kind: "success", title: "Duplicated", description: copy.name });
      // Give the async thumbnail a moment before refreshing.
      setTimeout(() => void load(), 400);
    } catch (e) {
      toast({ kind: "error", title: "Duplicate failed", description: errorMessage(e) });
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    const p = deleting;
    setDeleting(null);
    try {
      await deleteProject(p.id);
      setItems((list) => list?.filter((x) => x.id !== p.id) ?? null);
      if (cloud && user) await deleteRemoteProject(p.id).catch(() => undefined);
      toast({ kind: "info", title: "Project deleted", description: p.name });
    } catch (e) {
      toast({ kind: "error", title: "Delete failed", description: errorMessage(e) });
    }
  };

  const doExport = async (p: ProjectSummary) => {
    try {
      const full = await getProject(p.id);
      if (!full) throw new Error("Project not found");
      downloadBlob(exportProjectFile(full), `${slugify(full.name)}.frame.json`);
    } catch (e) {
      toast({ kind: "error", title: "Export failed", description: errorMessage(e) });
    }
  };

  const doImport = async (files: FileList | null) => {
    if (!files?.length) return;
    setImporting(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      try {
        if (f.size > 25 * 1024 * 1024) throw new Error("File is larger than 25 MB");
        await importProjectFile(f);
        ok++;
      } catch (e) {
        toast({ kind: "error", title: `Could not import ${f.name}`, description: e instanceof SyntaxError ? "The file is not valid JSON." : errorMessage(e) });
      }
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    if (ok) {
      toast({ kind: "success", title: `Imported ${ok} project${ok > 1 ? "s" : ""}` });
      setTimeout(() => void load(), 400);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const r = await pullProjects();
      toast({ kind: "success", title: "Synced", description: `${r.pulled} downloaded · ${r.pushed} uploaded${r.failed ? ` · ${r.failed} failed` : ""}` });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Sync failed", description: errorMessage(e) });
    } finally {
      setSyncing(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: items?.length ?? 0,
      recent: items?.filter((p) => Date.now() - p.updatedAt < RECENT_MS).length ?? 0,
      favorites: items?.filter((p) => p.favorite).length ?? 0,
    }),
    [items],
  );

  return (
    <SiteShell>
      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8 md:py-14">
        <PageHeader
          index="04 — PROJECTS"
          title="My Projects"
          lead={cloud && user ? "Stored on this device and mirrored to your cloud account." : "Stored locally in this browser. Export JSON files to back them up."}
          actions={
            <>
              {cloud && user && (
                <Button onClick={syncNow} disabled={syncing}>
                  {syncing ? <Spinner /> : <CloudDownload size={14} />} Sync now
                </Button>
              )}
              <Button onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? <Spinner /> : <Upload size={14} />} Import JSON
              </Button>
              <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={(e) => void doImport(e.target.files)} />
              <Button variant="primary" onClick={() => router.push("/create")}>
                <Plus size={14} /> New project
              </Button>
            </>
          }
        />

        <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:-mx-8 md:flex-row md:items-center md:px-8">
          <div className="w-full md:w-[340px]">
            <Segmented
              size="md"
              value={tab}
              onChange={setTab}
              options={[
                { value: "all", label: `All ${counts.all}` },
                { value: "recent", label: `Recent ${counts.recent}` },
                { value: "favorites", label: `Favorites ${counts.favorites}` },
              ]}
            />
          </div>
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              aria-label="Search projects"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              className="h-9 w-full rounded-[2px] border border-line-strong bg-transparent pl-9 pr-3 text-[13px] outline-none focus:border-fg"
            />
          </div>
          <div className="w-full md:w-44">
            <Select
              value={sort}
              onChange={setSort}
              options={[
                { value: "edited", label: "Last edited" },
                { value: "name", label: "Name" },
                { value: "created", label: "Created" },
              ]}
            />
          </div>
        </div>

        <div className="pt-8">
          {items === null ? (
            <SkeletonGrid />
          ) : error ? (
            <ErrorPanel title="Library unavailable" message={error} onRetry={() => void load()} />
          ) : items.length === 0 ? (
            <EmptyState
              index="00 — EMPTY"
              title="No projects yet."
              body="Start from a blank format, a template or the generator. Everything you make is saved automatically on this device."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => router.push("/create")}>
                    <Plus size={14} /> New project
                  </Button>
                  <Button onClick={() => router.push("/templates")}>Browse templates</Button>
                </div>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              index="00 — NO MATCH"
              title={tab === "favorites" ? "No favourites yet." : "Nothing matches."}
              body={tab === "favorites" ? "Star a project to pin it here." : "Try a different search or tab."}
              action={
                <Button
                  onClick={() => {
                    setQuery("");
                    setTab("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((p, i) => (
                <li key={p.id} className="group flex min-w-0 flex-col">
                  <div className="relative">
                    <Link href={`/editor/${p.id}`} className="block border border-line bg-sunken transition-colors hover:border-fg" aria-label={`Open ${p.name}`}>
                      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden p-4">
                        {p.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.thumbnail} alt="" className="max-h-full max-w-full object-contain shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]" draggable={false} />
                        ) : (
                          <div
                            className="flex max-h-full max-w-full items-center justify-center border border-line-strong bg-bg"
                            style={{ aspectRatio: `${p.width} / ${p.height}`, width: p.width >= p.height ? "100%" : "auto", height: p.height > p.width ? "100%" : "auto" }}
                          >
                            <span className="label-mono">
                              {p.width}×{p.height}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                    <span className="label-mono pointer-events-none absolute left-2 top-2 bg-bg/90 px-1.5 py-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <button
                      type="button"
                      aria-label={p.favorite ? "Remove from favourites" : "Add to favourites"}
                      aria-pressed={p.favorite}
                      onClick={() => void toggleFavorite(p)}
                      className={cx(
                        "absolute right-2 top-2 flex h-7 w-7 items-center justify-center border bg-bg/90 transition-opacity",
                        p.favorite ? "border-accent text-accent" : "border-line text-muted opacity-100 hover:text-fg md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100",
                      )}
                    >
                      <Star size={13} fill={p.favorite ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/editor/${p.id}`} className="block truncate text-[14px] font-medium tracking-tight hover:text-accent">
                        {p.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-subtle">
                        <span>
                          {p.width}×{p.height}
                        </span>
                        <span aria-hidden>·</span>
                        <span title={new Date(p.updatedAt).toLocaleString()}>{relativeTime(p.updatedAt)}</span>
                        <span
                          className={cx("inline-flex items-center gap-1 border px-1 py-px", p.visibility === "public" ? "border-accent/60 text-accent" : "border-line")}
                          title={p.visibility === "public" ? "Published" : "Private"}
                        >
                          {p.visibility === "public" ? <Globe size={9} /> : <Lock size={9} />}
                          {p.visibility === "public" ? "Public" : "Private"}
                        </span>
                      </div>
                    </div>
                    <OverflowMenu
                      label={`Actions for ${p.name}`}
                      items={[
                        { label: "Open", icon: <ExternalLink size={13} />, onClick: () => router.push(`/editor/${p.id}`) },
                        {
                          label: "Rename",
                          icon: <Pencil size={13} />,
                          onClick: () => {
                            setRenameValue(p.name);
                            setRenaming(p);
                          },
                        },
                        { label: "Duplicate", icon: <Copy size={13} />, onClick: () => void doDuplicate(p) },
                        { label: "Export JSON", icon: <Download size={13} />, onClick: () => void doExport(p) },
                        { label: p.visibility === "public" ? "Publishing…" : "Publish…", icon: <Globe size={13} />, onClick: () => setPublishing(p.id) },
                        { label: "Delete", icon: <Trash2 size={13} />, danger: true, onClick: () => setDeleting(p) },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        eyebrow="Project"
        title="Rename project"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void doRename()} disabled={!renameValue.trim()}>
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doRename();
          }}
        >
          <TextInput label="Name" value={renameValue} maxLength={120} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
        </form>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        eyebrow="Danger zone"
        title="Delete project?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void doDelete()}>
              <Trash2 size={13} /> Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{deleting?.name}</span> will be permanently removed from this device
          {cloud && user ? " and from your cloud account" : ""}. Export it as JSON first if you might need it later.
        </p>
      </Dialog>

      {publishing && (
        <PublishDialog
          open
          projectId={publishing}
          onClose={() => setPublishing(null)}
          onChanged={(next) => patchLocal(next.id, { visibility: next.visibility, updatedAt: next.updatedAt })}
        />
      )}
    </SiteShell>
  );
}
