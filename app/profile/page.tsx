"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, LogOut, Pencil, Settings } from "lucide-react";
import { SiteShell } from "@/components/navigation/site-header";
import { Button, EmptyState, Spinner, TextInput, cx } from "@/components/shared/ui";
import { DocPreview } from "@/components/shared/doc-preview";
import { ErrorPanel, PageHeader, SkeletonGrid, errorMessage, relativeTime } from "@/components/gallery/utils";
import { fetchMyCloudStats, fetchPublicGallery, getProfileByUsername, updateMyProfile, type GalleryItem, type PublicProfile } from "@/lib/supabase/sync";
import { getSupabase } from "@/lib/supabase/client";
import { getProject, listProjects } from "@/lib/storage/projects";
import { kvGet, kvSet } from "@/lib/indexeddb/db";
import { useAuth } from "@/stores/auth-store";
import { useUi } from "@/stores/ui-store";

const LOCAL_PROFILE_KEY = "profile:local";

interface LocalProfile {
  displayName: string;
  bio: string;
}

function initials(name: string | null | undefined) {
  const s = (name ?? "").trim();
  if (!s) return "FS";
  return s
    .split(/[\s_.-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name, size = 88 }: { name: string | null | undefined; size?: number }) {
  return (
    <div className="relative flex shrink-0 items-center justify-center bg-fg font-display font-semibold tracking-tight text-bg" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initials(name)}
      <span className="absolute -bottom-1 -right-1 h-3 w-3 bg-accent" />
    </div>
  );
}

function Stat({ n, label, value }: { n: string; label: string; value: number | null }) {
  return (
    <div className="border-l border-line pl-4">
      <div className="label-mono">
        <span className="text-accent">{n}</span> — {label}
      </div>
      <div className="mt-1 font-display text-4xl font-semibold tabular-nums tracking-tight">{value === null ? <span className="inline-block h-8 w-12 animate-pulse bg-sunken align-middle" /> : value}</div>
    </div>
  );
}

function DesignGrid({ items, own }: { items: GalleryItem[]; own: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => {
        const body = (
          <>
            <div className="flex aspect-[4/5] items-center justify-center border border-line bg-sunken p-3 transition-colors group-hover:border-fg">
              {it.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.thumbnailUrl} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
              ) : (
                <DocPreview doc={it.doc} cacheKey={`profile:${it.id}:${it.publishedAt}`} maxSide={480} className={cx("max-h-full", it.doc.width >= it.doc.height ? "w-full" : "h-full")} />
              )}
            </div>
            <div className="mt-2 truncate text-[14px] font-medium tracking-tight group-hover:text-accent">{it.name}</div>
            <div className="mt-0.5 flex gap-2 font-mono text-[10px] uppercase tracking-wider text-subtle">
              <span className="inline-flex items-center gap-1">
                <Heart size={9} /> {it.likeCount}
              </span>
              {it.publishedAt > 0 && <span>· {relativeTime(it.publishedAt)}</span>}
            </div>
          </>
        );
        return (
          <li key={it.id} className="group min-w-0">
            {own ? <Link href={`/editor/${it.id}`}>{body}</Link> : <Link href={`/explore`}>{body}</Link>}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- signed-in (own) profile ---------------- */
function OwnProfile() {
  const router = useRouter();
  const toast = useUi((s) => s.toast);
  const user = useAuth((s) => s.user)!;
  const profile = useAuth((s) => s.profile);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: "", username: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<{ projects: number; published: number; likes: number } | null>(null);
  const [localCount, setLocalCount] = useState<number | null>(null);
  const [designs, setDesigns] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, d] = await Promise.all([fetchMyCloudStats(), fetchPublicGallery({ ownerId: user.id, sort: "recent", limit: 60 })]);
      setStats(s);
      setDesigns(d);
    } catch (e) {
      setError(errorMessage(e));
      setDesigns([]);
    }
  }, [user.id]);

  useEffect(() => {
    void load();
    listProjects()
      .then((l) => {
        l.forEach((p) => p.thumbnail && URL.revokeObjectURL(p.thumbnail));
        setLocalCount(l.length);
      })
      .catch(() => setLocalCount(0));
  }, [load]);

  useEffect(() => {
    setForm({ display_name: profile?.display_name ?? "", username: profile?.username ?? "", bio: profile?.bio ?? "" });
  }, [profile]);

  const usernameValid = /^[a-z0-9_]{3,24}$/.test(form.username);

  const save = async () => {
    if (!usernameValid) return;
    setSaving(true);
    try {
      await updateMyProfile({ display_name: form.display_name.trim().slice(0, 64) || null, username: form.username, bio: form.bio.trim().slice(0, 280) || null });
      toast({ kind: "success", title: "Profile updated" });
      setEditing(false);
    } catch (e) {
      toast({ kind: "error", title: "Could not save profile", description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
    toast({ kind: "info", title: "Signed out", description: "Your local projects stay on this device." });
    router.push("/");
  };

  const name = profile?.display_name || profile?.username || user.email || "You";

  return (
    <>
      <PageHeader
        index="06 — PROFILE"
        title="Profile"
        actions={
          <>
            <Button onClick={() => router.push("/settings")}>
              <Settings size={14} /> Settings
            </Button>
            <Button variant="danger" onClick={() => void signOut()}>
              <LogOut size={14} /> Sign out
            </Button>
          </>
        }
      />
      <div className="grid gap-10 py-10 lg:grid-cols-[1fr_1.2fr]">
        <section className="flex flex-col gap-6">
          <div className="flex items-start gap-5">
            <Avatar name={name} />
            <div className="min-w-0">
              <h2 className="truncate font-display text-3xl font-semibold tracking-tight">{name}</h2>
              {profile?.username && <div className="font-mono text-[12px] text-muted">@{profile.username}</div>}
              <div className="mt-1 truncate text-[12px] text-subtle">{user.email}</div>
            </div>
          </div>
          {editing ? (
            <form
              className="flex flex-col gap-4 border border-line p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <TextInput label="01 — Display name" value={form.display_name} maxLength={64} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              <div>
                <TextInput
                  label="02 — Username"
                  value={form.username}
                  maxLength={24}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                  aria-invalid={!usernameValid}
                />
                {!usernameValid && <p className="mt-1 text-[11px] text-danger">3–24 characters: a–z, 0–9, underscore.</p>}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="label-mono">03 — Bio</span>
                <textarea
                  value={form.bio}
                  maxLength={280}
                  rows={4}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="w-full resize-none rounded-[2px] border border-line-strong bg-transparent px-3 py-2 text-[13px] outline-none focus:border-fg"
                />
                <span className="self-end font-mono text-[10px] text-subtle">{form.bio.length}/280</span>
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving || !usernameValid}>
                  {saving && <Spinner />} Save profile
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="max-w-md whitespace-pre-line text-sm text-muted">{profile?.bio || "No bio yet."}</p>
              <div>
                <Button onClick={() => setEditing(true)}>
                  <Pencil size={13} /> Edit profile
                </Button>
              </div>
            </div>
          )}
        </section>
        <section className="grid grid-cols-2 content-start gap-6 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          <Stat n="01" label="Cloud projects" value={stats?.projects ?? (error ? 0 : null)} />
          <Stat n="02" label="On this device" value={localCount} />
          <Stat n="03" label="Published" value={stats?.published ?? (error ? 0 : null)} />
          <Stat n="04" label="Likes received" value={stats?.likes ?? (error ? 0 : null)} />
        </section>
      </div>
      <section className="border-t border-line pt-8">
        <h2 className="label-mono mb-4">
          <span className="text-accent">05</span> — Published designs
        </h2>
        {error && (
          <div className="mb-6">
            <ErrorPanel message={error} onRetry={() => void load()} />
          </div>
        )}
        {designs === null ? (
          <SkeletonGrid count={4} />
        ) : designs.length === 0 ? (
          <EmptyState index="00 — NONE" title="Nothing published yet." body="Open My Projects and choose “Publish…” on a design you own to share it with the community." action={<Button onClick={() => router.push("/projects")}>My Projects</Button>} />
        ) : (
          <DesignGrid items={designs} own />
        )}
      </section>
    </>
  );
}

/* ---------------- someone else's public profile ---------------- */
function PublicProfileView({ username }: { username: string }) {
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [designs, setDesigns] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setProfile(undefined);
    try {
      const p = await getProfileByUsername(username);
      setProfile(p);
      setDesigns(p ? await fetchPublicGallery({ ownerId: p.id, sort: "recent", limit: 60 }) : []);
    } catch (e) {
      setError(errorMessage(e));
      setProfile(null);
      setDesigns([]);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorPanel title="Profile unavailable" message={error} onRetry={() => void load()} />;
  if (profile === undefined)
    return (
      <div className="flex flex-col gap-6 py-10">
        <div className="flex items-center gap-5">
          <div className="h-[88px] w-[88px] animate-pulse bg-sunken" />
          <div className="flex flex-col gap-2">
            <div className="h-7 w-56 animate-pulse bg-sunken" />
            <div className="h-3 w-24 animate-pulse bg-sunken" />
          </div>
        </div>
        <SkeletonGrid count={4} />
      </div>
    );
  if (profile === null)
    return <EmptyState index="404 — PROFILE" title="No such designer." body={`We couldn’t find a profile for “${username}”.`} action={<Link href="/explore" className="text-sm underline">Back to Explore</Link>} />;

  const likes = (designs ?? []).reduce((s, d) => s + d.likeCount, 0);
  const name = profile.display_name || profile.username || "Designer";
  return (
    <>
      <div className="flex flex-col gap-8 border-b border-line pb-10 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-5">
          <Avatar name={name} size={104} />
          <div className="min-w-0">
            <div className="label-mono mb-2 text-accent">Designer</div>
            <h1 className="font-display text-5xl font-semibold leading-[0.9] tracking-[-0.045em] md:text-6xl">{name}</h1>
            <div className="mt-2 font-mono text-[12px] text-muted">@{profile.username}</div>
            {profile.bio && <p className="mt-3 max-w-lg whitespace-pre-line text-sm text-muted">{profile.bio}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Stat n="01" label="Published" value={designs?.length ?? null} />
          <Stat n="02" label="Likes" value={designs ? likes : null} />
        </div>
      </div>
      <section className="pt-8">
        <h2 className="label-mono mb-4">
          <span className="text-accent">03</span> — Published designs
        </h2>
        {designs === null ? <SkeletonGrid count={4} /> : designs.length === 0 ? <p className="text-sm text-muted">No published designs yet.</p> : <DesignGrid items={designs} own={false} />}
      </section>
    </>
  );
}

/* ---------------- signed out / local mode ---------------- */
function LocalProfile() {
  const router = useRouter();
  const toast = useUi((s) => s.toast);
  const cloud = useAuth((s) => s.cloud);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [draft, setDraft] = useState<LocalProfile>({ displayName: "", bio: "" });
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState<{ projects: number; published: number; likes: number } | null>(null);

  useEffect(() => {
    void kvGet<LocalProfile>(LOCAL_PROFILE_KEY, { displayName: "", bio: "" }).then((p) => {
      setProfile(p);
      setDraft(p);
    });
    void (async () => {
      try {
        const list = await listProjects();
        list.forEach((p) => p.thumbnail && URL.revokeObjectURL(p.thumbnail));
        let published = 0;
        for (const s of list.filter((x) => x.visibility === "public")) {
          const p = await getProject(s.id);
          if (p?.publishedAt) published++;
        }
        const likes = await kvGet<string[]>("explore:likes", []);
        setStats({ projects: list.length, published, likes: Array.isArray(likes) ? likes.length : 0 });
      } catch {
        setStats({ projects: 0, published: 0, likes: 0 });
      }
    })();
  }, []);

  const save = async () => {
    const next = { displayName: draft.displayName.trim().slice(0, 64), bio: draft.bio.trim().slice(0, 280) };
    try {
      await kvSet(LOCAL_PROFILE_KEY, next);
      setProfile(next);
      setEditing(false);
      toast({ kind: "success", title: "Saved on this device" });
    } catch (e) {
      toast({ kind: "error", title: "Could not save", description: errorMessage(e) });
    }
  };

  const name = profile?.displayName || "Local designer";

  return (
    <>
      <PageHeader index="06 — PROFILE" title="Profile" lead={cloud ? "You are not signed in. Your work is saved on this device." : "FRAME STUDIO is running in local mode. Everything is stored in this browser."} />
      <div className="grid gap-10 py-10 lg:grid-cols-[1fr_1fr]">
        <section className="flex flex-col gap-6">
          <div className="flex items-start gap-5">
            <Avatar name={name} />
            <div className="min-w-0">
              <div className="label-mono mb-1">Local profile</div>
              <h2 className="truncate font-display text-3xl font-semibold tracking-tight">{profile ? name : <span className="inline-block h-8 w-48 animate-pulse bg-sunken" />}</h2>
              {profile?.bio && <p className="mt-2 max-w-md whitespace-pre-line text-sm text-muted">{profile.bio}</p>}
            </div>
          </div>
          {editing ? (
            <form
              className="flex flex-col gap-4 border border-line p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <TextInput label="Display name" value={draft.displayName} maxLength={64} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
              <label className="flex flex-col gap-1.5">
                <span className="label-mono">Bio</span>
                <textarea
                  value={draft.bio}
                  maxLength={280}
                  rows={3}
                  onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                  className="w-full resize-none rounded-[2px] border border-line-strong bg-transparent px-3 py-2 text-[13px] outline-none focus:border-fg"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <Button onClick={() => setEditing(true)} disabled={!profile}>
                <Pencil size={13} /> Edit local profile
              </Button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <Stat n="01" label="Projects" value={stats?.projects ?? null} />
            <Stat n="02" label="Published locally" value={stats?.published ?? null} />
            <Stat n="03" label="Liked" value={stats?.likes ?? null} />
          </div>
        </section>
        <section className="flex flex-col gap-4 border border-line-strong bg-raised p-6">
          {cloud ? (
            <>
              <div className="label-mono text-accent">Account</div>
              <h3 className="font-display text-2xl font-semibold tracking-tight">Sign in to sync and share.</h3>
              <p className="text-sm text-muted">With an account your projects are mirrored to the cloud, you can publish designs to the community gallery, like and collect work from other designers.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => router.push("/auth")}>
                  Sign in
                </Button>
                <Button onClick={() => router.push("/auth?tab=signup")}>Create account</Button>
              </div>
            </>
          ) : (
            <>
              <div className="label-mono text-accent">Local mode</div>
              <h3 className="font-display text-2xl font-semibold tracking-tight">No account needed.</h3>
              <p className="text-sm text-muted">
                This installation has no cloud backend configured, so projects, assets, likes and collections live in this browser’s IndexedDB. Export projects as JSON from My Projects or Settings to back them up or move
                them to another device.
              </p>
              <p className="text-[12px] text-subtle">Administrators can enable accounts by setting NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
              <div>
                <Button onClick={() => router.push("/settings")}>
                  <Settings size={14} /> Storage settings
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function ProfileRouter() {
  const params = useSearchParams();
  const u = params.get("u");
  const cloud = useAuth((s) => s.cloud);
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);

  if (!ready)
    return (
      <div className="flex items-center gap-2 py-24 text-sm text-muted">
        <Spinner /> Loading profile…
      </div>
    );
  if (u && cloud && u.toLowerCase() !== profile?.username) return <PublicProfileView username={u} />;
  if (u && !cloud)
    return (
      <EmptyState
        index="LOCAL MODE"
        title="Profiles need the cloud."
        body="Public designer profiles are available when FRAME STUDIO is connected to Supabase."
        action={
          <Link href="/explore" className="text-sm underline">
            Back to Explore
          </Link>
        }
      />
    );
  if (cloud && user) return <OwnProfile />;
  return <LocalProfile />;
}

export default function ProfilePage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8 md:py-14">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 py-24 text-sm text-muted">
              <Spinner /> Loading profile…
            </div>
          }
        >
          <ProfileRouter />
        </Suspense>
      </div>
    </SiteShell>
  );
}
