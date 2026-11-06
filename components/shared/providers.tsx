"use client";

import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { useUi } from "@/stores/ui-store";
import { useAuth } from "@/stores/auth-store";
import { restoreUserFonts } from "@/lib/storage/assets";
import { Toaster } from "./toaster";
import { CloudSyncBridge } from "@/lib/supabase/sync";

function ThemeSync() {
  const theme = useUi((s) => s.theme);
  const accent = useUi((s) => s.accent);
  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);
  return null;
}

function Boot() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    init();
    restoreUserFonts();
  }, [init]);
  return null;
}

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: (err: Error, reset: () => void) => ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Senitukang Studio] UI error", error, info.componentStack);
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div role="alert" className="mx-auto my-24 max-w-lg border border-line-strong p-8">
          <div className="label-mono mb-2 text-accent">Error</div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Something broke in this view.</h2>
          <p className="mt-2 text-sm text-muted">Your projects are stored locally and are safe. Try again, or reload the page.</p>
          <pre className="mt-4 max-h-32 overflow-auto bg-sunken p-3 font-mono text-[11px] text-muted">{this.state.error.message}</pre>
          <div className="mt-5 flex gap-2">
            <button className="h-9 border border-fg bg-fg px-4 text-sm text-bg" onClick={this.reset}>
              Try again
            </button>
            <button className="h-9 border border-line-strong px-4 text-sm" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <ThemeSync />
      <Boot />
      <CloudSyncBridge />
      <ErrorBoundary>{children}</ErrorBoundary>
      <Toaster />
    </>
  );
}
