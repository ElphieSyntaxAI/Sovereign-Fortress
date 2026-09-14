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

import { FeatureGrid } from "@/app/_components/marketing/FeatureGrid";
import {
  ENTERPRISE_FEATURE_CARDS,
  SHIPPED_FEATURE_CARDS,
} from "@/app/_components/marketing/shipped-capabilities";
import { ShadowSavingsHowTo } from "@/app/_components/marketing/ShadowSavingsHowTo";
import { WorkflowStrip } from "@/app/_components/marketing/WorkflowStrip";

import { AuthLandingNav } from "./AuthLandingNav";
import { PublicEcoMetricsWidget } from "./PublicEcoMetricsWidget";
import { PublicSiblingProductsSection } from "./PublicSiblingProductsSection";

const PILLARS = [
  {
    id: "P1",
    title: "Human Authorship Ledger",
    body: "Rhythm telemetry and HAL signals — how input arrived, sealed for every gated interaction.",
    accent: "emerald" as const,
  },
  {
    id: "P2",
    title: "Flow & Consensus",
    body: "Ordered gates: ingest, verify, dual or TRI-majority arbitrate, persist — no step-skipping.",
    accent: "purple" as const,
  },
  {
    id: "P3",
    title: "Entity Profiles",
    body: "Tenant roles, entitlements, and credit metering tied to sovereign identity.",
    accent: "emerald" as const,
  },
  {
    id: "P4",
    title: "State Ledger",
    body: "Hot-layer beats and revision locks — nanosecond validation before AI acts.",
    accent: "purple" as const,
  },
  {
    id: "P5",
    title: "Narrative Audit",
    body: "Forensic bundles and audit lines you can read, not hidden model chatter.",
    accent: "emerald" as const,
  },
  {
    id: "P6",
    title: "Vault & Hall",
    body: "Proven fixes in the Vault; failed logic in the Hall — lineage you can inspect.",
    accent: "purple" as const,
  },
];

const BRAIN_COMPARISON = [
  {
    human: "Prefrontal cortex",
    msgf: "DEFEND / GATE",
  },
  {
    human: "Working memory",
    msgf: "Hot SHARD / State Ledger",
  },
  {
    human: "Long-term learning",
    msgf: "Vault + Hall",
  },
  {
    human: "Habit vs deliberation",
    msgf: "Small Brain vs Big Brain",
  },
  {
    human: "Error memory",
    msgf: "Source reputation (P7) + quarantine",
  },
] as const;

function accentRing(accent: "emerald" | "purple") {
  return accent === "emerald"
    ? "border-emerald-500/25 group-hover:border-emerald-400/50"
    : "border-violet-500/25 group-hover:border-violet-400/50";
}

function accentBadge(accent: "emerald" | "purple") {
  return accent === "emerald"
    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
    : "bg-violet-500/15 text-violet-200 ring-violet-500/30";
}

export function HomeLanding() {
  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:pt-20">
          <div className="glass-panel glass-panel-emerald mx-auto max-w-4xl rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
              MSGF V3.2 · Gated AI
            </p>
            <h1 className="mt-4 text-center text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-gradient-jewel">Prefrontal cortex</span>
              <span className="text-slate-100"> for AI</span>
              <br className="hidden sm:block" />
              <span className="text-slate-300">from IDE to cloud.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-slate-400 sm:text-lg">
              Six pillars, Grok-aware model presets, TRI majority CONVERGE when drift demands it,
              Sentry→Vault quarantine, DocuSign / Dropbox Sign team gates, and{" "}
              <strong className="font-medium text-slate-200">quantum-ready</strong> hybrid envelopes
              for vault secrets — plus a native{" "}
              <strong className="font-medium text-slate-200">Command Center</strong> that optimizes
              prompts locally and feeds a defensible token savings dashboard.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/shadow-trial"
                className="w-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-violet-600 px-8 py-3.5 text-center text-sm font-semibold text-white shadow-xl shadow-emerald-900/25 transition hover:brightness-110 sm:w-auto"
              >
                Try free 7-day Shadow Proxy
              </Link>
              <Link
                href="/sign-up"
                className="w-full rounded-full border border-emerald-400/30 bg-emerald-500/10 px-8 py-3.5 text-center text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 sm:w-auto"
              >
                Join beta
              </Link>
              <Link
                href="/getting-started"
                className="w-full rounded-full border border-emerald-400/30 bg-emerald-500/10 px-8 py-3.5 text-center text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 sm:w-auto"
              >
                Install the extension
              </Link>
              <Link
                href="/features"
                className="w-full rounded-full border border-violet-400/30 bg-violet-500/10 px-8 py-3.5 text-center text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 sm:w-auto"
              >
                See what ships
              </Link>
              <Link
                href="/roadmap"
                className="w-full rounded-full border border-slate-600/50 bg-slate-900/40 px-8 py-3.5 text-center text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/50 sm:w-auto"
              >
                Explore full roadmap
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/85">
              Developer loop
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              Connect → optimize → verify → measure
            </h2>
          </div>
          <div className="mt-8">
            <WorkflowStrip />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8">
          <PublicEcoMetricsWidget />
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="glass-panel rounded-2xl p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Opaque LLM stack
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-400 line-through decoration-slate-600">
                No gate before spend.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Prompts hit the model first. You pay for every call — no DEFEND check, no state
                prune, no lineage when something fails.
              </p>
            </article>
            <article className="glass-panel glass-panel-emerald rounded-2xl p-6 sm:p-8 ring-1 ring-emerald-500/20">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Prefrontal cortex for AI
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">
                DEFEND / GATE before model spend.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                MSGF runs pillar checks, Vault/Hall memory, and consensus before tokens burn — so
                compliance and engineering share the same truth.
              </p>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/85">
              Analogy
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Human brain <span className="text-slate-500">vs</span>{" "}
              <span className="text-gradient-jewel">MSGF</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
              The same control loops biology uses — mapped onto gated AI infrastructure.
            </p>
          </div>
          <div className="glass-panel mt-8 overflow-hidden rounded-2xl border border-violet-500/15">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 border-b border-slate-800/80 bg-slate-950/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-6">
              <span>Human brain</span>
              <span className="text-center text-slate-700" aria-hidden>
                →
              </span>
              <span className="text-emerald-400/80">MSGF</span>
            </div>
            <ul className="divide-y divide-slate-800/70" role="list">
              {BRAIN_COMPARISON.map((row) => (
                <li
                  key={row.human}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 px-5 py-4 text-sm sm:px-6"
                >
                  <span className="text-slate-400">{row.human}</span>
                  <span className="text-slate-700" aria-hidden>
                    →
                  </span>
                  <span className="font-medium text-slate-100">{row.msgf}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8">
          <ShadowSavingsHowTo />
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Shipped for <span className="text-gradient-jewel">production dev</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
              Not a roadmap slide — these capabilities run in Cloud Run and the Pulse Guard
              extension today.
            </p>
          </div>
          <div className="mt-10">
            <FeatureGrid items={SHIPPED_FEATURE_CARDS} />
          </div>
          <p className="mx-auto mt-12 max-w-xl text-center text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/85">
            Platform &amp; enterprise
          </p>
          <div className="mt-6">
            <FeatureGrid items={ENTERPRISE_FEATURE_CARDS} />
          </div>
        </section>

        <section id="six-pillars" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-20">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Six pillars. <span className="text-emerald-400">One</span>{" "}
            <span className="text-violet-400">framework.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-slate-400">
            MSGF V3.2 — modular state gates that never mix contexts.{" "}
            <Link
              href="/getting-started#six-pillars"
              className="text-emerald-400/90 underline-offset-4 hover:underline"
            >
              Full pillar guide
            </Link>
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <Link
                key={p.id}
                id={`pillar-${p.id}`}
                href={`/getting-started#pillar-${p.id}`}
                className={`glass-panel group scroll-mt-24 rounded-2xl border p-5 transition ${accentRing(p.accent)}`}
              >
                <span
                  className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-bold ring-1 ${accentBadge(p.accent)}`}
                >
                  {p.id}
                </span>
                <h3 className="mt-3 font-semibold text-slate-100">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <PublicSiblingProductsSection />

        <section className="border-t border-violet-500/10 bg-slate-950/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to gate your AI?
            </h2>
            <p className="max-w-md text-sm text-slate-400">
              Map a repo, install Pulse Guard, and open your governance dashboard with live token
              savings.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/shadow-trial"
                className="rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-10 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110"
              >
                Try free 7-day Shadow Proxy
              </Link>
              <Link
                href="/sign-in?next=/dashboard"
                className="rounded-full border border-slate-600/50 px-10 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Sign in to dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Elphie Syntax LLC. All rights reserved.</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Link href="/features" className="text-emerald-400/90 underline-offset-4 hover:underline">
            Features
          </Link>
          <span className="text-slate-700">·</span>
          <Link href="/pricing" className="text-violet-400/90 underline-offset-4 hover:underline">
            Pricing
          </Link>
          <span className="text-slate-700">·</span>
          <Link href="/status" className="text-violet-400/90 underline-offset-4 hover:underline">
            System status
          </Link>
          <span className="text-slate-700">·</span>
          <Link href="/getting-started" className="text-emerald-400/90 underline-offset-4 hover:underline">
            Getting started
          </Link>
        </p>
      </footer>
    </div>
  );
}
