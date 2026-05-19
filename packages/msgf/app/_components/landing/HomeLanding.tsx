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
 * Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
 */
import Link from "next/link";

import { LandingNav } from "./LandingNav";

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
    body: "Ordered gates: ingest, verify, dual-model arbitrate, persist — no step-skipping.",
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

const FEATURES = [
  {
    title: "Pulse engine",
    description:
      "Real-time state gates on every interaction. MSGF blocks, verifies, and records before your stack commits.",
  },
  {
    title: "Dual-model consensus",
    description:
      "Claude and Gemini arbitrate under your rules. Disagreements escalate to human-in-the-loop — never silent drift.",
  },
  {
    title: "Tenant silos",
    description:
      "Every vector, incident, and rule scoped to your tenant. Sovereign audit trails built for regulated teams.",
  },
  {
    title: "Self-heal with receipts",
    description:
      "Remediation loops that cite Vault lineage — fixes you can promote, reject, or send back to the Hall.",
  },
];

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
      <LandingNav />

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:pt-20">
          <div className="glass-panel glass-panel-emerald mx-auto max-w-4xl rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
              Welcome to Elphie&apos;s Gated AI
            </p>
            <h1 className="mt-4 text-center text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-gradient-jewel">Glass box</span>
              <span className="text-slate-100"> sovereignty,</span>
              <br className="hidden sm:block" />
              <span className="text-slate-300">not black-box AI.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-slate-400 sm:text-lg">
              The Modular State-Gate Framework (MSGF) governs every model call with six pillars, dual consensus, and
              auditable lineage — so you see the gates, the verdict, and the proof.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/sign-up"
                className="w-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-violet-600 px-8 py-3.5 text-center text-sm font-semibold text-white shadow-xl shadow-emerald-900/25 transition hover:brightness-110 sm:w-auto"
              >
                Start gated access
              </Link>
              <Link
                href="/pricing"
                className="w-full rounded-full border border-violet-400/30 bg-violet-500/10 px-8 py-3.5 text-center text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 sm:w-auto"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="glass-panel rounded-2xl p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Black box</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-400 line-through decoration-slate-600">
                Opaque prompts. Hidden state. No lineage.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Traditional AI stacks ship answers without showing which rules fired, which model disagreed, or what
                failed before.
              </p>
            </article>
            <article className="glass-panel glass-panel-emerald rounded-2xl p-6 sm:p-8 ring-1 ring-emerald-500/20">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Glass box</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">
                Visible gates. Vault &amp; Hall lineage. HITL when it matters.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                MSGF exposes pillar checks, pulse traces, and constraint ledger paths — so compliance and engineering
                share the same truth.
              </p>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Built for <span className="text-gradient-jewel">high-stakes</span> software
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
              From author ecosystems to enterprise APIs — one framework guards inference, billing, and audit.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="glass-panel group rounded-2xl p-6 transition hover:border-violet-400/30"
              >
                <h3 className="text-lg font-semibold text-slate-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Six pillars. <span className="text-emerald-400">One</span>{" "}
            <span className="text-violet-400">framework.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-slate-400">
            MSGF V3.2 — modular state gates that never mix contexts.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <article
                key={p.id}
                className={`glass-panel group rounded-2xl border p-5 transition ${accentRing(p.accent)}`}
              >
                <span
                  className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-bold ring-1 ${accentBadge(p.accent)}`}
                >
                  {p.id}
                </span>
                <h3 className="mt-3 font-semibold text-slate-100">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-violet-500/10 bg-slate-950/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to gate your AI?
            </h2>
            <p className="max-w-md text-sm text-slate-400">
              Create an account to connect your tenant, run Pulse, and open the operator dashboard.
            </p>
            <Link
              href="/sign-up"
              className="rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-10 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110"
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Elphie Syntax LLC. All rights reserved.</p>
        <p className="mt-2">
          <Link href="/pricing" className="text-violet-400/90 underline-offset-4 hover:underline">
            Pricing
          </Link>
          <span className="mx-2 text-slate-700">·</span>
          <Link href="/status" className="text-violet-400/90 underline-offset-4 hover:underline">
            System status
          </Link>
          <span className="mx-2 text-slate-700">·</span>
          <Link href="/todos" className="text-emerald-400/90 underline-offset-4 hover:underline">
            Demo workspace
          </Link>
        </p>
      </footer>
    </div>
  );
}
