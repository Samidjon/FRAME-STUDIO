"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Copy, FolderPlus, Heart, Info, Search, User as UserIcon } from "lucide-react";
import { SiteShell } from "@/components/navigation/site-header";
import { Button, Dialog, EmptyState, Select, Spinner, TextInput, cx } from "@/components/shared/ui";
import { DocPreview } from "@/components/shared/doc-preview";
import { ErrorPanel, PageHeader, SkeletonGrid, errorMessage, relativeTime } from "@/components/gallery/utils";
import { TEMPLATES } from "@/core/templates";
import { TEMPLATE_CATEGORIES, type Template } from "@/core/templates/types";
import { getProject, listProjects } from "@/lib/storage/projects";
import { kvGet, kvSet } from "@/lib/indexeddb/db";
import {
  addToCollection as cloudAddToCollection,
  copyPublicProject,
  createCollection as cloudCreateCollection,
  fetchPublicGallery,
  likeProject,
  listCollections as cloudListCollections,
  removeFromCollection as cloudRemoveFromCollection,
  unlikeProject,
  type GallerySort,
} from "@/lib/supabase/sync";
import { uid } from "@/core/document/factory";
import { useAuth } from "@/stores/auth-store";
import { useUi } from "@/stores/ui-store";
import type { DesignDocument } from "@/types/project";

type Source = "cloud" | "template" | "local";

interface ExploreItem {
  key: string;
  source: Source;
  id: string;
  name: string;
  doc: DesignDocument;
  thumbnailUrl: string | null;
  category: string | null;
  tags: string[];
  description: string | null;
  author: { name: string; username: string | null };
  publishedAt: number;
  likeCount: number;
  likedByMe: boolean;
  featuredRank: number;
}

interface Collection {
  id: string;
  name: string;
  keys: string[];
}

const LIKES_KEY = "explore:likes";
const COLLECTIONS_KEY = "explore:collections";
const ALL = "__all";

const SOURCE_LABEL: Record<Source, string> = { cloud: "Community", template: "FRAME STUDIO", local: "Published locally" };

export default function ExplorePage() {
  const router = useRouter();
  const toast = useUi((s) => s.toast);
  const cloud = useAuth((s) => s.cloud);
  const user = useAuth((s) => s.user);
  const authReady = useAuth((s) => s.ready);
  const online = cloud && Boolean(user);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [sort, setSort] = useState<GallerySort>("featured");
  const [collectionFilter, setCollectionFilter] = useState<string>(ALL);

  const [cloudItems, setCloudItems] = useState<ExploreItem[] | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<ExploreItem[] | null>(null);
  const [localLikes, setLocalLikes] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const [detail, setDetail] = useState<ExploreItem | null>(null);
  const [copying, setCopying] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newCollection, setNewCollection] = useState("");
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  const urls = useRef<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ---------------- templates (always available) ---------------- */
  const templateItems = useMemo<ExploreItem[]>(() => {
    const list: readonly Template[] = TEMPLATES;
    const out: ExploreItem[] = [];
    for (const t of list) {
      try {
        out.push({
          key: `template:${t.id}`,
          source: "template",
          id: t.id,
          name: t.name,
          doc: t.build(),
          thumbnailUrl: null,
          category: t.category,
          tags: t.tags,
          description: t.description,
          author: { name: "FRAME STUDIO", username: null },
          publishedAt: 0,
          likeCount: 0,
          likedByMe: false,
          featuredRank: t.featured,
        });
      } catch {
        /* skip a template that fails to build */
      }
    }
    return out;
  }, []);

  /* ---------------- local published projects + local likes/collections ---------------- */
  const loadLocal = useCallback(async () => {
    try {
      const summaries = await listProjects();
      const pub = summaries.filter((s) => s.visibility === "public");
      summaries.forEach((s) => s.thumbnail && !pub.includes(s) && URL.revokeObjectURL(s.thumbnail));
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = pub.flatMap((s) => (s.thumbnail ? [s.thumbnail] : []));
      const out: ExploreItem[] = [];
      for (const s of pub) {
        const p = await getProject(s.id);
        if (!p || p.visibility !== "public" || !p.publishedAt) continue;
        out.push({
          key: `local:${p.id}`,
          source: "local",
          id: p.id,
          name: p.name,
          doc: p.doc,
          thumbnailUrl: s.thumbnail,
          category: p.category,
          tags: p.tags,
          description: null,
          author: { name: "You", username: null },
          publishedAt: p.publishedAt,
          likeCount: 0,
          likedByMe: false,
          featuredRank: -1,
        });
      }
      setLocalItems(out);
    } catch {
      setLocalItems([]);
    }
  }, []);

  useEffect(() => {
    void loadLocal();
    void kvGet<string[]>(LIKES_KEY, []).then((l) => setLocalLikes(Array.isArray(l) ? l : []));
    return () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
    };
  }, [loadLocal]);

  /* ---------------- collections ---------------- */
  const loadCollections = useCallback(async () => {
    if (online) {
      try {
        const list = await cloudListCollections();
        setCollections(list.map((c) => ({ id: c.id, name: c.name, keys: c.projectIds.map((p) => `cloud:${p}`) })));
      } catch {
        setCollections([]);
      }
    } else {
      const list = await kvGet<Collection[]>(COLLECTIONS_KEY, []);
      setCollections(Array.isArray(list) ? list : []);
    }
  }, [online]);

  useEffect(() => {
    if (authReady) void loadCollections();
  }, [authReady, loadCollections]);

  /* ---------------- cloud gallery ---------------- */
  const loadCloud = useCallback(async () => {
    if (!cloud) return;
    setCloudError(null);
    setCloudItems(null);
    try {
      const rows = await fetchPublicGallery({ search: debounced, category: category === ALL ? null : category, sort, limit: 60 });
      setCloudItems(
        rows.map((r, i) => ({
          key: `cloud:${r.id}`,
          source: "cloud",
          id: r.id,
          name: r.name,
          doc: r.doc,
          thumbnailUrl: r.thumbnailUrl,
          category: r.category,
          tags: r.tags,
          description: null,
          author: { name: r.author.displayName || r.author.username || "Anonymous", username: r.author.username },
          publishedAt: r.publishedAt,
          likeCount: r.likeCount,
          likedByMe: r.likedByMe,
          featuredRank: i,
        })),
      );
    } catch (e) {
      setCloudError(errorMessage(e, "The community gallery could not be loaded."));
      setCloudItems([]);
    }
  }, [cloud, debounced, category, sort]);

  useEffect(() => {
    if (cloud && authReady) void loadCloud();
  }, [cloud, authReady, loadCloud]);

  /* ---------------- derived lists ---------------- */
  const withLocalLikes = useCallback(
    (it: ExploreItem): ExploreItem => (it.source === "cloud" ? it : { ...it, likedByMe: localLikes.includes(it.key), likeCount: localLikes.includes(it.key) ? 1 : 0 }),
    [localLikes],
  );

  const matches = useCallback(
    (it: ExploreItem) => {
      if (category !== ALL && it.category !== category) return false;
      const q = debounced.toLowerCase();
      if (q && !(it.name.toLowerCase().includes(q) || it.tags.some((t) => t.toLowerCase().includes(q)) || (it.description ?? "").toLowerCase().includes(q))) return false;
      return true;
    },
    [category, debounced],
  );

  const sorter = useCallback(
    (a: ExploreItem, b: ExploreItem) => {
      if (sort === "recent") return b.publishedAt - a.publishedAt;
      if (sort === "liked") return b.likeCount - a.likeCount || b.publishedAt - a.publishedAt;
      return a.featuredRank - b.featuredRank;
    },
    [sort],
  );

  const activeCollection = collections.find((c) => c.id === collectionFilter) ?? null;

  const featured = useMemo(() => {
    if (cloud && cloudItems && cloudItems.length >= 3 && !debounced && category === ALL) return [...cloudItems].sort((a, b) => b.likeCount - a.likeCount).slice(0, 6);
    return [...templateItems].sort((a, b) => a.featuredRank - b.featuredRank).slice(0, 6).map(withLocalLikes);
  }, [cloud, cloudItems, templateItems, debounced, category, withLocalLikes]);

  const grid = useMemo(() => {
    let list: ExploreItem[];
    if (cloud) {
      // Cloud results are already filtered + sorted server-side; own local-only publications are appended.
      list = [...(cloudItems ?? []), ...(localItems ?? []).filter(matches).map(withLocalLikes)];
    } else {
      list = [...(localItems ?? []), ...templateItems].filter(matches).map(withLocalLikes).sort(sorter);
    }
    if (activeCollection) {
      const keys = new Set(activeCollection.keys);
      list = [...list, ...templateItems.map(withLocalLikes)].filter((it, i, arr) => keys.has(it.key) && arr.findIndex((x) => x.key === it.key) === i);
    }
    return list;
  }, [cloud, cloudItems, localItems, templateItems, matches, withLocalLikes, sorter, activeCollection]);

  const loading = cloud ? cloudItems === null || !authReady : localItems === null;

  /* ---------------- actions ---------------- */
  const patchItem = (key: string, patch: Partial<ExploreItem>) => {
    setCloudItems((l) => l?.map((x) => (x.key === key ? { ...x, ...patch } : x)) ?? null);
    setDetail((d) => (d && d.key === key ? { ...d, ...patch } : d));
  };

  const toggleLike = async (it: ExploreItem) => {
    if (it.source === "cloud") {
      if (!user) {
        toast({ kind: "info", title: "Sign in to like designs", action: { label: "Sign in", onClick: () => router.push("/auth") } });
        return;
      }
      const liked = !it.likedByMe;
      patchItem(it.key, { likedByMe: liked, likeCount: Math.max(0, it.likeCount + (liked ? 1 : -1)) });
      try {
        await (liked ? likeProject(it.id) : unlikeProject(it.id));
      } catch (e) {
        patchItem(it.key, { likedByMe: it.likedByMe, likeCount: it.likeCount });
        toast({ kind: "error", title: "Could not update like", description: errorMessage(e) });
      }
      return;
    }
    const next = localLikes.includes(it.key) ? localLikes.filter((k) => k !== it.key) : [...localLikes, it.key];
    setLocalLikes(next);
    setDetail((d) => (d && d.key === it.key ? withLocalLikesFrom(d, next) : d));
    await kvSet(LIKES_KEY, next).catch(() => undefined);
  };

  const canCollect = (it: ExploreItem) => !online || it.source === "cloud";

  const saveLocalCollections = async (next: Collection[]) => {
    setCollections(next);
    await kvSet(COLLECTIONS_KEY, next).catch(() => toast({ kind: "error", title: "Could not save collections" }));
  };

  const createCollection = async (name: string, firstKey?: string) => {
    const n = name.trim().slice(0, 80);
    if (!n) return;
    try {
      if (online) {
        const c = await cloudCreateCollection(n);
        if (firstKey?.startsWith("cloud:")) await cloudAddToCollection(c.id, firstKey.slice(6));
        await loadCollections();
      } else {
        await saveLocalCollections([...collections, { id: uid("col"), name: n, keys: firstKey ? [firstKey] : [] }]);
      }
      setNewCollection("");
      toast({ kind: "success", title: `Collection “${n}” created` });
    } catch (e) {
      toast({ kind: "error", title: "Could not create collection", description: errorMessage(e) });
    }
  };

  const toggleInCollection = async (c: Collection, it: ExploreItem) => {
    const has = c.keys.includes(it.key);
    try {
      if (online) {
        await (has ? cloudRemoveFromCollection(c.id, it.id) : cloudAddToCollection(c.id, it.id));
        setCollections((l) => l.map((x) => (x.id === c.id ? { ...x, keys: has ? x.keys.filter((k) => k !== it.key) : [...x.keys, it.key] } : x)));
      } else {
        await saveLocalCollections(collections.map((x) => (x.id === c.id ? { ...x, keys: has ? x.keys.filter((k) => k !== it.key) : [...x.keys, it.key] } : x)));
      }
    } catch (e) {
      toast({ kind: "error", title: "Could not update collection", description: errorMessage(e) });
    }
  };

  const deleteLocalCollection = async (id: string) => {
    if (collectionFilter === id) setCollectionFilter(ALL);
    await saveLocalCollections(collections.filter((c) => c.id !== id));
  };

  const copyToLibrary = async (it: ExploreItem) => {
    setCopying(true);
    try {
      const p = await copyPublicProject({ id: it.id, name: it.source === "template" ? it.name : `${it.name}`, doc: it.doc, category: it.category, tags: it.tags });
      setCopiedId(p.id);
      toast({ kind: "success", title: "Copied to your library", description: "It is an independent private copy.", action: { label: "Open", onClick: () => router.push(`/editor/${p.id}`) } });
    } catch (e) {
      toast({ kind: "error", title: "Copy failed", description: errorMessage(e) });
    } finally {
      setCopying(false);
    }
  };

  const openDetail = (it: ExploreItem) => {
    setCopiedId(null);
    setDetail(it);
  };

  /* ---------------- render ---------------- */
  return (
    <SiteShell>
      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8 md:py-14">
        <PageHeader
          index="03 — EXPLORE"
          title="Explore"
          lead="Designs published by the community. Copy any of them into your library as an independent, editable project."
          actions={
            <Button onClick={() => setCollectionsOpen(true)}>
              <Bookmark size={14} /> Collections {collections.length > 0 && <span className="font-mono text-[10px] text-subtle">{collections.length}</span>}
            </Button>
          }
        />

        {!cloud && (
          <div className="mt-6 flex items-start gap-3 border border-line-strong bg-raised px-4 py-3 text-[13px]">
            <Info size={15} className="mt-0.5 shrink-0 text-accent" />
            <p>
              <span className="font-medium">Local mode — connect Supabase to publish and browse community designs.</span>{" "}
              <span className="text-muted">Showing the FRAME STUDIO showcase and designs you published on this device. Likes and collections are stored in this browser.</span>
            </p>
          </div>
        )}

        {/* Featured strip */}
        <section className="pt-10" aria-labelledby="featured-h">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="featured-h" className="label-mono">
              <span className="text-accent">01</span> — Featured designs
            </h2>
            <span className="label-mono hidden sm:block">{featured.length} picks</span>
          </div>
          {loading && cloud && featured.length === 0 ? (
            <SkeletonGrid count={4} />
          ) : (
            <div className="scroll-thin -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 md:-mx-8 md:px-8">
              {featured.map((it, i) => (
                <button key={it.key} onClick={() => openDetail(it)} className="group w-[220px] shrink-0 snap-start text-left md:w-[260px]">
                  <div className="relative border border-line bg-sunken transition-colors group-hover:border-fg">
                    <Preview item={it} maxSide={520} className="aspect-[4/5]" />
                    <span className="label-mono absolute left-2 top-2 bg-bg/90 px-1.5 py-0.5">F{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="mt-2 truncate font-display text-[15px] font-semibold tracking-tight group-hover:text-accent">{it.name}</div>
                  <div className="label-mono mt-0.5 truncate">{it.author.name}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Filters */}
        <div className="sticky top-14 z-20 -mx-4 mt-8 grid gap-3 border-y border-line bg-bg/90 px-4 py-3 backdrop-blur sm:grid-cols-2 md:-mx-8 md:px-8 lg:grid-cols-[1fr_220px_180px_200px]">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              aria-label="Search designs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search names and tags"
              className="h-9 w-full rounded-[2px] border border-line-strong bg-transparent pl-9 pr-3 text-[13px] outline-none focus:border-fg"
            />
          </div>
          <Select value={category} onChange={setCategory} options={[{ value: ALL, label: "All categories" }, ...TEMPLATE_CATEGORIES.map((c) => ({ value: c as string, label: c }))]} />
          <Select
            value={sort}
            onChange={setSort}
            options={[
              { value: "featured", label: "Featured" },
              { value: "recent", label: "Recent" },
              { value: "liked", label: "Most liked" },
            ]}
          />
          <Select value={collectionFilter} onChange={setCollectionFilter} options={[{ value: ALL, label: "All designs" }, ...collections.map((c) => ({ value: c.id, label: `◼ ${c.name}` }))]} />
        </div>

        {/* Grid */}
        <section className="pt-8" aria-labelledby="public-h">
          <h2 id="public-h" className="label-mono mb-4">
            <span className="text-accent">02</span> — {activeCollection ? `Collection · ${activeCollection.name}` : cloud ? "Public projects" : "Community showcase"}
          </h2>
          {cloudError && (
            <div className="mb-6">
              <ErrorPanel title="Community gallery unavailable" message={cloudError} onRetry={() => void loadCloud()} />
            </div>
          )}
          {loading ? (
            <SkeletonGrid />
          ) : grid.length === 0 ? (
            <EmptyState
              index="00 — EMPTY"
              title={activeCollection ? "This collection is empty." : debounced || category !== ALL ? "Nothing matches." : "No public designs yet."}
              body={
                activeCollection
                  ? "Open a design and add it to this collection."
                  : debounced || category !== ALL
                    ? "Try another search term or category."
                    : "Be the first: open My Projects and choose “Publish…” on a design you own."
              }
              action={
                <Button
                  onClick={() => {
                    setSearch("");
                    setCategory(ALL);
                    setCollectionFilter(ALL);
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {grid.map((it) => (
                <li key={it.key} className="group min-w-0">
                  <div className="relative">
                    <button onClick={() => openDetail(it)} className="block w-full border border-line bg-sunken transition-colors hover:border-fg" aria-label={`View ${it.name}`}>
                      <Preview item={it} maxSide={480} className="aspect-[4/5]" />
                    </button>
                    {it.source === "local" && <span className="label-mono absolute left-2 top-2 border border-accent bg-bg/90 px-1.5 py-0.5 text-accent">Published locally</span>}
                    <button
                      onClick={() => void toggleLike(it)}
                      aria-pressed={it.likedByMe}
                      aria-label={it.likedByMe ? "Unlike" : "Like"}
                      className={cx("absolute bottom-2 right-2 flex h-7 items-center gap-1 border bg-bg/90 px-2 font-mono text-[10px]", it.likedByMe ? "border-accent text-accent" : "border-line text-muted hover:text-fg")}
                    >
                      <Heart size={12} fill={it.likedByMe ? "currentColor" : "none"} />
                      {it.likeCount}
                    </button>
                  </div>
                  <div className="mt-2.5 min-w-0">
                    <button onClick={() => openDetail(it)} className="block w-full truncate text-left text-[14px] font-medium tracking-tight hover:text-accent">
                      {it.name}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-[10px] uppercase tracking-wider text-subtle">
                      <AuthorLink item={it} />
                      {it.category && <span className="truncate">· {it.category}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Detail */}
      <Dialog open={detail !== null} onClose={() => setDetail(null)} eyebrow={detail ? SOURCE_LABEL[detail.source] : undefined} title={detail?.name ?? ""} width="max-w-5xl">
        {detail && (
          <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            <div className="flex items-center justify-center bg-sunken p-4 md:p-8">
              <div className="w-full max-w-[560px] shadow-[0_20px_60px_-24px_rgba(0,0,0,0.45)]">
                <DocPreview doc={detail.doc} cacheKey={`explore:${detail.key}`} maxSide={1200} alt={detail.name} />
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div>
                <div className="label-mono mb-1">Author</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center bg-fg font-mono text-[10px] text-bg">{initials(detail.author.name)}</span>
                  {detail.author.username && cloud ? (
                    <Link href={`/profile?u=${encodeURIComponent(detail.author.username)}`} className="hover:text-accent">
                      {detail.author.name} <span className="text-muted">@{detail.author.username}</span>
                    </Link>
                  ) : (
                    <span>{detail.author.name}</span>
                  )}
                </div>
              </div>
              {detail.description && <p className="text-sm text-muted">{detail.description}</p>}
              <dl className="grid grid-cols-2 gap-3 border-y border-line py-3 text-[12px]">
                <div>
                  <dt className="label-mono">Format</dt>
                  <dd className="mt-0.5 font-mono">
                    {detail.doc.width}×{detail.doc.height}
                  </dd>
                </div>
                <div>
                  <dt className="label-mono">Category</dt>
                  <dd className="mt-0.5">{detail.category ?? "—"}</dd>
                </div>
                {detail.publishedAt > 0 && (
                  <div>
                    <dt className="label-mono">Published</dt>
                    <dd className="mt-0.5">{relativeTime(detail.publishedAt)}</dd>
                  </div>
                )}
                <div>
                  <dt className="label-mono">Likes</dt>
                  <dd className="mt-0.5 font-mono">{detail.likeCount}</dd>
                </div>
              </dl>
              {detail.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detail.tags.map((t) => (
                    <button key={t} onClick={() => (setSearch(t), setDetail(null))} className="border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted hover:text-fg">
                      #{t}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {copiedId ? (
                  <Button variant="accent" size="lg" onClick={() => router.push(`/editor/${copiedId}`)}>
                    Open copy in editor <ArrowRight size={14} />
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" onClick={() => void copyToLibrary(detail)} disabled={copying}>
                    {copying ? <Spinner /> : <Copy size={14} />} Copy to my library
                  </Button>
                )}
                <Button onClick={() => void toggleLike(detail)} className={detail.likedByMe ? "!border-accent !text-accent" : ""}>
                  <Heart size={14} fill={detail.likedByMe ? "currentColor" : "none"} /> {detail.likedByMe ? "Liked" : "Like"}
                </Button>
              </div>

              {canCollect(detail) && (
                <div>
                  <div className="label-mono mb-2">Collections</div>
                  {collections.length > 0 && (
                    <ul className="mb-2 flex flex-col">
                      {collections.map((c) => {
                        const has = c.keys.includes(detail.key);
                        return (
                          <li key={c.id}>
                            <button onClick={() => void toggleInCollection(c, detail)} className="flex w-full items-center gap-2 border-b border-line py-1.5 text-left text-[13px] hover:text-accent">
                              <span className={cx("h-3 w-3 border", has ? "border-accent bg-accent" : "border-line-strong")} aria-hidden />
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="font-mono text-[10px] text-subtle">{c.keys.length}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void createCollection(newCollection, detail.key);
                    }}
                  >
                    <input
                      aria-label="New collection name"
                      value={newCollection}
                      maxLength={80}
                      onChange={(e) => setNewCollection(e.target.value)}
                      placeholder="New collection"
                      className="h-8 min-w-0 flex-1 rounded-[2px] border border-line-strong bg-transparent px-2 text-[12px] outline-none focus:border-fg"
                    />
                    <Button size="sm" type="submit" disabled={!newCollection.trim()} className="h-8">
                      <FolderPlus size={13} /> Add
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* Collections manager */}
      <Dialog open={collectionsOpen} onClose={() => setCollectionsOpen(false)} eyebrow={online ? "Cloud" : "This device"} title="Collections">
        <div className="flex flex-col gap-4">
          {collections.length === 0 ? (
            <p className="text-sm text-muted">No collections yet. Create one here, or from any design’s detail view.</p>
          ) : (
            <ul className="flex flex-col">
              {collections.map((c) => (
                <li key={c.id} className="flex items-center gap-2 border-b border-line py-2">
                  <button
                    className="flex-1 truncate text-left text-sm hover:text-accent"
                    onClick={() => {
                      setCollectionFilter(c.id);
                      setCollectionsOpen(false);
                    }}
                  >
                    {c.name}
                  </button>
                  <span className="font-mono text-[10px] text-subtle">{c.keys.length} items</span>
                  {!online && (
                    <button className="label-mono hover:text-danger" onClick={() => void deleteLocalCollection(c.id)} aria-label={`Delete collection ${c.name}`}>
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void createCollection(newCollection);
            }}
          >
            <div className="flex-1">
              <TextInput label="New collection" value={newCollection} maxLength={80} onChange={(e) => setNewCollection(e.target.value)} placeholder="e.g. Swiss posters" />
            </div>
            <Button type="submit" variant="primary" disabled={!newCollection.trim()}>
              Create
            </Button>
          </form>
          {cloud && !user && <p className="text-[12px] text-muted">Collections are stored on this device. Sign in to keep them in your account.</p>}
        </div>
      </Dialog>
    </SiteShell>
  );
}

function withLocalLikesFrom(it: ExploreItem, likes: string[]): ExploreItem {
  const liked = likes.includes(it.key);
  return { ...it, likedByMe: liked, likeCount: liked ? 1 : 0 };
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function AuthorLink({ item }: { item: ExploreItem }) {
  const cloud = useAuth((s) => s.cloud);
  if (item.author.username && cloud) {
    return (
      <Link href={`/profile?u=${encodeURIComponent(item.author.username)}`} className="inline-flex items-center gap-1 truncate hover:text-accent">
        <UserIcon size={9} /> {item.author.name}
      </Link>
    );
  }
  return <span className="truncate">{item.author.name}</span>;
}

function Preview({ item, maxSide, className }: { item: ExploreItem; maxSide: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cx("relative flex items-center justify-center overflow-hidden p-3", className)}>
      {item.thumbnailUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbnailUrl} alt="" loading="lazy" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <DocPreview
            doc={item.doc}
            cacheKey={`explore:${item.key}`}
            maxSide={maxSide}
            alt=""
            className={cx("max-h-full shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]", item.doc.width >= item.doc.height ? "w-full" : "h-full")}
          />
        </div>
      )}
    </div>
  );
}
