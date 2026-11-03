import { cx } from "@/components/shared/ui";

/** Proportional outline of a page format, drawn inside a square of `size` px. */
export function FormatGlyph({ width, height, size = 44, active, className }: { width: number; height: number; size?: number; active?: boolean; className?: string }) {
  const s = size / Math.max(width, height, 1);
  const w = Math.max(4, Math.round(width * s));
  const h = Math.max(4, Math.round(height * s));
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }} aria-hidden>
      <span
        className={cx("relative block border transition-colors", active ? "border-accent bg-accent/15" : "border-line-strong bg-sunken/60")}
        style={{ width: w, height: h }}
      >
        <span className={cx("absolute left-[3px] right-[3px] top-[3px] h-px", active ? "bg-accent" : "bg-line-strong")} />
      </span>
    </span>
  );
}

export const formatDims = (w: number, h: number) => `${w} × ${h}`;

export function ratioLabel(w: number, h: number) {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = gcd(Math.round(w), Math.round(h)) || 1;
  const a = Math.round(w / g);
  const b = Math.round(h / g);
  return a <= 40 && b <= 40 ? `${a}:${b}` : (w / h).toFixed(2);
}
