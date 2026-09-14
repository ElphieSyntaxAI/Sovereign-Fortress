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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import Link from "next/link";
import { Suspense } from "react";

import { MarketingShell } from "@/app/_components/marketing/MarketingShell";
import { PricingCheckoutNotice } from "@/app/_components/pricing/PricingCheckoutNotice";
import { PricingMatrix } from "@/app/_components/pricing/PricingMatrix";

export const metadata = {
  title: "Pricing | Elphie's Gated AI",
  description:
    "Clear pricing — BYOK free (Claude/Gemini/Grok), $99 perpetual Pro with managed TRI consensus, Startup Team at $49/user/mo with audit hub, Session Replay, budgets, and SIEM.",
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
            Indie builders stay free with BYOK (Claude / Gemini / Grok). Pro is a one-time{" "}
            <strong className="font-medium text-slate-300">$99</strong> perpetual license with a full
            year of managed cloud consensus (1,200 verification slices / month). Teams scale at{" "}
            <strong className="font-medium text-slate-300">$49 / user / mo</strong> with ARBITRATE,
            audit hub, Session Replay, tenant budgets, SIEM export, Sentry quarantine, and DocuSign /
            Dropbox Sign controls.
          </p>
        </header>

        <Suspense fallback={null}>
          <PricingCheckoutNotice />
        </Suspense>

        <PricingMatrix />

        <p className="mx-auto mt-14 max-w-2xl text-center text-xs leading-relaxed text-slate-500">
          Pricing SSOT: Individual Indie <strong className="text-slate-400">$0</strong> forever ·
          Individual Pro <strong className="text-slate-400">$99</strong> one-time (1,200 slices/mo
          Year 1) · Startup Team <strong className="text-slate-400">$49</strong> / user / mo via
          Stripe.{" "}
          <Link href="/sign-in" className="text-emerald-400/90 underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          for dashboard access.
        </p>
      </main>
    </MarketingShell>
  );
}
