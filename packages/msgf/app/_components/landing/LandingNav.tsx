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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import Link from "next/link";

import { BrandLogo } from "@/app/_components/brand/BrandLogo";
import { SignOutButton } from "@/app/_components/auth/SignOutButton";
import { SIGNED_IN_MARKETING_PRIMARY_LINKS } from "@/app/_components/dashboard/dashboard-nav-links";

type Props = {
  /** When set, show authenticated nav (stay signed in while browsing marketing pages). */
  userEmail?: string | null;
};

export function LandingNav({ userEmail = null }: Props) {
  const signedIn = Boolean(userEmail?.trim());

  return (
    <header className="sticky top-0 z-50 border-b border-violet-500/10 bg-slate-950/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <BrandLogo
            size={36}
            decorative
            priority
            className="border border-emerald-400/30 bg-emerald-500/10"
          />
          <span className="text-sm font-semibold tracking-tight text-slate-100 group-hover:text-emerald-200">
            Elphie Syntax
          </span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2" aria-label="Site">
          {signedIn ? (
            <>
              {SIGNED_IN_MARKETING_PRIMARY_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hidden rounded-full px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-block"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/brain"
                className="hidden rounded-full px-2.5 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white md:inline-block"
              >
                MSGF
              </Link>
              <span
                className="hidden max-w-[10rem] truncate text-sm text-slate-500 lg:inline"
                title={userEmail ?? undefined}
              >
                {userEmail}
              </span>
              <Link
                href="/dashboard"
                className="rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:from-emerald-500 hover:to-violet-500"
              >
                Open dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/features"
                className="hidden rounded-full px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white md:inline-block"
              >
                Features
              </Link>
              <Link
                href="/getting-started"
                className="hidden rounded-full px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white lg:inline-block"
              >
                Start
              </Link>
              <Link
                href="/pricing"
                className="hidden rounded-full px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-block"
              >
                Pricing
              </Link>
              <Link
                href="/sign-in"
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/admin/sign-in"
                className="hidden rounded-full px-3 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10 hover:text-violet-100 sm:inline-block"
              >
                Admin
              </Link>
              <Link
                href="/shadow-trial"
                className="rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:from-emerald-500 hover:to-violet-500"
              >
                Free 7-day trial
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
