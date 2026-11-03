"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, HardDrive, LogOut, Trash2 } from "lucide-react";
import { SiteShell } from "@/components/navigation/site-header";
import { Button, Dialog, Segmented, Select, Spinner, Toggle, cx } from "@/components/shared/ui";
import { PageHeader, downloadBlob, errorMessage, formatBytes } from "@/components/gallery/utils";
import { useUi, type ThemePref } from "@/stores/ui-store";
import { useAuth } from "@/stores/auth-store";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";
import { getDB } from "@/lib/indexeddb/db";
import { getProject, listProjects } from "@/lib/storage/projects";
import { CURRENT_SCHEMA_VERSION, type Project } from "@/types/project";

const SWATCHES = [
  { value: "#FF4D00", label: "Signal orange" },
  { value: "#2F5BFF", label: "International blue" },
  { value: "#00A36C", label: "Green" },
  { value: "#E0B000", label: "Yellow" },
  { value: "#D6247A", label: "Magenta" },
  { value: "#7B4DFF", label: "Violet" },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-line py-5 md:grid-cols-[1fr_minmax(0,360px)] md:items-center md:gap-8">
      <div>
        <div className="text-[14px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-muted">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Section({ n, title, id, children }: { n: string; title: string; id: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 pb-12">
      <div className="label-mono mb-1">
        <span className="text-accent">{n}</span>
      </div>
      <h2 id={`${id}-h`} className="border-b border-line-strong pb-3 font-display text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const ui = useUi();
  const toast = ui.toast;
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);

  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [custom, setCustom] = useState(ui.accent);

  const refreshEstimate = useCallback(async () => {
    try {
      if (!navigator.storage?.estimate) throw new Error("Storage estimates are not supported by this browser.");
      const e = await navigator.storage.estimate();
      setEstimate({ usage: e.usage ?? 0, quota: e.quota ?? 0 });
      setPersisted(navigator.storage.persisted ? await navigator.storage.persisted() : null);
    } catch (e) {
      setStorageError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void refreshEstimate();
  }, [refreshEstimate]);

  const requestPersist = async () => {
    try {
      const ok = (await navigator.storage?.persist?.()) ?? false;
      setPersisted(ok);
      toast({ kind: ok ? "success" : "info", title: ok ? "Storage is now persistent" : "The browser declined persistent storage" });
    } catch (e) {
      toast({ kind: "error", title: "Request failed", description: errorMessage(e) });
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const list = await listProjects();
      list.forEach((p) => p.thumbnail && URL.revokeObjectURL(p.thumbnail));
      const projects: Project[] = [];
      for (const s of list) {
        const p = await getProject(s.id);
        if (p) projects.push(p);
      }
      if (!projects.length) {
        toast({ kind: "info", title: "No projects to export" });
        return;
      }
      const payload = { format: "frame-studio-backup", version: 1, schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), projects };
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `frame-studio-backup-${stamp}.json`);
      toast({ kind: "success", title: `Exported ${projects.length} project${projects.length > 1 ? "s" : ""}`, description: "Image assets are not embedded — keep the originals." });
    } catch (e) {
      toast({ kind: "error", title: "Export failed", description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  };

  const clearThumbs = async () => {
    setConfirmClear(false);
    try {
      const db = await getDB();
      await db.clear("thumbnails");
      toast({ kind: "success", title: "Thumbnail cache cleared", description: "Thumbnails are regenerated the next time each project is saved." });
      void refreshEstimate();
    } catch (e) {
      toast({ kind: "error", title: "Could not clear cache", description: errorMessage(e) });
    }
  };

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
    toast({ kind: "info", title: "Signed out" });
  };

  const pct = estimate && estimate.quota ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;
  const isSwatch = SWATCHES.some((s) => s.value.toLowerCase() === ui.accent.toLowerCase());

  return (
    <SiteShell>
      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8 md:py-14">
        <PageHeader index="07 — SETTINGS" title="Settings" />
        <div className="grid gap-10 pt-10 lg:grid-cols-[200px_1fr]">
          <nav aria-label="Settings sections" className="hidden lg:block">
            <ul className="sticky top-24 flex flex-col">
              {[
                ["01", "Appearance", "appearance"],
                ["02", "Editor", "editor"],
                ["03", "Storage", "storage"],
                ["04", "Account", "account"],
                ["05", "About", "about"],
              ].map(([n, label, id]) => (
                <li key={id}>
                  <a href={`#${id}`} className="flex items-baseline gap-2 border-b border-line py-2 text-[13px] text-muted hover:text-fg">
                    <span className="font-mono text-[9px] text-accent">{n}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 max-w-4xl">
            <Section n="01" title="Appearance" id="appearance">
              <Row label="Interface theme" hint="System follows your operating system setting.">
                <Segmented<ThemePref>
                  size="md"
                  value={ui.theme}
                  onChange={ui.setTheme}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "System" },
                  ]}
                />
              </Row>
              <Row label="Editor theme" hint="The editor workspace can stay dark while the site is light.">
                <Segmented
                  size="md"
                  value={ui.editorTheme}
                  onChange={ui.setEditorTheme}
                  options={[
                    { value: "dark", label: "Dark" },
                    { value: "light", label: "Light" },
                    { value: "match", label: "Match site" },
                  ]}
                />
              </Row>
              <Row label="Accent colour" hint="Used for highlights, selection and focus rings.">
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES.map((s) => {
                    const active = s.value.toLowerCase() === ui.accent.toLowerCase();
                    return (
                      <button
                        key={s.value}
                        aria-label={s.label}
                        aria-pressed={active}
                        title={s.label}
                        onClick={() => ui.setAccent(s.value)}
                        className={cx("relative flex h-8 w-8 items-center justify-center border", active ? "border-fg" : "border-line")}
                      >
                        <span className="h-6 w-6" style={{ background: s.value }} />
                        {active && <Check size={12} className="absolute text-white" />}
                      </button>
                    );
                  })}
                  <label className={cx("flex h-8 items-center gap-2 border px-2 text-[12px]", !isSwatch ? "border-fg" : "border-line")} title="Custom colour">
                    <input
                      type="color"
                      aria-label="Custom accent colour"
                      value={/^#[0-9a-f]{6}$/i.test(custom) ? custom : "#ff4d00"}
                      onChange={(e) => {
                        setCustom(e.target.value);
                        ui.setAccent(e.target.value.toUpperCase());
                      }}
                      className="fs-swatch h-5 w-5"
                    />
                    Custom
                  </label>
                  <span className="font-mono text-[11px] text-muted">{ui.accent.toUpperCase()}</span>
                </div>
              </Row>
            </Section>

            <Section n="02" title="Editor" id="editor">
              <Row label="Nudge distance" hint="Arrow keys move by 1 px; Shift + arrow moves by this amount.">
                <Select
                  value={String(ui.nudge)}
                  onChange={(v) => ui.setPref({ nudge: Number(v) })}
                  options={["5", "8", "10", "16", "20", "50"].map((v) => ({ value: v, label: `${v} px` }))}
                />
              </Row>
              <Row label="Autosave delay" hint="How long after your last change the project is saved.">
                <Select
                  value={String(ui.autosaveDelay)}
                  onChange={(v) => ui.setPref({ autosaveDelay: Number(v) })}
                  options={[
                    { value: "400", label: "0.4 s — immediate" },
                    { value: "800", label: "0.8 s — default" },
                    { value: "1500", label: "1.5 s" },
                    { value: "3000", label: "3 s — low-power" },
                  ]}
                />
              </Row>
              <Row label="Rulers" hint="Show pixel rulers around the canvas.">
                <Toggle label={ui.showRulers ? "Shown" : "Hidden"} checked={ui.showRulers} onChange={(v) => ui.setPref({ showRulers: v })} />
              </Row>
              <Row label="Reduce motion" hint="Minimise animations across the studio.">
                <Toggle label={ui.reduceMotion ? "On" : "Off"} checked={ui.reduceMotion} onChange={(v) => ui.setPref({ reduceMotion: v })} />
              </Row>
            </Section>

            <Section n="03" title="Storage" id="storage">
              <Row label="Browser storage" hint="Projects, thumbnails, assets and fonts are stored in IndexedDB on this device.">
                {storageError ? (
                  <p className="text-[12px] text-muted">{storageError}</p>
                ) : !estimate ? (
                  <div className="flex items-center gap-2 text-[12px] text-muted">
                    <Spinner /> Measuring…
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between font-mono text-[11px]">
                      <span>{formatBytes(estimate.usage)} used</span>
                      <span className="text-subtle">of {formatBytes(estimate.quota)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Storage used">
                      <div className="h-full bg-accent" style={{ width: `${Math.max(pct, 0.5)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <HardDrive size={12} /> {persisted ? "Persistent — protected from eviction" : "Best-effort — may be evicted under pressure"}
                      </span>
                      {persisted === false && (
                        <button className="label-mono hover:text-fg" onClick={() => void requestPersist()}>
                          Make persistent
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Row>
              <Row label="Export all projects" hint="One JSON backup file containing every project on this device.">
                <Button onClick={() => void exportAll()} disabled={exporting}>
                  {exporting ? <Spinner /> : <Download size={14} />} Export backup
                </Button>
              </Row>
              <Row label="Thumbnail cache" hint="Frees space; thumbnails are regenerated on the next save.">
                <Button variant="danger" onClick={() => setConfirmClear(true)}>
                  <Trash2 size={14} /> Clear thumbnails
                </Button>
              </Row>
            </Section>

            <Section n="04" title="Account" id="account">
              <Row label="Cloud" hint={isCloudConfigured ? "Supabase is configured for this installation." : "No backend configured — running in local mode."}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className={cx("h-2 w-2", isCloudConfigured ? (user ? "bg-ok" : "bg-accent") : "bg-subtle")} />
                  {!isCloudConfigured ? "Local mode" : !ready ? "Checking…" : user ? "Connected · syncing" : "Available · signed out"}
                </div>
              </Row>
              {isCloudConfigured && (
                <Row label={user ? "Signed in" : "Not signed in"} hint={user?.email ?? "Sign in to sync projects and publish to the community."}>
                  {user ? (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => router.push("/profile")}>Profile</Button>
                      <Button variant="danger" onClick={() => void signOut()}>
                        <LogOut size={14} /> Sign out
                      </Button>
                    </div>
                  ) : (
                    <Button variant="primary" onClick={() => router.push("/auth")}>
                      Sign in
                    </Button>
                  )}
                </Row>
              )}
            </Section>

            <Section n="05" title="About" id="about">
              <div className="grid gap-6 pt-5 md:grid-cols-2">
                <p className="text-sm text-muted">
                  FRAME STUDIO is a graphic design studio built on mathematical grids, editorial typography and image processing. Your work stays on your device unless you sign in, and nothing is published without your
                  explicit consent.
                </p>
                <dl className="grid grid-cols-2 gap-y-2 font-mono text-[11px]">
                  <dt className="text-subtle">DOCUMENT SCHEMA</dt>
                  <dd>v{CURRENT_SCHEMA_VERSION}</dd>
                  <dt className="text-subtle">STORAGE</dt>
                  <dd>IndexedDB{isCloudConfigured ? " + Supabase" : ""}</dd>
                  <dt className="text-subtle">VERSION</dt>
                  <dd>0.1.0</dd>
                  <dt className="text-subtle">START</dt>
                  <dd>
                    <Link href="/create" className="underline hover:text-accent">
                      Create a design
                    </Link>
                  </dd>
                </dl>
              </div>
            </Section>
          </div>
        </div>
      </div>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        eyebrow="Storage"
        title="Clear thumbnail cache?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void clearThumbs()}>
              Clear
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Project cards will show a neutral frame until each project is opened and saved again. Your projects and assets are not affected.</p>
      </Dialog>
    </SiteShell>
  );
}
