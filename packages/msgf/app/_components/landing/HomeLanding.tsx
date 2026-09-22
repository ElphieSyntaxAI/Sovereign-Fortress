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

import { FeatureGrid } from "@/app/_components/marketing/FeatureGrid";
import {
  ENTERPRISE_FEATURE_CARDS,
  SHIPPED_FEATURE_CARDS,
} from "@/app/_components/marketing/shipped-capabilities";
import { ShadowSavingsHowTo } from "@/app/_components/marketing/ShadowSavingsHowTo";
import { WorkflowStrip } from "@/app/_components/marketing/WorkflowStrip";

import { PILLAR_CARD_FACE } from "@/lib/pillar-display";

import { AuthLandingNav } from "./AuthLandingNav";
import { PublicEcoMetricsWidget } from "./PublicEcoMetricsWidget";
import { PublicSiblingProductsSection } from "./PublicSiblingProductsSection";

const PILLARS = [
  {
    id: "P1",
    title: PILLAR_CARD_FACE.P1,
    body: "Immutable rules and security checks before a request reaches the model.",
    accent: "emerald" as const,
  },
  {
    id: "P2",
    title: PILLAR_CARD_FACE.P2,
    body: "Pipeline and execution order, including verify-before-ship.",
    accent: "purple" as const,
  },
  {
    id: "P3",
    title: PILLAR_CARD_FACE.P3,
    body: "Identity, roles, and tenant isolation.",
    accent: "emerald" as const,
  },
  {
    id: "P4",
    title: PILLAR_CARD_FACE.P4,
    body: "Runtime telemetry and active session memory.",
    accent: "purple" as const,
  },
  {
    id: "P5",
    title: PILLAR_CARD_FACE.P5,
    body: "Workspace context stays sharded so prompts do not carry unused files.",
    accent: "emerald" as const,
  },
  {
    id: "P6",
    title: PILLAR_CARD_FACE.P6,
    body: "Vault is verified state memory. Hall stores rejected outcomes.",
    accent: "purple" as const,
  },
];

const GATEWAY_COMPARISON = [
  {
    ungoverned: "Calls go straight to the model",
    msgf: "AI gateway in front of the provider",
  },
  {
    ungoverned: "Unbounded prompt context",
    msgf: "Policy checks before spend",
  },
  {
    ungoverned: "No record of what worked or failed",
    msgf: "Vault (verified state memory) vs Hall",
  },
  {
    ungoverned: "One model for every request",
    msgf: "Small Brain local routing vs Big Brain consensus",
  },
  {
    ungoverned: "No source provenance",
    msgf: "Source reputation and quarantine",
  },
] as const;

function accentRing(accent: "emerald" | "purple") {
  return accent === "emerald"
    ? "border-emerald-500/25 group-hover:border-emerald-400/50"
    : "border-violet-500/25 group-hover:border-violet-400/50";
}

export function HomeLanding() {
  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:pt-20">
          <div className="glass-panel glass-panel-emerald mx-auto max-w-4xl rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
              MSGF · AI gateway
            </p>
            <h1 className="mt-4 text-center text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-gradient-jewel">The layer between you</span>
              <span className="text-slate-100"> and the model</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-slate-400 sm:text-lg">
              MSGF is an AI gateway. It inspects and organizes context so low-quality data does not
              poison the next prompt.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/shadow-trial"
                className="w-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-violet-600 px-8 py-3.5 text-center text-sm font-semibold text-white shadow-xl shadow-emerald-900/25 transition hover:brightness-110 sm:w-auto"
              >
                Start 7-day shadow-mode trial
              </Link>
              <Link
                href="/features"
                className="w-full rounded-full border border-violet-400/30 bg-violet-500/10 px-8 py-3.5 text-center text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 sm:w-auto"
              >
                How it works
              </Link>
            </div>
            <p className="mt-4 text-center text-sm text-slate-500">
              Console seats are waitlist-only.{" "}
              <Link href="/sign-up" className="text-emerald-400/90 underline-offset-4 hover:underline">
                Join the beta waitlist
              </Link>
            </p>
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
                Ungoverned LLM stack
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-400 line-through decoration-slate-600">
                Direct to the model.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Prompts hit the provider first. You pay for every call — no policy check, no context
                pruning, no record when something fails.
              </p>
            </article>
            <article className="glass-panel glass-panel-emerald rounded-2xl p-6 sm:p-8 ring-1 ring-emerald-500/20">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                AI gateway
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">
                Policy and routing before spend.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                MSGF runs policy checks, Vault and Hall, and Small Brain or Big Brain routing before
                tokens are billed — so security and engineering share the same audit trail.
              </p>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/85">
              Comparison
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Ungoverned stack <span className="text-slate-500">vs</span>{" "}
              <span className="text-gradient-jewel">MSGF</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
              Policy, routing, memory, and provenance — the jobs every AI gateway is expected to do.
            </p>
          </div>
          <div className="glass-panel mt-8 overflow-hidden rounded-2xl border border-violet-500/15">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 border-b border-slate-800/80 bg-slate-950/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:px-6">
              <span>Without a gateway</span>
              <span className="text-center text-slate-700" aria-hidden>
                →
              </span>
              <span className="text-emerald-400/80">MSGF</span>
            </div>
            <ul className="divide-y divide-slate-800/70" role="list">
              {GATEWAY_COMPARISON.map((row) => (
                <li
                  key={row.ungoverned}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 px-5 py-4 text-sm sm:px-6"
                >
                  <span className="text-slate-400">{row.ungoverned}</span>
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
              Shipped for <span className="text-gradient-jewel">production</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
              These capabilities run in production Cloud Run and Pulse Guard (IDE dev-environment protection) today.
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
            Six policy domains. <span className="text-emerald-400">One</span>{" "}
            <span className="text-violet-400">gateway.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-slate-400">
            Isolated context partitions so prompts never mix projects.{" "}
            <Link
              href="/getting-started#six-pillars"
              className="text-emerald-400/90 underline-offset-4 hover:underline"
            >
              Full policy-domain guide
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
                <h3 className="font-semibold text-slate-100">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <PublicSiblingProductsSection />

        <section className="border-t border-violet-500/10 bg-slate-950/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Put a gateway in front of your models
            </h2>
            <p className="max-w-md text-sm text-slate-400">
              Map a repo, install the Pulse Guard IDE extension, and open the dashboard for live
              token-cost visibility.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/shadow-trial"
                className="rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-10 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110"
              >
                Start 7-day shadow-mode trial
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
