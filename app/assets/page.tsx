"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { CloudUpload, Cloud, Folder, FolderInput, ImagePlus, Pencil, Search, Star, Trash2, Upload } from "lucide-react";
import { SiteShell } from "@/components/navigation/site-header";
import { Button, Dialog, EmptyState, Select, Spinner, TextInput, cx } from "@/components/shared/ui";
import { AssetError, deleteAsset, getAssetBlob, importFile, listAssets, updateAsset } from "@/lib/storage/assets";
import { uploadAsset } from "@/lib/supabase/sync";
import { ErrorPanel, OverflowMenu, PageHeader, SkeletonGrid, errorMessage, formatBytes } from "@/components/gallery/utils";
import { useAuth } from "@/stores/auth-store";
import { useUi } from "@/stores/ui-store";
import type { AssetKind, AssetMeta } from "@/types/assets";

type Item = AssetMeta & { thumbUrl: string | null };
type Category = "all" | "favorites" | AssetKind;

const CATEGORIES: { value: Category; label: string; n: string }[] = [
  { value: "all", label: "All", n: "00" },
  { value: "image", label: "Images", n: "01" },
  { value: "logo", label: "Logos", n: "02" },
  { value: "svg", label: "SVG", n: "03" },
  { value: "font", label: "Fonts", n: "04" },
  { value: "texture", label: "Textures", n: "05" },
  { value: "favorites", label: "Favorites", n: "06" },
];

const ALL_FOLDERS = "__all";
const NO_FOLDER = "__none";
const ASSET_DRAG_MIME = "application/x-frame-asset";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,.svg,.woff,.woff2,.ttf,.otf";

export default function AssetsPage() {
  const toast = useUi((s) => s.toast);
  const cloud = useAuth((s) => s.cloud);
  const user = useAuth((s) => s.user);
  const online = cloud && Boolean(user);

  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("all");
  const [folder, setFolder] = useState<string>(ALL_FOLDERS);
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [cloudBusy, setCloudBusy] = useState<string | null>(null);

  const [renaming, setRenaming] = useState<Item | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moving, setMoving] = useState<Item | null>(null);
  const [moveValue, setMoveValue] = useState("");
  const [deleting, setDeleting] = useState<Item | null>(null);

  const urls = useRef<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const revokeAll = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listAssets();
      revokeAll();
      urls.current = list.flatMap((a) => (a.thumbUrl ? [a.thumbUrl] : []));
      setItems(list);
    } catch (e) {
      setError(errorMessage(e, "The asset library could not be opened."));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
    return revokeAll;
  }, [load]);

  const folders = useMemo(() => [...new Set((items ?? []).flatMap((a) => (a.folder ? [a.folder] : [])))].sort((a, b) => a.localeCompare(b)), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((a) => {
      if (category === "favorites" && !a.favorite) return false;
      if (category !== "all" && category !== "favorites" && a.kind !== category) return false;
      if (folder === NO_FOLDER && a.folder) return false;
      if (folder !== ALL_FOLDERS && folder !== NO_FOLDER && a.folder !== folder) return false;
      return !q || a.name.toLowerCase().includes(q) || (a.fontFamily ?? "").toLowerCase().includes(q);
    });
  }, [items, category, folder, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0, favorites: 0 };
    for (const a of items ?? []) {
      c[a.kind] = (c[a.kind] ?? 0) + 1;
      if (a.favorite) c.favorites++;
    }
    return c;
  }, [items]);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    const kind: AssetKind | undefined = category === "logo" || category === "texture" || category === "font" ? category : undefined;
    const target = folder !== ALL_FOLDERS && folder !== NO_FOLDER ? folder : null;
    setUploading({ done: 0, total: files.length });
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        await importFile(f, { kind, folder: target });
        ok++;
      } catch (e) {
        toast({
          kind: "error",
          title: `${f.name} was not added`,
          description: e instanceof AssetError ? e.message : errorMessage(e, "The file could not be processed."),
        });
      }
      setUploading({ done: i + 1, total: files.length });
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
    if (ok) {
      toast({ kind: "success", title: `Added ${ok} asset${ok > 1 ? "s" : ""}` });
      await load();
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    // Ignore internal drags of our own tiles.
    if (e.dataTransfer.types.includes(ASSET_DRAG_MIME)) return;
    void upload(Array.from(e.dataTransfer.files));
  };

  const patch = (id: string, p: Partial<Item>) => setItems((list) => list?.map((a) => (a.id === id ? { ...a, ...p } : a)) ?? null);

  const toggleFavorite = async (a: Item) => {
    patch(a.id, { favorite: !a.favorite });
    try {
      await updateAsset(a.id, { favorite: !a.favorite });
    } catch (e) {
      patch(a.id, { favorite: a.favorite });
      toast({ kind: "error", title: "Could not update", description: errorMessage(e) });
    }
  };

  const doRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim().slice(0, 64);
    if (!name) return;
    try {
      await updateAsset(renaming.id, { name });
      patch(renaming.id, { name });
      setRenaming(null);
    } catch (e) {
      toast({ kind: "error", title: "Rename failed", description: errorMessage(e) });
    }
  };

  const doMove = async () => {
    if (!moving) return;
    const f = moveValue.trim().replace(/[/\\]/g, "-").slice(0, 64) || null;
    try {
      await updateAsset(moving.id, { folder: f });
      patch(moving.id, { folder: f });
      toast({ kind: "info", title: f ? `Moved to “${f}”` : "Removed from folder" });
      setMoving(null);
    } catch (e) {
      toast({ kind: "error", title: "Move failed", description: errorMessage(e) });
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    const a = deleting;
    setDeleting(null);
    try {
      await deleteAsset(a.id);
      if (a.thumbUrl) URL.revokeObjectURL(a.thumbUrl);
      setItems((list) => list?.filter((x) => x.id !== a.id) ?? null);
      toast({ kind: "info", title: "Asset deleted", description: "Projects that used it will show an empty frame." });
    } catch (e) {
      toast({ kind: "error", title: "Delete failed", description: errorMessage(e) });
    }
  };

  const toCloud = async (a: Item) => {
    setCloudBusy(a.id);
    try {
      const blob = await getAssetBlob(a.id);
      if (!blob) throw new Error("The local file is missing.");
      const path = await uploadAsset(a, blob);
      patch(a.id, { remotePath: path });
      toast({ kind: "success", title: "Uploaded to cloud", description: a.name });
    } catch (e) {
      toast({ kind: "error", title: "Cloud upload failed", description: errorMessage(e) });
    } finally {
      setCloudBusy(null);
    }
  };

  const uploadHint =
    category === "logo" ? "as logos" : category === "texture" ? "as textures" : category === "font" ? "as fonts" : "— images, SVG and fonts are detected automatically";

  return (
    <SiteShell>
      <div
        className="mx-auto max-w-[1440px] px-4 py-10 md:px-8 md:py-14"
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          dragDepth.current++;
          setDragOver(true);
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragOver(false);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={onDrop}
      >
        <PageHeader
          index="05 — ASSETS"
          title="Assets"
          lead="Images, logos, SVG, fonts and textures — stored on this device. Drag any tile onto the editor canvas to place it."
          actions={
            <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading !== null}>
              {uploading ? <Spinner /> : <Upload size={14} />} Upload files
            </Button>
          }
        />
        <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => void upload(Array.from(e.target.files ?? []))} />

        <div className="grid gap-8 pt-8 lg:grid-cols-[220px_1fr]">
          <aside className="flex flex-col gap-6">
            <nav aria-label="Asset categories" className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  aria-current={category === c.value ? "page" : undefined}
                  className={cx(
                    "flex shrink-0 items-baseline gap-2 border px-3 py-2 text-left text-[13px] transition-colors lg:border-0 lg:border-b lg:border-line lg:px-0",
                    category === c.value ? "border-fg text-fg" : "border-line text-muted hover:text-fg",
                  )}
                >
                  <span className={cx("font-mono text-[9px]", category === c.value ? "text-accent" : "text-subtle")}>{c.n}</span>
                  <span className="flex-1">{c.label}</span>
                  <span className="font-mono text-[10px] text-subtle">{counts[c.value] ?? 0}</span>
                </button>
              ))}
            </nav>
            {folders.length > 0 && (
              <Select
                label="Folder"
                value={folder}
                onChange={setFolder}
                options={[{ value: ALL_FOLDERS, label: "All folders" }, { value: NO_FOLDER, label: "Unfiled" }, ...folders.map((f) => ({ value: f, label: f }))]}
              />
            )}
          </aside>

          <section className="min-w-0">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cx(
                "flex w-full flex-col items-center justify-center gap-2 border border-dashed px-6 py-10 text-center transition-colors",
                dragOver ? "border-accent bg-accent/5 text-fg" : "border-line-strong text-muted hover:border-fg hover:text-fg",
              )}
            >
              {uploading ? (
                <>
                  <Spinner className="h-5 w-5" />
                  <span className="text-sm">
                    Processing {uploading.done} / {uploading.total}…
                  </span>
                </>
              ) : (
                <>
                  <ImagePlus size={22} />
                  <span className="font-display text-lg font-semibold tracking-tight text-fg">{dragOver ? "Drop to upload" : "Drop files here or click to browse"}</span>
                  <span className="text-[12px]">PNG, JPG, WebP (≤ 40 MB), SVG (≤ 2 MB), WOFF/WOFF2/TTF/OTF (≤ 10 MB) {uploadHint}</span>
                </>
              )}
            </button>

            <div className="relative my-6">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <input
                type="search"
                aria-label="Search assets"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assets"
                className="h-9 w-full rounded-[2px] border border-line-strong bg-transparent pl-9 pr-3 text-[13px] outline-none focus:border-fg"
              />
            </div>

            {items === null ? (
              <SkeletonGrid aspect="1 / 1" />
            ) : error ? (
              <ErrorPanel title="Assets unavailable" message={error} onRetry={() => void load()} />
            ) : visible.length === 0 ? (
              <EmptyState
                index="00 — EMPTY"
                title={items.length ? "Nothing here." : "No assets yet."}
                body={items.length ? "Try another category, folder or search." : "Upload photographs, logos, SVG marks, textures and your own fonts to use them in any project."}
                action={
                  <Button variant="primary" onClick={() => fileRef.current?.click()}>
                    <Upload size={14} /> Upload files
                  </Button>
                }
              />
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((a) => (
                  <li
                    key={a.id}
                    className="group flex min-w-0 cursor-grab flex-col active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify({ id: a.id, kind: a.kind, width: a.width, height: a.height, fontFamily: a.fontFamily }));
                      e.dataTransfer.setData("text/plain", a.name);
                    }}
                  >
                    <div className="relative aspect-square overflow-hidden border border-line bg-sunken transition-colors group-hover:border-fg">
                      {a.kind === "font" ? (
                        <div className="flex h-full flex-col justify-between p-4" style={{ fontFamily: `"${a.fontFamily ?? a.name}", var(--font-sans)` }}>
                          <span className="text-5xl leading-none tracking-tight">Aa Bb</span>
                          <span className="text-2xl leading-none">0123</span>
                        </div>
                      ) : a.thumbUrl ? (
                        <div
                          className={cx("flex h-full items-center justify-center p-3", a.kind === "logo" || a.kind === "svg" ? "bg-[repeating-conic-gradient(var(--bg-sunken)_0_25%,var(--bg-raised)_0_50%)] bg-[length:16px_16px]" : "")}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.thumbUrl} alt="" className={cx("max-h-full max-w-full", a.kind === "texture" ? "h-full w-full object-cover" : "object-contain")} draggable={false} />
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="label-mono">No preview</span>
                        </div>
                      )}
                      <span className="label-mono absolute left-2 top-2 bg-bg/90 px-1.5 py-0.5">{a.kind}</span>
                      {a.remotePath && (
                        <span className="absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center bg-bg/90 text-ok" title="Synced to cloud">
                          <Cloud size={12} />
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={a.favorite ? "Remove from favourites" : "Add to favourites"}
                        aria-pressed={a.favorite}
                        onClick={() => void toggleFavorite(a)}
                        className={cx(
                          "absolute right-2 top-2 flex h-7 w-7 items-center justify-center border bg-bg/90",
                          a.favorite ? "border-accent text-accent" : "border-line text-muted hover:text-fg md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100",
                        )}
                      >
                        <Star size={13} fill={a.favorite ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium" title={a.name}>
                          {a.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] uppercase tracking-wider text-subtle">
                          {a.width && a.height ? (
                            <span>
                              {a.width}×{a.height}
                            </span>
                          ) : null}
                          <span>{formatBytes(a.size)}</span>
                          {a.folder && (
                            <span className="inline-flex items-center gap-1 normal-case">
                              <Folder size={9} />
                              {a.folder}
                            </span>
                          )}
                        </div>
                      </div>
                      {cloudBusy === a.id ? (
                        <Spinner className="mt-1" />
                      ) : (
                        <OverflowMenu
                          label={`Actions for ${a.name}`}
                          items={[
                            {
                              label: "Rename",
                              icon: <Pencil size={13} />,
                              onClick: () => {
                                setRenameValue(a.name);
                                setRenaming(a);
                              },
                            },
                            {
                              label: "Move to folder",
                              icon: <FolderInput size={13} />,
                              onClick: () => {
                                setMoveValue(a.folder ?? "");
                                setMoving(a);
                              },
                            },
                            ...(online ? [{ label: a.remotePath ? "Re-upload to cloud" : "Upload to cloud", icon: <CloudUpload size={13} />, onClick: () => void toCloud(a) }] : []),
                            { label: "Delete", icon: <Trash2 size={13} />, danger: true, onClick: () => setDeleting(a) },
                          ]}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        eyebrow="Asset"
        title="Rename asset"
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
          <TextInput label="Name" value={renameValue} maxLength={64} onChange={(e) => setRenameValue(e.target.value)} />
          {renaming?.kind === "font" && <p className="mt-2 text-[12px] text-muted">The font family name used in documents stays “{renaming.fontFamily}”.</p>}
        </form>
      </Dialog>

      <Dialog
        open={moving !== null}
        onClose={() => setMoving(null)}
        eyebrow="Asset"
        title="Move to folder"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void doMove()}>
              Move
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void doMove();
          }}
        >
          <TextInput label="Folder name (empty = unfiled)" list="asset-folders" value={moveValue} maxLength={64} onChange={(e) => setMoveValue(e.target.value)} placeholder="e.g. Brand kit" />
          <datalist id="asset-folders">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          {folders.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {folders.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setMoveValue(f)}
                  className={cx("inline-flex items-center gap-1 border px-2 py-1 text-[12px]", moveValue === f ? "border-fg" : "border-line text-muted hover:text-fg")}
                >
                  <Folder size={11} /> {f}
                </button>
              ))}
            </div>
          )}
        </form>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        eyebrow="Danger zone"
        title="Delete asset?"
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
          <span className="font-medium text-fg">{deleting?.name}</span> will be removed from this device. Layers that use it will show an empty image frame.
        </p>
      </Dialog>
    </SiteShell>
  );
}
