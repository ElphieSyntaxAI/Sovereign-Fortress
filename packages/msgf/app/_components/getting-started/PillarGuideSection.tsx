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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import Link from "next/link";

import { PILLAR_GUIDE_ENTRIES, V32_PIPELINE_STEPS } from "@/lib/pillar-guide-copy";

export function PillarGuideSection() {
  return (
    <div id="six-pillars" className="scroll-mt-24 space-y-10">
      <header className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300/90">
          Governance reference
        </p>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          How the <span className="text-gradient-jewel">six policy domains</span> work
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Each domain is an isolated context partition. The pipeline inspects, routes, and stores
          outcomes so prompts never mix projects. Use this guide when wiring ingest or reading
          dashboard health.
        </p>
      </header>

      <section
        className="glass-panel rounded-2xl border border-emerald-500/15 p-5 sm:p-6"
        aria-label="Execution pipeline"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/85">
          Execution pipeline
        </p>
        <ol className="mt-4 flex flex-wrap justify-center gap-2">
          {V32_PIPELINE_STEPS.map((item, i) => (
            <li
              key={item.step}
              className="rounded-full border border-slate-700/80 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-300"
              title={item.blurb}
            >
              <span className="font-semibold text-emerald-200/90">{item.step}</span>
              {i < V32_PIPELINE_STEPS.length - 1 ? (
                <span className="ml-1 text-slate-600" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {PILLAR_GUIDE_ENTRIES.map((entry) => (
          <article
            key={entry.pillar}
            id={`pillar-${entry.pillar}`}
            className="glass-panel scroll-mt-24 rounded-2xl border border-violet-500/12 p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-200">
                {entry.pillar}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-slate-50">{entry.title}</h3>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-violet-200/90">What it does</dt>
                <dd className="mt-1 leading-relaxed text-slate-400">{entry.whatItDoes}</dd>
              </div>
              <div>
                <dt className="font-medium text-cyan-200/90">In your product</dt>
                <dd className="mt-1 leading-relaxed text-slate-400">{entry.inYourProduct}</dd>
              </div>
              <div>
                <dt className="font-medium text-emerald-200/90">How to use it</dt>
                <dd className="mt-1 leading-relaxed text-slate-400">{entry.howToUse}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <p className="text-center text-sm text-slate-500">
        Full engineering map:{" "}
        <Link href="/products/msgf" className="text-emerald-400/90 underline-offset-4 hover:underline">
          MSGF product overview
        </Link>
        {" · "}
        <Link href="/dashboard" className="text-violet-400/90 underline-offset-4 hover:underline">
          Open governance dashboard
        </Link>
      </p>
    </div>
  );
}
