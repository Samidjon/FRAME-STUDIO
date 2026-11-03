import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/shared/ui";

/** Page container matching the SiteShell header / footer measure. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-[1440px] px-4 md:px-8", className)}>{children}</div>;
}

/**
 * Section opener on the 12-column grid: index label (cols 1–3), headline
 * (cols 4–9) and an optional side note (cols 10–12). One hairline on top.
 */
export function SectionHead({
  index,
  label,
  title,
  aside,
  id,
}: {
  index: string;
  label: string;
  title: ReactNode;
  aside?: ReactNode;
  id: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 border-t border-line pt-4 md:grid-cols-12 md:gap-x-6">
      <div className="label-mono flex items-center gap-2 md:col-span-3">
        <span className="text-accent">{index}</span>
        <span aria-hidden>—</span>
        <span>{label}</span>
      </div>
      <h2 id={id} className="font-display text-[clamp(2rem,4.4vw,4rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-fg md:col-span-6">
        {title}
      </h2>
      {aside && <div className="text-sm leading-relaxed text-muted md:col-span-3 md:pt-2">{aside}</div>}
    </div>
  );
}

const linkBase =
  "inline-flex select-none items-center justify-center gap-2.5 rounded-[2px] font-medium tracking-tight transition-[background,color,border-color] duration-150 active:translate-y-px";

/** Next <Link> styled with the shared Button vocabulary (links must stay links). */
export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "lg",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "inverse";
  size?: "md" | "lg";
  className?: string;
}) {
  const v = {
    primary: "border border-fg bg-fg text-bg hover:border-accent hover:bg-accent hover:text-accent-ink",
    secondary: "border border-line-strong bg-transparent text-fg hover:border-fg",
    inverse: "border border-bg bg-bg text-fg hover:border-accent hover:bg-accent hover:text-accent-ink",
  }[variant];
  const s = size === "lg" ? "h-12 px-6 text-sm" : "h-9 px-3.5 text-[13px]";
  return (
    <Link href={href} className={cx(linkBase, v, s, className)}>
      {children}
    </Link>
  );
}

/** Small arrow drawn on the 8px grid — avoids icon-font fuzziness. */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className={cx("shrink-0", className)} aria-hidden>
      <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}
