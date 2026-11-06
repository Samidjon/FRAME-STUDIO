"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, HardDrive, Mail } from "lucide-react";
import { SiteShell } from "@/components/navigation/site-header";
import { Button, Segmented, Spinner, TextInput } from "@/components/shared/ui";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/stores/auth-store";
import { useUi } from "@/stores/ui-store";

type Tab = "signin" | "signup" | "forgot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function siteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  return (env && /^https?:\/\//.test(env) ? env : window.location.origin).replace(/\/+$/, "");
}

/** Only allow same-site relative redirects. */
function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/projects";
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return "Please confirm your email address first — check your inbox.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password")) return message;
  if (m.includes("fetch") || m.includes("network")) return "Could not reach the server. Check your connection.";
  return message || "Something went wrong. Please try again.";
}

function LocalModeCard() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5 border border-line-strong bg-raised p-6 md:p-8">
      <HardDrive size={22} className="text-accent" />
      <div className="label-mono">Local mode</div>
      <h2 className="font-display text-3xl font-semibold tracking-tight">Accounts are not enabled here.</h2>
      <p className="text-sm text-muted">
        This Senitukang Studio installation is not connected to a cloud backend. You can still use every design tool — projects, assets and fonts are saved in this browser automatically. Export JSON backups from My
        Projects to move work between devices.
      </p>
      <p className="text-[12px] text-subtle">To enable accounts, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and restart the app.</p>
      <div>
        <Button variant="primary" size="lg" onClick={() => router.push("/create")}>
          Continue without account <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}

function AuthForms() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useUi((s) => s.toast);
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const initial = params.get("tab");
  const next = safeNext(params.get("next"));

  const [tab, setTab] = useState<Tab>(initial === "signup" || initial === "forgot" ? initial : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setError(null);
    setNotice(null);
    setTouched(false);
  }, [tab]);

  const emailOk = EMAIL_RE.test(email.trim());
  const pwOk = tab === "signup" ? password.length >= 8 : password.length > 0;
  const confirmOk = tab !== "signup" || password === confirm;
  const valid = emailOk && (tab === "forgot" || (pwOk && confirmOk));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    setNotice(null);
    if (!valid) return;
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    try {
      if (tab === "signin") {
        const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        toast({ kind: "success", title: "Welcome back" });
        router.push(next);
      } else if (tab === "signup") {
        const { data, error: err } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: siteUrl(), data: displayName.trim() ? { display_name: displayName.trim().slice(0, 64) } : undefined },
        });
        if (err) throw err;
        if (data.session) {
          toast({ kind: "success", title: "Account created" });
          router.push(next);
        } else {
          setNotice(`We sent a confirmation link to ${email.trim()}. Open it to activate your account.`);
          setPassword("");
          setConfirm("");
        }
      } else {
        const { error: err } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${siteUrl()}/auth/reset` });
        if (err) throw err;
        // Same message whether or not the address exists (no account enumeration).
        setNotice(`If an account exists for ${email.trim()}, a password reset link is on its way.`);
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  };

  if (!ready)
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted">
        <Spinner /> Checking session…
      </div>
    );

  if (user)
    return (
      <div className="flex flex-col gap-4 border border-line-strong p-6 md:p-8">
        <div className="label-mono text-ok">Signed in</div>
        <h2 className="font-display text-3xl font-semibold tracking-tight">You’re signed in.</h2>
        <p className="text-sm text-muted">{user.email}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => router.push(next)}>
            Continue <ArrowRight size={14} />
          </Button>
          <Button onClick={() => router.push("/profile")}>Profile</Button>
        </div>
      </div>
    );

  const titles: Record<Tab, string> = { signin: "Sign in", signup: "Create account", forgot: "Reset password" };

  return (
    <div className="flex flex-col gap-6 border border-line-strong p-6 md:p-8">
      <Segmented
        size="md"
        value={tab}
        onChange={setTab}
        options={[
          { value: "signin", label: "Sign In" },
          { value: "signup", label: "Sign Up" },
          { value: "forgot", label: "Forgot" },
        ]}
      />
      <h2 className="font-display text-3xl font-semibold tracking-tight">{titles[tab]}</h2>

      {notice ? (
        <div role="status" className="flex items-start gap-3 border border-ok/50 p-4 text-sm">
          <Mail size={16} className="mt-0.5 shrink-0 text-ok" />
          <div>
            <p>{notice}</p>
            <button className="label-mono mt-3 hover:text-fg" onClick={() => (setNotice(null), setTab("signin"))}>
              Back to sign in
            </button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {tab === "signup" && <TextInput label="Display name (optional)" autoComplete="name" value={displayName} maxLength={64} onChange={(e) => setDisplayName(e.target.value)} />}
          <div>
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={touched && !emailOk}
            />
            {touched && !emailOk && <p className="mt-1 text-[11px] text-danger">Enter a valid email address.</p>}
          </div>
          {tab !== "forgot" && (
            <div>
              <TextInput
                label="Password"
                type="password"
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                required
                minLength={tab === "signup" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={touched && !pwOk}
              />
              {touched && !pwOk && <p className="mt-1 text-[11px] text-danger">{tab === "signup" ? "Use at least 8 characters." : "Enter your password."}</p>}
              {tab === "signin" && (
                <button type="button" className="label-mono mt-2 hover:text-fg" onClick={() => setTab("forgot")}>
                  Forgot password?
                </button>
              )}
            </div>
          )}
          {tab === "signup" && (
            <div>
              <TextInput label="Confirm password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={touched && !confirmOk} />
              {touched && !confirmOk && <p className="mt-1 text-[11px] text-danger">Passwords do not match.</p>}
              {password.length > 0 && (
                <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-subtle">
                  {password.length >= 8 ? <Check size={10} className="text-ok" /> : <span className="inline-block h-2 w-2 border border-line-strong" />} 8+ characters
                </p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" disabled={busy}>
            {busy && <Spinner />}
            {tab === "signin" ? "Sign in" : tab === "signup" ? "Create account" : "Send reset link"}
          </Button>
        </form>
      )}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="label-mono">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="ghost" onClick={() => router.push("/create")}>
        Continue without account <ArrowRight size={14} />
      </Button>
    </div>
  );
}

export default function AuthPage() {
  return (
    <SiteShell>
      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-12 md:px-8 md:py-20 lg:grid-cols-[1fr_480px]">
        <div className="flex flex-col justify-between gap-10">
          <div>
            <div className="label-mono mb-3">
              <span className="text-accent">08 — ACCOUNT</span>
            </div>
            <h1 className="font-display text-5xl font-semibold leading-[0.9] tracking-[-0.045em] md:text-7xl">
              Your studio,
              <br />
              everywhere.
            </h1>
            <p className="mt-5 max-w-md text-sm text-muted">Sign in to mirror your projects to the cloud, publish to the community gallery and collect work from other designers. An account is optional — the studio works fully offline.</p>
          </div>
          <ul className="grid max-w-md gap-0 text-[13px]">
            {["Cloud sync across devices", "Publish with explicit consent", "Likes, collections and profiles"].map((t, i) => (
              <li key={t} className="flex items-baseline gap-3 border-t border-line py-3">
                <span className="font-mono text-[10px] text-accent">{String(i + 1).padStart(2, "0")}</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          {isCloudConfigured ? (
            <Suspense
              fallback={
                <div className="flex items-center gap-2 py-16 text-sm text-muted">
                  <Spinner /> Loading…
                </div>
              }
            >
              <AuthForms />
            </Suspense>
          ) : (
            <LocalModeCard />
          )}
          <p className="mt-4 text-[12px] text-subtle">
            By creating an account you agree that your projects are stored privately unless you choose to publish them. <Link href="/settings" className="underline">Settings</Link>
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
