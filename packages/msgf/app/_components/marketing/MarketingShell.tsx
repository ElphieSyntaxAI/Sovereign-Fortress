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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";

type Props = {
  children: ReactNode;
  className?: string;
};

export function MarketingShell({ children, className = "" }: Props) {
  return (
    <div className={`landing-mesh min-h-screen text-slate-100 ${className}`}>
      <AuthLandingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}


export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
      <p>© {new Date().getFullYear()} Elphie Syntax LLC. All rights reserved.</p>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Link href="/" className="text-violet-400/90 underline-offset-4 hover:underline">
          Home
        </Link>
        <span className="text-slate-700">·</span>
        <Link href="/features" className="text-emerald-400/90 underline-offset-4 hover:underline">
          Features
        </Link>
        <span className="text-slate-700">·</span>
        <Link
          href="/getting-started"
          className="text-violet-400/90 underline-offset-4 hover:underline"
        >
          Getting started
        </Link>
        <span className="text-slate-700">·</span>
        <Link href="/pricing" className="text-emerald-400/90 underline-offset-4 hover:underline">
          Pricing
        </Link>
        <span className="text-slate-700">·</span>
        <Link href="/status" className="text-violet-400/90 underline-offset-4 hover:underline">
          Status
        </Link>
      </p>
    </footer>
  );
}
