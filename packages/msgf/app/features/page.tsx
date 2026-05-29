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

import { FeatureGrid } from "@/app/_components/marketing/FeatureGrid";
import { MarketingPillarList, MarketingSection } from "@/app/_components/marketing/MarketingSection";
import { MarketingShell } from "@/app/_components/marketing/MarketingShell";
import { SHIPPED_FEATURE_CARDS } from "@/app/_components/marketing/shipped-capabilities";
import { WorkflowStrip } from "@/app/_components/marketing/WorkflowStrip";

export const metadata = {
  title: "Features | Elphie's Gated AI",
  description:
    "MSGF V3.2 — six-pillar ingest, IDE Command Center, 0-token prompt optimizer, Run Scripts, Safe Build, Vault/Hall verify loop, and token savings dashboard.",
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
    body: "The Vault (what worked) and the Hall (what failed) — differential learning for every fix.",
  },
];

const IDE_FEATURES = [
  {
    title: "0-Token Prompt Optimizer",
    body: "Describe your task once. MSGF builds a sharded, @-attachment-ready prompt with mandatory agent verify rules — no server-side LLM burn.",
  },
  {
    title: "Run Scripts",
    body: "Auto-registered verify commands in .msgf/run-scripts.json. Re-run tests without regenerating the prompt. Counters show up on your token savings dashboard.",
  },
  {
    title: "Safe Build",
    body: "One-click local build/test. Pass syncs to verify-result; fail triggers Heal Cheap via dev-event — not a blind incident dump.",
  },
  {
    title: "Command Center sidebar",
    body: "Connection status, optimizer, Run Scripts, Safe Build, and advanced Pulse/heal ops in one Cursor/VS Code panel.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell className="pricing-page">
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-12 sm:pt-16">
        <header className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Capabilities · shipped
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-gradient-jewel">Elite</span> governance
            <span className="block text-slate-200">&amp; zero re-prompt verify</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
            Glass-box AI that maps your project to six isolated ledger slices in{" "}
            <code className="text-emerald-300/90">.msgf/</code>, routes routine work on{" "}
            <strong className="text-cyan-300/90">Small Brain</strong>, and escalates to dual-model{" "}
            <strong className="text-violet-300/90">CONVERGE</strong> only when logic drift demands it.
          </p>
        </header>

        <div className="mb-12">
          <WorkflowStrip />
        </div>

        <div className="mb-12">
          <FeatureGrid items={SHIPPED_FEATURE_CARDS} />
        </div>

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
            eyebrow="IDE — Command Center"
            title="MSGF Pulse Guard for Cursor & VS Code"
            variant="featured"
          >
            <p className="mb-6">
              The native extension ships a <strong className="text-emerald-200">Command Center</strong>{" "}
              sidebar: connect once, generate targeted prompts, run allowlisted verify scripts, and
              sync outcomes to your{" "}
              <Link href="/dashboard#token-savings" className="text-cyan-300 hover:underline">
                token savings
              </Link>{" "}
              dashboard.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {IDE_FEATURES.map((f) => (
                <li
                  key={f.title}
                  className="rounded-xl border border-emerald-500/20 bg-slate-950/60 p-4"
                >
                  <p className="font-semibold text-slate-100">{f.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{f.body}</p>
                </li>
              ))}
            </ul>
          </MarketingSection>

          <MarketingSection eyebrow="Verify loop" title="Vault on pass · Hall on repeat failure">
            <p>
              When verify passes with a linked context pack, MSGF writes a positive beat to the{" "}
              <strong className="text-emerald-200">Vault</strong>. Repeated failures on the same
              command pattern dedupe into the <strong className="text-amber-200">Hall</strong> after
              three strikes — so you get signal without noise. Safe execution uses{" "}
              <code className="text-violet-300/90">execFile</code> with an allowlisted command set
              (no shell injection from tampered script files).
            </p>
          </MarketingSection>

          <MarketingSection eyebrow="Token savings" title="Defensible ROI on your dashboard">
            <p>
              After you map a project and run the IDE loop, your{" "}
              <Link href="/dashboard#token-savings" className="text-amber-300 hover:underline">
                governance dashboard
              </Link>{" "}
              shows grouped counters: IDE verify (pass/fail/Vault/Hall), Run Script reruns, 0-token
              optimizer packs, ingest hash skips, and pulse routing mix. A 24h rollup separates MSGF
              cloud tokens from context savings you can defend to finance.
            </p>
          </MarketingSection>

          <MarketingSection eyebrow="Step 5 CONVERGE" title="Multi-File Batch-Fixing Protocol">
            <p>
              Stop playing whack-a-mole with errors. MSGF executes a project-wide sweep, leveraging
              Step 5 (<strong className="text-emerald-200">CONVERGE</strong>) cross-model consensus
              between <strong className="text-[#f8fafc]">Gemini</strong> and{" "}
              <strong className="text-[#f8fafc]">Claude</strong> — with Redis replay when the same
              content hash hits again.
            </p>
          </MarketingSection>

          <MarketingSection eyebrow="Heal Cheap" title="IDE build failures without full Pulse">
            <p>
              <strong className="text-[#f8fafc]">dev-event</strong> handles IDE build failures:
              tenant Vault lexical match or a single Flash heal — never the full biometric Pulse →
              CONVERGE chain. Your keystrokes stay on Small Brain unless drift truly escalates.
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
            href="/workspace"
            className="w-full rounded-full border border-emerald-400/30 bg-emerald-500/10 px-8 py-3.5 text-center text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 sm:w-auto"
          >
            Workspace setup
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
