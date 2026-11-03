"use client";

import { useEffect, useId, useState } from "react";
import { Globe, Lock } from "lucide-react";
import { Button, Dialog, Select, Spinner, TextInput, cx } from "@/components/shared/ui";
import { getProject, updateProjectMeta } from "@/lib/storage/projects";
import { publishProject, unpublishProject } from "@/lib/supabase/sync";
import { TEMPLATE_CATEGORIES } from "@/core/templates/types";
import { useAuth } from "@/stores/auth-store";
import { useUi } from "@/stores/ui-store";
import type { Project } from "@/types/project";
import { errorMessage } from "./utils";

const NONE = "__none";

function parseTags(s: string): string[] {
  return [
    ...new Set(
      s
        .split(/[,#\n]/)
        .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9\- ]/g, "").replace(/\s+/g, "-").slice(0, 24))
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

/**
 * Explicit-consent publishing. Nothing is ever made public unless the owner
 * ticks the rights/visibility checkbox and presses Publish.
 */
export function PublishDialog({ projectId, open, onClose, onChanged }: { projectId: string; open: boolean; onClose: () => void; onChanged?: (p: Project) => void }) {
  const toast = useUi((s) => s.toast);
  const cloud = useAuth((s) => s.cloud);
  const user = useAuth((s) => s.user);
  const online = cloud && Boolean(user);
  const consentId = useId();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [category, setCategory] = useState<string>(NONE);
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setConsent(false);
    getProject(projectId)
      .then((p) => {
        if (!alive) return;
        setProject(p);
        setCategory(p?.category ?? NONE);
        setTags(p?.tags.join(", ") ?? "");
      })
      .catch(() => alive && setProject(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, projectId]);

  const published = project?.visibility === "public" && project.publishedAt != null;

  const publish = async () => {
    if (!project || !consent) return;
    setBusy(true);
    try {
      const cat = category === NONE ? null : category;
      const t = parseTags(tags);
      const next = online
        ? await publishProject(project.id, true, { category: cat, tags: t })
        : await updateProjectMeta(project.id, { visibility: "public", publishedAt: Date.now(), category: cat, tags: t });
      setProject(next);
      onChanged?.(next);
      toast({ kind: "success", title: online ? "Published to the community" : "Published locally", description: online ? undefined : "Visible in Explore on this device. Connect Supabase to share it publicly." });
      onClose();
    } catch (e) {
      toast({ kind: "error", title: "Could not publish", description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!project) return;
    setBusy(true);
    try {
      if (online) await unpublishProject(project.id);
      const next = await updateProjectMeta(project.id, { visibility: "private", publishedAt: null });
      setProject(next);
      onChanged?.(next);
      toast({ kind: "info", title: "Design is private again" });
      onClose();
    } catch (e) {
      toast({ kind: "error", title: "Could not unpublish", description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={online ? "Community · Cloud" : "Community · Local mode"}
      title={published ? "Manage publication" : "Publish design"}
      footer={
        <>
          {published && (
            <Button variant="danger" onClick={unpublish} disabled={busy}>
              <Lock size={13} /> Unpublish
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="accent" onClick={publish} disabled={!consent || busy || !project}>
            {busy ? <Spinner /> : <Globe size={13} />} {published ? "Update" : "Publish"}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted">
          <Spinner /> Loading project…
        </div>
      ) : !project ? (
        <p className="py-6 text-sm text-danger">This project could not be found.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between border border-line p-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{project.name}</div>
              <div className="label-mono mt-0.5">
                {project.doc.width} × {project.doc.height} px
              </div>
            </div>
            <span className={cx("label-mono flex items-center gap-1.5 border px-2 py-1", published ? "border-accent text-accent" : "border-line-strong")}>
              {published ? <Globe size={11} /> : <Lock size={11} />}
              {published ? "Public" : "Private"}
            </span>
          </div>

          {!online && (
            <p className="border-l-2 border-accent bg-sunken/60 px-3 py-2 text-[12px] text-muted">
              {cloud
                ? "You are not signed in, so this will only be published on this device. Sign in to share it with the community."
                : "Local mode — publishing marks the design as public on this device only (it appears in Explore as “Published locally”)."}
            </p>
          )}

          <Select
            label="01 — Category"
            value={category}
            onChange={setCategory}
            options={[{ value: NONE, label: "Uncategorised" }, ...TEMPLATE_CATEGORIES.map((c) => ({ value: c as string, label: c }))]}
          />
          <TextInput label="02 — Tags (comma separated, max 12)" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="poster, swiss, grid" maxLength={300} />
          {parseTags(tags).length > 0 && (
            <div className="-mt-3 flex flex-wrap gap-1">
              {parseTags(tags).map((t) => (
                <span key={t} className="border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <label htmlFor={consentId} className={cx("flex cursor-pointer items-start gap-3 border p-3 transition-colors", consent ? "border-accent" : "border-line-strong")}>
            <input id={consentId} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
            <span className="text-[13px]">
              <span className="font-medium">I own the rights to this design and want it publicly visible.</span>
              <span className="mt-1 block text-[12px] text-muted">Anyone can view and copy published designs into their own library. You can unpublish at any time.</span>
            </span>
          </label>
        </div>
      )}
    </Dialog>
  );
}
