"use client";

/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-48a02b8-20260530T050211Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-48a02b8-20260530T045550Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-48a02b8-20260530T045125Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-48a02b8-20260530T044603Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { BrandLogo } from "@/app/_components/brand/BrandLogo";
import {
  DASHBOARD_PRIMARY_LINKS,
  DASHBOARD_SETTINGS_LINKS,
  type DashboardNavLink,
} from "@/app/_components/dashboard/dashboard-nav-links";
import { createClient } from "@/utils/supabase/client";

type Props = {
  userEmail: string;
  showAdminPortalLink?: boolean;
  tokenSavingsHref?: string;
  primaryLinksOverride?: DashboardNavLink[];
};

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function isLinkActive(pathname: string, link: DashboardNavLink): boolean {
  const base = link.matchPath ?? link.href.split("#")[0];
  if (base && pathname === base) {
    if (link.href.includes("#")) return false;
    return true;
  }
  return pathname === link.href.split("#")[0];
}

function NavLinkItem({
  link,
  active,
  onNavigate,
  className = "",
}: {
  link: DashboardNavLink;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const accent = link.accent === "amber";
  const base =
    "block rounded-lg px-3 py-2 text-sm font-medium transition duration-200 " + className;
  const activeStyles = accent
    ? "bg-amber-500/15 text-amber-100"
    : "bg-emerald-500/15 text-emerald-100";
  const idleStyles = accent
    ? "text-amber-400/90 hover:bg-amber-500/10 hover:text-amber-200"
    : "text-slate-300 hover:bg-white/5 hover:text-slate-50";

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={`${base} ${active ? activeStyles : idleStyles}`}
      aria-current={active ? "page" : undefined}
    >
      {link.label}
    </Link>
  );
}

export function DashboardNav({
  userEmail,
  showAdminPortalLink = false,
  tokenSavingsHref = "/dashboard#token-savings",
  primaryLinksOverride,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsMenuId = useId();
  const mobileDrawerId = useId();

  const primaryLinks = primaryLinksOverride ?? DASHBOARD_PRIMARY_LINKS(tokenSavingsHref);
  const settingsLinks = [
    ...DASHBOARD_SETTINGS_LINKS,
    ...(showAdminPortalLink
      ? [{ label: "Admin portal", href: "/admin/portal", matchPath: "/admin" } satisfies DashboardNavLink]
      : []),
  ];

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/sign-in");
      router.refresh();
    } catch {
      window.location.assign("/sign-in");
    }
  }, [router]);

  const closeAll = useCallback(() => {
    setSettingsOpen(false);
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onEscape);
    };
  }, [mobileOpen]);

  useEffect(() => {
    closeAll();
  }, [pathname, closeAll]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-violet-500/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-5">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5"
            onClick={closeAll}
          >
            <BrandLogo
              size={36}
              decorative
              className="border border-emerald-400/30 bg-emerald-500/10"
            />
            <div className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold tracking-tight text-slate-100 group-hover:text-emerald-200">
                Elphie&apos;s Gated AI
              </span>
              <span className="block text-[11px] text-slate-500">Glass-box platform</span>
            </div>
          </Link>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto md:flex"
            aria-label="Workspace"
          >
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm transition duration-200 xl:px-3 ${
                  isLinkActive(pathname, link)
                    ? link.accent === "amber"
                      ? "bg-amber-500/15 font-medium text-amber-100"
                      : "bg-emerald-500/15 font-medium text-emerald-100"
                    : link.accent === "amber"
                      ? "text-amber-400/90 hover:bg-amber-500/10 hover:text-amber-200"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div ref={settingsRef} className="relative">
              <button
                type="button"
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition duration-200 ${
                  settingsOpen
                    ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
                    : "border-slate-600/50 bg-slate-900/60 text-slate-300 hover:border-violet-500/35 hover:bg-violet-500/10 hover:text-violet-100"
                }`}
                aria-expanded={settingsOpen}
                aria-haspopup="menu"
                aria-controls={settingsMenuId}
                aria-label={settingsOpen ? "Close settings menu" : "Open settings menu"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setSettingsOpen((o) => !o)}
              >
                <span className="sr-only">Settings and account</span>
                <GearIcon />
              </button>

              <div
                id={settingsMenuId}
                role="menu"
                className={`absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[15rem] origin-top-right rounded-xl border border-violet-500/20 bg-slate-950/95 p-1.5 shadow-xl shadow-black/40 backdrop-blur-xl transition-all duration-200 ${
                  settingsOpen
                    ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none -translate-y-1 scale-95 opacity-0"
                }`}
              >
                {settingsLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    className="block rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-slate-50"
                    onClick={() => setSettingsOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="my-1.5 border-t border-slate-700/80" role="separator" />
                <p
                  className="truncate px-3 py-2 text-xs text-slate-500"
                  title={userEmail}
                  role="menuitem"
                >
                  {userEmail}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  disabled={signingOut}
                  onClick={() => void signOut()}
                  className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-300 transition hover:bg-rose-500/15 hover:text-rose-200 disabled:opacity-60"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/50 bg-slate-900/60 text-slate-200 transition duration-200 hover:border-emerald-500/35 hover:bg-emerald-500/10 md:hidden"
              aria-expanded={mobileOpen}
              aria-controls={mobileDrawerId}
              onClick={() => setMobileOpen((o) => !o)}
            >
              <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[60] md:hidden transition-opacity duration-300 ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
        <aside
          id={mobileDrawerId}
          className={`absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-violet-500/20 bg-slate-950 shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-4">
            <span className="text-sm font-semibold text-slate-100">Navigation</span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-slate-100"
              onClick={() => setMobileOpen(false)}
            >
              <span className="sr-only">Close</span>
              <CloseIcon />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Workspace mobile">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/80">
              Workspace
            </p>
            <ul className="space-y-0.5">
              {primaryLinks.map((link) => (
                <li key={link.href}>
                  <NavLinkItem
                    link={link}
                    active={isLinkActive(pathname, link)}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </li>
              ))}
            </ul>

            <p className="mt-6 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/80">
              Settings
            </p>
            <ul className="space-y-0.5">
              {settingsLinks.map((link) => (
                <li key={link.href}>
                  <NavLinkItem
                    link={link}
                    active={isLinkActive(pathname, link)}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-slate-800/80 px-4 py-4">
            <p className="truncate text-xs text-slate-500" title={userEmail}>
              {userEmail}
            </p>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void signOut()}
              className="mt-3 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
