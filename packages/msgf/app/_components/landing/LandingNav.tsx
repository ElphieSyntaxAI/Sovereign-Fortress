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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
import Link from "next/link";

import { BrandLogo } from "@/app/_components/brand/BrandLogo";
import { SignOutButton } from "@/app/_components/auth/SignOutButton";

type Props = {
  /** When set, show authenticated nav (stay signed in while browsing marketing pages). */
  userEmail?: string | null;
};

export function LandingNav({ userEmail = null }: Props) {
  const signedIn = Boolean(userEmail?.trim());

  return (
    <header className="sticky top-0 z-50 border-b border-violet-500/10 bg-slate-950/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href={signedIn ? "/dashboard" : "/"} className="group flex items-center gap-2.5">
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
              <Link
                href="/dashboard"
                className="rounded-full px-2.5 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-100"
              >
                Dashboard
              </Link>
              <Link
                href="/other-products"
                className="hidden rounded-full px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-block"
              >
                Other products
              </Link>
              <Link
                href="/getting-started#six-pillars"
                className="hidden rounded-full px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white lg:inline-block"
              >
                Pillar guide
              </Link>
              <Link
                href="/workspace"
                className="hidden rounded-full px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-block"
              >
                Workspace
              </Link>
              <Link
                href="/pricing"
                className="hidden rounded-full px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-block"
              >
                Pricing
              </Link>
              <span
                className="hidden max-w-[10rem] truncate text-sm text-slate-500 lg:inline"
                title={userEmail ?? undefined}
              >
                {userEmail}
              </span>
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
                href="/sign-up"
                className="rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:from-emerald-500 hover:to-violet-500"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
