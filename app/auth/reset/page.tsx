"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { SiteShell } from "@/components/navigation/site-header";
import { Button, Spinner, TextInput } from "@/components/shared/ui";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";
import { useUi } from "@/stores/ui-store";

type Phase = "checking" | "ready" | "missing" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useUi((s) => s.toast);
  const [phase, setPhase] = useState<Phase>(isCloudConfigured ? "checking" : "missing");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let settled = false;
    // The recovery link signs the user in via the URL (detectSessionInUrl).
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        settled = true;
        setPhase((p) => (p === "done" ? p : "ready"));
      }
    });
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setPhase((p) => (p === "done" ? p : "ready"));
      }
    });
    // Give the URL token exchange a moment before declaring the link invalid.
    const t = setTimeout(() => {
      if (!settled) setPhase((p) => (p === "checking" ? "missing" : p));
    }, 2500);
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  const pwOk = password.length >= 8;
  const match = password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!pwOk || !match) return;
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    try {
      const { error: err } = await sb.auth.updateUser({ password });
      if (err) throw err;
      setPhase("done");
      toast({ kind: "success", title: "Password updated" });
      setTimeout(() => router.push("/projects"), 1200);
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setError(/session/i.test(m) ? "Your reset link has expired. Request a new one." : m || "Could not update the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteShell>
      <div className="mx-auto max-w-[560px] px-4 py-16 md:py-24">
        <div className="label-mono mb-3">
          <span className="text-accent">08 — ACCOUNT</span>
        </div>
        <h1 className="font-display text-5xl font-semibold leading-[0.9] tracking-[-0.045em]">New password</h1>
        <div className="mt-8 border border-line-strong p-6 md:p-8">
          {!isCloudConfigured ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted">Accounts are not enabled on this installation — Senitukang Studio is running in local mode, so there is no password to reset.</p>
              <div>
                <Button variant="primary" onClick={() => router.push("/create")}>
                  Continue without account
                </Button>
              </div>
            </div>
          ) : phase === "checking" ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Verifying your reset link…
            </div>
          ) : phase === "missing" ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-display text-2xl font-semibold tracking-tight">This link is invalid or has expired.</h2>
              <p className="text-sm text-muted">Password reset links work once and expire after a short time. Request a new one and open it in this browser.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => router.push("/auth?tab=forgot")}>
                  Request new link
                </Button>
                <Button onClick={() => router.push("/auth")}>Sign in</Button>
              </div>
            </div>
          ) : phase === "done" ? (
            <div className="flex flex-col gap-3" role="status">
              <KeyRound size={20} className="text-ok" />
              <h2 className="font-display text-2xl font-semibold tracking-tight">Password updated.</h2>
              <p className="text-sm text-muted">
                Taking you to <Link href="/projects" className="underline">My Projects</Link>…
              </p>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="flex flex-col gap-4">
              <div>
                <TextInput label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={touched && !pwOk} />
                {touched && !pwOk && <p className="mt-1 text-[11px] text-danger">Use at least 8 characters.</p>}
              </div>
              <div>
                <TextInput label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={touched && !match} />
                {touched && !match && <p className="mt-1 text-[11px] text-danger">Passwords do not match.</p>}
              </div>
              {error && (
                <p role="alert" className="border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" size="lg" disabled={busy}>
                {busy && <Spinner />} Update password
              </Button>
            </form>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
