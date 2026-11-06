"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Globe, Menu, Moon, Sun, X } from "lucide-react";
import { useUi } from "@/stores/ui-store";
import { useAuth } from "@/stores/auth-store";
import { cx } from "@/components/shared/ui";
import { SYMBOL_PATH, SYMBOL_VIEWBOX } from "@/core/brand/logo-paths";

export function BrandSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${SYMBOL_VIEWBOX.width} ${SYMBOL_VIEWBOX.height}`} className={className} fill="currentColor" aria-hidden>
      <path d={SYMBOL_PATH} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cx("group flex items-center gap-2.5", className)} aria-label="Senitukang Studio home">
      <BrandSymbol className="h-5 w-auto text-fg transition-colors duration-300 group-hover:text-accent" />
      <span className="whitespace-nowrap font-display text-[15px] font-bold tracking-[-0.02em]">
        Senitukang<span className="font-normal text-muted"> Studio</span>
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

function InstagramIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.25" cy="6.75" r="0.5" fill="currentColor" />
    </svg>
  );
}

const COMPANY_LINKS = [
  { href: "https://www.instagram.com/senitukang/", label: "Senitukang on Instagram", tip: "Instagram", icon: <InstagramIcon /> },
  { href: "https://senitukang.com/", label: "Senitukang website", tip: "senitukang.com", icon: <Globe size={15} /> },
];

function CompanyLinks() {
  return (
    <>
      {COMPANY_LINKS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l.label}
          data-tip={l.tip}
          className="fs-tip relative flex h-8 w-8 items-center justify-center border border-transparent text-muted transition-colors hover:border-line hover:text-fg"
        >
          {l.icon}
        </a>
      ))}
    </>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const user = useAuth((s) => s.user);
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 md:px-8 xl:gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((n) => {
            const active = path?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx("group relative flex items-baseline gap-1.5 whitespace-nowrap px-2 py-2 text-[13px] transition-colors xl:px-3", active ? "text-fg" : "text-muted hover:text-fg")}
              >
                <span className={cx("font-mono text-[9px]", active ? "text-accent" : "text-subtle group-hover:text-accent")}>{n.n}</span>
                {n.label}
                {active && <span className="absolute inset-x-2 -bottom-[9px] xl:inset-x-3 h-[2px] bg-accent" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
          <CompanyLinks />
          <ThemeToggle />
          {user ? (
            <Link href="/profile" className="flex h-8 items-center gap-2 border border-line px-3 text-[13px] hover:border-fg">
              <span className="h-2 w-2 bg-ok" />
              Profile
            </Link>
          ) : (
            <Link href="/auth" className="h-8 whitespace-nowrap px-3 text-[13px] leading-8 text-muted hover:text-fg">
              Sign in
            </Link>
          )}
          <Link href="/create" className="flex h-8 items-center whitespace-nowrap bg-fg px-3.5 text-[13px] font-medium text-bg transition-colors hover:bg-accent hover:text-white">
            Start Creating
          </Link>
        </div>
        <button className="ml-auto lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile" className="border-t border-line px-4 py-3 lg:hidden">
          {[...NAV, { href: "/profile", label: "Profile", n: "06" }, { href: "/settings", label: "Settings", n: "07" }].map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="flex items-baseline gap-3 border-b border-line py-3 font-display text-xl tracking-tight">
              <span className="font-mono text-[10px] text-accent">{n.n}</span>
              {n.label}
            </Link>
          ))}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-1">
              <CompanyLinks />
              <ThemeToggle />
            </div>
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
          <p className="mt-4 max-w-sm text-sm text-muted">Create your own Senitukang poster. A studio for posters, covers, wallpapers and typographic compositions — built on mathematical grids.</p>
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
        <span className="label-mono">© {new Date().getFullYear()} Senitukang Studio</span>
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
