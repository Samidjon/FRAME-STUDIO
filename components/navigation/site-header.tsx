"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useUi } from "@/stores/ui-store";
import { useAuth } from "@/stores/auth-store";
import { cx } from "@/components/shared/ui";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cx("group flex items-center gap-2.5", className)} aria-label="FRAME STUDIO home">
      <span className="relative block h-5 w-5 border-[1.5px] border-fg" aria-hidden>
        <span className="absolute left-[3px] top-[3px] h-[9px] w-[9px] bg-accent transition-transform duration-300 group-hover:translate-x-[2px] group-hover:translate-y-[2px]" />
      </span>
      <span className="font-display text-[15px] font-bold tracking-[-0.02em]">
        FRAME<span className="font-normal text-muted"> STUDIO</span>
      </span>
    </Link>
  );
}

export const NAV = [
  { href: "/templates", label: "Templates", n: "01" },
  { href: "/create", label: "Create", n: "02" },
  { href: "/explore", label: "Explore", n: "03" },
  { href: "/projects", label: "My Projects", n: "04" },
  { href: "/assets", label: "Assets", n: "05" },
];

export function ThemeToggle() {
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const dark = theme === "dark";
  return (
    <button
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="fs-tip flex h-8 w-8 items-center justify-center border border-transparent hover:border-line"
      data-tip={dark ? "Light theme" : "Dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const user = useAuth((s) => s.user);
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 md:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = path?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx("group relative flex items-baseline gap-1.5 px-3 py-2 text-[13px] transition-colors", active ? "text-fg" : "text-muted hover:text-fg")}
              >
                <span className={cx("font-mono text-[9px]", active ? "text-accent" : "text-subtle group-hover:text-accent")}>{n.n}</span>
                {n.label}
                {active && <span className="absolute inset-x-3 -bottom-[9px] h-[2px] bg-accent" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {user ? (
            <Link href="/profile" className="flex h-8 items-center gap-2 border border-line px-3 text-[13px] hover:border-fg">
              <span className="h-2 w-2 bg-ok" />
              Profile
            </Link>
          ) : (
            <Link href="/auth" className="h-8 px-3 text-[13px] leading-8 text-muted hover:text-fg">
              Sign in
            </Link>
          )}
          <Link href="/create" className="flex h-8 items-center bg-fg px-3.5 text-[13px] font-medium text-bg transition-colors hover:bg-accent hover:text-white">
            Start Creating
          </Link>
        </div>
        <button className="ml-auto md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile" className="border-t border-line px-4 py-3 md:hidden">
          {[...NAV, { href: "/profile", label: "Profile", n: "06" }, { href: "/settings", label: "Settings", n: "07" }].map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="flex items-baseline gap-3 border-b border-line py-3 font-display text-xl tracking-tight">
              <span className="font-mono text-[10px] text-accent">{n.n}</span>
              {n.label}
            </Link>
          ))}
          <div className="flex items-center justify-between pt-3">
            <ThemeToggle />
            <Link href="/create" onClick={() => setOpen(false)} className="bg-fg px-4 py-2 text-sm text-bg">
              Start Creating
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 md:grid-cols-12 md:px-8">
        <div className="md:col-span-5">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted">Create your own visual language. A studio for posters, covers, wallpapers and typographic compositions — built on mathematical grids.</p>
        </div>
        {[
          { t: "Studio", l: [["Create", "/create"], ["Templates", "/templates"], ["Generator", "/create?mode=generate"]] },
          { t: "Library", l: [["My Projects", "/projects"], ["Assets", "/assets"], ["Explore", "/explore"]] },
          { t: "Account", l: [["Profile", "/profile"], ["Settings", "/settings"], ["Sign in", "/auth"]] },
        ].map((c) => (
          <div key={c.t} className="md:col-span-2">
            <div className="label-mono mb-3">{c.t}</div>
            <ul className="space-y-2 text-sm">
              {c.l.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-muted hover:text-fg">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between border-t border-line px-4 py-4 md:px-8">
        <span className="label-mono">© {new Date().getFullYear()} FRAME STUDIO</span>
        <span className="label-mono">Grid · Type · Image</span>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
