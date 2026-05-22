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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
import Link from "next/link";
import { Suspense } from "react";

import { MarketingShell } from "@/app/_components/marketing/MarketingShell";
import { PricingCheckoutNotice } from "@/app/_components/pricing/PricingCheckoutNotice";
import { PricingMatrix } from "@/app/_components/pricing/PricingMatrix";

export const metadata = {
  title: "Pricing | Elphie's Gated AI",
  description:
    "Clear pricing with zero subscription fatigue — BYOK free, $99 perpetual Pro, Startup team per seat.",
};

export default function PricingPage() {
  return (
    <MarketingShell className="pricing-page">
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:pt-16">
        <header className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Plans
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Clear pricing.
            <span className="block text-gradient-jewel">Zero subscription fatigue.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
            Indie builders stay free with BYOK. Pro is a one-time perpetual license with a full
            year of managed cloud consensus. Teams scale per seat with corporate controls.
          </p>
        </header>

        <Suspense fallback={null}>
          <PricingCheckoutNotice />
        </Suspense>

        <PricingMatrix />

        <p className="mx-auto mt-14 max-w-2xl text-center text-xs leading-relaxed text-slate-500">
          Individual Pro includes 1,200 monthly verification slices during Year 1 managed cloud
          maintenance. Startup Team bills per user via Stripe at checkout.{" "}
          <Link href="/sign-in" className="text-emerald-400/90 underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          for dashboard access.
        </p>
      </main>
    </MarketingShell>
  );
}
