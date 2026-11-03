"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cx } from "@/components/shared/ui";

export function relativeTime(t: number, now = Date.now()): string {
  const s = Math.round((now - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  if (d < 35) return `${Math.round(d / 7)} wk ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}

export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function PageHeader({ index, title, lead, actions }: { index: string; title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="label-mono mb-3">
          <span className="text-accent">{index}</span>
        </div>
        <h1 className="font-display text-5xl font-semibold leading-[0.9] tracking-[-0.045em] md:text-7xl">{title}</h1>
        {lead && <p className="mt-4 max-w-xl text-sm text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Minimal accessible overflow menu (click outside / Escape closes). */
export function OverflowMenu({ items, label = "More actions", align = "right" }: { items: MenuItem[]; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-[2px] border border-transparent text-fg hover:border-line hover:bg-sunken"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div role="menu" className={cx("absolute top-8 z-30 min-w-[180px] border border-line-strong bg-bg py-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.4)] animate-fade", align === "right" ? "right-0" : "left-0")}>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              disabled={it.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onClick();
              }}
              className={cx(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-sunken disabled:opacity-40",
                it.danger ? "text-danger" : "text-fg",
              )}
            >
              {it.icon && <span className="flex w-4 justify-center text-muted">{it.icon}</span>}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SkeletonGrid({ count = 8, aspect = "4 / 5", className }: { count?: number; aspect?: string; className?: string }) {
  return (
    <div className={cx("grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="animate-pulse border border-line bg-sunken" style={{ aspectRatio: aspect }} />
          <div className="h-3 w-2/3 animate-pulse bg-sunken" />
          <div className="h-2.5 w-1/3 animate-pulse bg-sunken" />
        </div>
      ))}
    </div>
  );
}

export function ErrorPanel({ title = "Could not load", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border border-danger/40 p-6">
      <div className="label-mono mb-2 text-danger">Error</div>
      <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 h-8 border border-line-strong px-3 text-[13px] hover:border-fg">
          Try again
        </button>
      )}
    </div>
  );
}
