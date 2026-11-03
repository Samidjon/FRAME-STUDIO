"use client";

import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:bg-accent hover:text-accent-ink border border-fg hover:border-accent",
  accent: "bg-accent text-accent-ink border border-accent hover:brightness-110",
  secondary: "bg-transparent text-fg border border-line-strong hover:border-fg",
  ghost: "bg-transparent text-fg border border-transparent hover:bg-sunken",
  danger: "bg-transparent text-danger border border-danger/50 hover:bg-danger hover:text-white",
};
const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-12 px-6 text-sm gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "secondary", size = "md", className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          "inline-flex select-none items-center justify-center rounded-[2px] font-medium tracking-tight transition-[background,color,border,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
          variants[variant],
          sizes[size],
          className,
        )}
        {...rest}
      />
    );
  },
);

/** Square icon button with an accessible label and a CSS tooltip. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; shortcut?: string; tipSide?: "top" | "bottom" | "right" | "left"; size?: "sm" | "md" }
>(function IconButton({ label, active, shortcut, tipSide = "bottom", className, size = "md", children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      aria-pressed={active}
      data-tip={shortcut ? `${label}  ${shortcut}` : label}
      data-tip-side={tipSide}
      className={cx(
        "fs-tip relative inline-flex shrink-0 items-center justify-center rounded-[2px] border transition-colors duration-100 disabled:opacity-35 disabled:pointer-events-none",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        active ? "border-fg bg-fg text-bg" : "border-transparent text-fg hover:bg-sunken hover:border-line",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Tooltip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: "top" | "bottom" | "right" | "left" }) {
  return (
    <span className="fs-tip relative inline-flex" data-tip={label} data-tip-side={side}>
      {children}
    </span>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string }>(function TextInput(
  { label, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <label htmlFor={fid} className="flex flex-col gap-1.5">
      {label && <span className="label-mono">{label}</span>}
      <input
        ref={ref}
        id={fid}
        className={cx(
          "h-9 w-full rounded-[2px] border border-line-strong bg-transparent px-3 text-[13px] text-fg placeholder:text-subtle outline-none transition-colors focus:border-fg",
          className,
        )}
        {...rest}
      />
    </label>
  );
});

/** Compact numeric field with label, drag-to-scrub on the label and arrow-key stepping. */
export function NumberField({
  label,
  value,
  onChange,
  min = -1e6,
  max = 1e6,
  step = 1,
  suffix,
  className,
  precision = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  precision?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? Number(value.toFixed(precision)).toString() : "");
  const commit = (s: string) => {
    const v = parseFloat(s);
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
    setDraft(null);
  };
  const scrub = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const start = value;
    const move = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / 2) * step * (ev.shiftKey ? 10 : 1);
      onChange(Math.min(max, Math.max(min, Number((start + delta).toFixed(precision)))));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className={cx("group flex h-7 items-center rounded-[2px] border border-line bg-sunken/40 focus-within:border-fg", className)}>
      <span onPointerDown={scrub} className="label-mono flex h-full w-6 shrink-0 cursor-ew-resize select-none items-center justify-center !text-[9px]" title={`Drag to adjust ${label}`}>
        {label}
      </span>
      <input
        aria-label={label}
        inputMode="decimal"
        className="h-full w-full min-w-0 bg-transparent pr-1 text-right font-mono text-[11px] text-fg outline-none"
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onChange(Math.min(max, Math.max(min, Number((value + d).toFixed(precision)))));
          }
        }}
      />
      {suffix && <span className="pr-1.5 font-mono text-[10px] text-subtle">{suffix}</span>}
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  onCommit?: () => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] text-muted">
          {label}
        </label>
        <span className="font-mono text-[10px] text-subtle tabular-nums">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        className="fs-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </div>
  );
}

export function ColorField({ label, value, onChange, allowNone }: { label: string; value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const hex = value && value.startsWith("#") ? value.slice(0, 7) : "#000000";
  return (
    <div className="flex items-center gap-2">
      <input aria-label={`${label} colour`} type="color" className="fs-swatch" value={hex} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      <input
        aria-label={`${label} hex`}
        className="h-7 w-full min-w-0 rounded-[2px] border border-line bg-transparent px-2 font-mono text-[11px] uppercase text-fg outline-none focus:border-fg"
        value={draft ?? value ?? "none"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const v = draft.trim();
            if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) onChange(v.toUpperCase());
            else if (allowNone && (v === "" || v.toLowerCase() === "none")) onChange(null);
          }
          setDraft(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      {allowNone && (
        <button className="label-mono hover:text-fg" onClick={() => onChange(value ? null : "#171717")} aria-label={value ? `Remove ${label}` : `Add ${label}`}>
          {value ? "×" : "+"}
        </button>
      )}
    </div>
  );
}

export function Select<T extends string>({ label, value, options, onChange, className }: { label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  // The <label> wraps the <select>, so no generated id is needed (avoids SSR id drift).
  return (
    <label className={cx("flex flex-col gap-1", className)}>
      {label && <span className="label-mono">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-7 w-full rounded-[2px] border border-line bg-bg px-2 text-[12px] text-fg outline-none focus:border-fg"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "sm" }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" className="flex w-full rounded-[2px] border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          aria-label={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex flex-1 items-center justify-center rounded-[1px] transition-colors",
            size === "sm" ? "h-6 text-[11px]" : "h-8 text-xs",
            value === o.value ? "bg-fg text-bg" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-1 text-[12px] text-muted hover:text-fg">
      <span>{label}</span>
      <span className={cx("relative h-3.5 w-6 rounded-full border transition-colors", checked ? "border-accent bg-accent" : "border-line-strong")}>
        <span className={cx("absolute top-[1px] h-2.5 w-2.5 rounded-full transition-all", checked ? "left-[11px] bg-white" : "left-[1px] bg-subtle")} />
      </span>
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-label="Loading" role="status" className={cx("inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent", className)} />;
}

export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("input,button,select,textarea,[tabindex]")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 animate-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx("flex max-h-[90vh] w-full flex-col border border-line-strong bg-bg text-fg shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] animate-rise", width)}>
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            {eyebrow && <div className="label-mono mb-1">{eyebrow}</div>}
            <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          </div>
          <IconButton label="Close" onClick={onClose} size="sm">
            <X size={14} />
          </IconButton>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ index, title, body, action }: { index?: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 border border-dashed border-line-strong p-10">
      <div className="grid grid-cols-3 gap-1" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className={cx("h-2.5 w-2.5", i === 4 ? "bg-accent" : "border border-line-strong")} />
        ))}
      </div>
      {index && <div className="label-mono">{index}</div>}
      <h3 className="font-display text-2xl font-semibold tracking-tight">{title}</h3>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

export function SectionLabel({ index, children, className }: { index?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("label-mono flex items-center gap-2", className)}>
      {index && <span className="text-accent">{index}</span>}
      <span>{children}</span>
    </div>
  );
}
