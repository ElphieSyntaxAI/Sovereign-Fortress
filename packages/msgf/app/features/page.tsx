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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import Link from "next/link";

import { FeatureGrid } from "@/app/_components/marketing/FeatureGrid";
import { MarketingPillarList, MarketingSection } from "@/app/_components/marketing/MarketingSection";
import { MarketingShell } from "@/app/_components/marketing/MarketingShell";
import {
  ENTERPRISE_FEATURE_CARDS,
  SHIPPED_FEATURE_CARDS,
} from "@/app/_components/marketing/shipped-capabilities";
import { WorkflowStrip } from "@/app/_components/marketing/WorkflowStrip";

export const metadata = {
  title: "Features | MSGF",
  description:
    "MSGF AI gateway — IDE extension, model routing and consensus, audit console, Session Replay, SIEM, Sentry quarantine, Workspace SSO, and defensible token-cost reporting.",
};

const PILLARS = [
  {
    id: "P1",
    title: "Policy & compliance",
    body: "Blocking rules for unsafe or out-of-policy changes before they reach the model.",
  },
  {
    id: "P2",
    title: "Change flow",
    body: "Deployment order and multi-file dependencies.",
  },
  {
    id: "P3",
    title: "Identity & tenancy",
    body: "Roles, tokens, and tenant isolation.",
  },
  {
    id: "P4",
    title: "Session state",
    body: "Live session telemetry before the model acts.",
  },
  {
    id: "P5",
    title: "Local context",
    body: "Sharded module context so prompts do not carry unused files.",
  },
  {
    id: "P6",
    title: "Approved vs rejected memory",
    body: "Vault stores approved outcomes; Hall stores failed outcomes — inspectable lineage.",
  },
];

const IDE_FEATURES = [
  {
    title: "Local prompt compiler",
    body: "Describe the task once. MSGF builds a sharded, attachment-ready prompt with required verify steps — locally, with no server-side model call.",
  },
  {
    title: "Verify scripts",
    body: "Allowlisted verify commands in .msgf/run-scripts.json. Re-run tests without regenerating the prompt. Counters appear on the token-cost dashboard.",
  },
  {
    title: "Safe Build",
    body: "One-click local build/test with async preflight. Pass syncs to verify-result; fail triggers low-cost remediation — not a blind incident dump.",
  },
  {
    title: "IDE extension panel",
    body: "Connection status, prompt compiler, verify scripts, Safe Build, and advanced Pulse / remediation tools in one Cursor or VS Code panel.",
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
            <span className="text-gradient-jewel">AI</span> governance
            <span className="block text-slate-200">&amp; verify without re-prompting</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
            Control plane for model traffic: six isolated context domains, IDE verify loops,{" "}
            <strong className="text-cyan-300/90">optional Grok in routing presets</strong>,{" "}
            <strong className="text-emerald-200">signed human-in-the-loop review</strong> with Session Replay and
            SIEM export,{" "}
            <strong className="text-violet-300/90">Sentry → Vault quarantine</strong>,{" "}
            <strong className="text-emerald-200">Workspace SSO</strong>, and{" "}
            <strong className="text-amber-200">optional post-quantum</strong> Vault envelopes —
            unconfigured integrations degrade; they do not break the rest of the product.
          </p>
        </header>

        <div className="mb-12">
          <WorkflowStrip />
        </div>

        <div className="mb-12">
          <FeatureGrid items={SHIPPED_FEATURE_CARDS} />
        </div>

        <div className="mb-12">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/85">
            Platform &amp; enterprise
          </p>
          <FeatureGrid items={ENTERPRISE_FEATURE_CARDS} />
        </div>

        <div className="space-y-8">
          <MarketingSection
            eyebrow="Context partitions"
            title="Six isolated policy domains"
          >
            <p>
              MSGF maps the active project into six isolated local slices inside a hidden{" "}
              <strong className="text-[#f8fafc]">.msgf/</strong> directory so prompts do not mix
              contexts:
            </p>
            <MarketingPillarList items={PILLARS} />
          </MarketingSection>

          <MarketingSection
            eyebrow="IDE extension"
            title="MSGF Pulse Guard for Cursor & VS Code"
            variant="featured"
          >
            <p className="mb-6">
              The native extension ships an <strong className="text-emerald-200">IDE panel</strong>:
              connect once, compile targeted prompts, run allowlisted verify scripts, and sync
              outcomes to your{" "}
              <Link href="/dashboard#token-savings" className="text-cyan-300 hover:underline">
                token-cost
              </Link>{" "}
              dashboard — including routing presets (Claude / Gemini / Grok pairs).
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

          <MarketingSection eyebrow="Verify loop" title="Approved on pass · rejected on repeat failure">
            <p>
              When verify passes with a linked context pack, MSGF writes a positive record to the{" "}
              <strong className="text-emerald-200">Vault</strong> (approved-context store). Repeated
              failures on the same command pattern dedupe into the{" "}
              <strong className="text-amber-200">Hall</strong> (rejected-outcome store) after three
              strikes. Safe execution uses{" "}
              <code className="text-violet-300/90">execFile</code> with an allowlisted command set
              (no shell injection from tampered script files).
            </p>
          </MarketingSection>

          <MarketingSection eyebrow="Routing" title="Cost-efficient pair · frontier consensus on drift">
            <p>
              Tenant verification defaults to <strong className="text-slate-100">Claude + Gemini</strong>{" "}
              (unanimous). Compliance paths can switch to{" "}
              <strong className="text-slate-100">Claude + Grok</strong> or{" "}
              <strong className="text-slate-100">Gemini + Grok</strong>. When logic drift is high,
              frontier routing can run a <strong className="text-violet-200">three-model majority</strong>{" "}
              (Claude + Gemini + Grok) and only opens human notification on high original drift, no
              majority, or a security non-human signal. Prompt compile stays local.
            </p>
          </MarketingSection>

          <MarketingSection
            eyebrow="Security"
            title="Optional post-quantum Vault envelopes"
          >
            <p>
              Long-lived secrets can use <strong className="text-slate-100">hybrid KEM envelopes</strong>{" "}
              (X25519 + ML-KEM-768) and authorship proofs can use{" "}
              <strong className="text-slate-100">ML-DSA-65</strong> certificates when enabled.
              Transport still relies on platform TLS; we do not claim HTTPS is post-quantum until
              your load balancer negotiates a PQ key exchange.
            </p>
          </MarketingSection>

          <MarketingSection
            eyebrow="Integrations"
            title="Sentry, Workspace SSO, and SIEM"
          >
            <p>
              <strong className="text-slate-100">Sentry</strong> issues match approved Vault records
              and quarantine poisoned context on <code className="text-violet-300/90">/admin/ops</code>.{" "}
              <strong className="text-slate-100">Google Workspace SSO</strong> and company domains
              gate corporate seats.{" "}
              <strong className="text-slate-100">SIEM</strong> is an OpenTelemetry JSON webhook to
              your sink — not a Splunk marketplace app. Unconfigured panels show as unconfigured.
            </p>
          </MarketingSection>

          <MarketingSection eyebrow="Token cost" title="Defensible spend on the dashboard">
            <p>
              After you map a project and run the IDE loop, your{" "}
              <Link href="/dashboard#token-savings" className="text-amber-300 hover:underline">
                governance dashboard
              </Link>{" "}
              shows grouped counters: IDE verify (pass/fail/Vault/Hall), script reruns, local
              prompt packs, ingest hash skips, and routing mix. A 24-hour rollup separates MSGF
              cloud tokens from context savings you can defend to finance.
            </p>
          </MarketingSection>

          <MarketingSection eyebrow="Remediation" title="IDE build failures without a full Pulse">
            <p>
              <strong className="text-[#f8fafc]">dev-event</strong> handles IDE build failures with a
              Vault lexical match or a single low-cost model call — not the full telemetry and
              consensus chain. Traffic stays on the cost-efficient path unless drift truly
              escalates.
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
