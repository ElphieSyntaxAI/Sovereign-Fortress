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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import Link from "next/link";
import { Suspense } from "react";

import { MarketingShell } from "@/app/_components/marketing/MarketingShell";
import { PricingCheckoutNotice } from "@/app/_components/pricing/PricingCheckoutNotice";
import { PricingMatrix } from "@/app/_components/pricing/PricingMatrix";

export const metadata = {
  title: "Pricing | MSGF",
  description:
    "Hosted AI gateway: BYOK $0, Pro $29/mo or $290/yr, Startup $49/workspace/mo or $490/yr, Enterprise $199/workspace/mo or $1,990/yr. Redis and Supabase included.",
};

export default function PricingPage() {
  return (
    <MarketingShell className="pricing-page">
      <main className="mx-auto max-w-7xl px-5 pb-16 pt-12 sm:pt-16">
        <header className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Plans
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Clear pricing.
            <span className="block text-gradient-jewel">Hosted from day one.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
            BYOK includes our Redis and Supabase — you only bring model keys. Startup and
            Enterprise bill monthly or yearly. Yearly is 10 months for the price of 12.
          </p>
        </header>

        <Suspense fallback={null}>
          <PricingCheckoutNotice />
        </Suspense>

        <PricingMatrix />

        <section className="mx-auto mt-14 max-w-2xl rounded-2xl border border-slate-800/80 bg-slate-950/40 px-6 py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Self-host
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Running your own Redis and Supabase remains an integrator option — not a storefront
            tier. Extra Startup seats beyond five people are{" "}
            <Link href="/sign-up" className="font-medium text-emerald-400/90 underline-offset-4 hover:underline">
              quoted on the waitlist
            </Link>
            .
          </p>
        </section>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-slate-500">
          Pricing SSOT: BYOK <strong className="text-slate-400">$0</strong> · Pro{" "}
          <strong className="text-slate-400">$29</strong> / mo or{" "}
          <strong className="text-slate-400">$290</strong> / yr · Startup{" "}
          <strong className="text-slate-400">$49</strong> / workspace / mo or{" "}
          <strong className="text-slate-400">$490</strong> / yr · Enterprise{" "}
          <strong className="text-slate-400">$199</strong> / workspace / mo or{" "}
          <strong className="text-slate-400">$1,990</strong> / yr.{" "}
          <Link href="/sign-in" className="text-emerald-400/90 underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          for dashboard access.
        </p>
      </main>
    </MarketingShell>
  );
}
