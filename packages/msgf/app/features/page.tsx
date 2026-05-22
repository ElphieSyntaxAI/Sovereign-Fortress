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

import { MarketingPillarList, MarketingSection } from "@/app/_components/marketing/MarketingSection";
import { MarketingShell } from "@/app/_components/marketing/MarketingShell";

export const metadata = {
  title: "Features | Elphie's Gated AI",
  description:
    "MSGF elite real-time governance — 6-pillar ingest, IDE Bug Button, and multi-file CONVERGE batch-fixing.",
};

const PILLARS = [
  {
    id: "P1",
    title: "Static Ledger",
    body: "Enforces hard codebase compliance laws; instantly drops a ruby-red HALT on critical syntax regressions.",
  },
  {
    id: "P2",
    title: "Flow Sequence",
    body: "Maps structural deployment priority and multi-file code dependencies.",
  },
  {
    id: "P3",
    title: "Entity Profiles",
    body: "Secures identities, tokens, and multi-tenant sandboxing boundaries.",
  },
  {
    id: "P4",
    title: "State Ledger",
    body: 'Active "Flight Recorder" tracking your live-memory typing rhythm dynamics (HAL).',
  },
  {
    id: "P5",
    title: "Local Variables",
    body: "Shards front-end module context to save token waste.",
  },
  {
    id: "P6",
    title: "Constraint Ledger",
    body: "Automatically captures local compilation histories and negative patterns.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell className="pricing-page">
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-12 sm:pt-16">
        <header className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Capabilities
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-gradient-jewel">Elite</span> real-time governance
            <span className="block text-slate-200">&amp; hotfix automation</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
            Glass-box AI that maps your active project to six isolated local ledger slices inside
            a hidden <code className="text-emerald-300/90">.msgf/</code> directory — eliminating
            lag and context noise.
          </p>
        </header>

        <div className="space-y-8">
          <MarketingSection
            eyebrow="Structural ingest"
            title="The 6-Pillar Structural Ingest Engine"
          >
            <p>
              MSGF maps your active development project to six isolated, ultra-performance local
              ledger slices inside a hidden <strong className="text-[#f8fafc]">.msgf/</strong>{" "}
              directory to eliminate system lag and context noise:
            </p>
            <MarketingPillarList items={PILLARS} />
          </MarketingSection>

          <MarketingSection
            eyebrow="IDE integration"
            title='The Native IDE "Bug Button"'
          >
            <p>
              Highlight broken architecture and press the <strong className="text-[#f8fafc]">Bug Button</strong>.
              The extension streams the P6 error ledger directly to our Cloud Run network, spinning
              up a silent <strong className="text-violet-200">Shadow Mode</strong> simulation to
              draft a fix without blocking your local compilation environment.
            </p>
          </MarketingSection>

          <MarketingSection
            eyebrow="Step 5 CONVERGE"
            title="Multi-File Batch-Fixing Protocol"
            variant="featured"
          >
            <p>
              Stop playing whack-a-mole with errors. MSGF executes a project-wide sweep, leveraging
              our Step 5 (<strong className="text-emerald-200">CONVERGE</strong>) cross-model
              consensus loop to push an elite arbitration check between{" "}
              <strong className="text-[#f8fafc]">Gemini</strong> and{" "}
              <strong className="text-[#f8fafc]">Claude</strong> — delivering a perfectly unified
              multi-file git patch.
            </p>
          </MarketingSection>
        </div>

        <div className="mt-14 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/getting-started"
            className="w-full rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-8 py-3.5 text-center text-sm font-semibold text-white shadow-xl shadow-violet-900/25 transition hover:brightness-110 sm:w-auto"
          >
            Quickstart runbook
          </Link>
          <Link
            href="/pricing"
            className="w-full rounded-full border border-violet-400/30 bg-violet-500/10 px-8 py-3.5 text-center text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 sm:w-auto"
          >
            View pricing
          </Link>
        </div>
      </main>
    </MarketingShell>
  );
}
