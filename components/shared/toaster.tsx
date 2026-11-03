"use client";

import { X } from "lucide-react";
import { useUi } from "@/stores/ui-store";
import { cx } from "./ui";

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="pointer-events-auto flex items-start gap-3 border border-line-strong bg-bg p-3 text-fg shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] animate-rise"
        >
          <span className={cx("mt-1 h-2 w-2 shrink-0", t.kind === "error" ? "bg-danger" : t.kind === "success" ? "bg-ok" : "bg-accent")} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">{t.title}</div>
            {t.description && <div className="mt-0.5 text-xs text-muted">{t.description}</div>}
            {t.action && (
              <button
                className="mt-2 text-xs font-medium text-accent underline-offset-2 hover:underline"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button aria-label="Dismiss" className="text-subtle hover:text-fg" onClick={() => dismiss(t.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
