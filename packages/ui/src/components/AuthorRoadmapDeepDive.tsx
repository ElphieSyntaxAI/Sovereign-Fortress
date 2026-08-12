"use client";

import {
  AUTHOR_FLYWHEEL,
  AUTHOR_LEXICON,
  AUTHOR_MSGF_STATES,
  AUTHOR_PHASE_1_DETAIL,
  AUTHOR_PHASE_2_DETAIL,
  AUTHOR_PHASE_3_DETAIL,
  AUTHOR_PROGRESS_PULSE,
  AUTHOR_PUBLISHER_KEYS,
  AUTHOR_ROADMAP_AS_OF,
  AUTHOR_TIERS,
  authorRoadmapHeroBlurb,
  type AuthorPhaseDetailRow,
} from "@elphie-syntax/core";

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function PhaseDetailTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly AuthorPhaseDetailRow[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-violet-500/15 bg-slate-950/35">
      <div className="border-b border-slate-800/70 bg-slate-900/50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      </div>
      <ul className="divide-y divide-slate-800/60">
        {rows.map((row) => (
          <li key={row.feature} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-violet-100">{row.feature}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
                {row.percent}%
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{row.description}</p>
            <div className="mt-2">
              <ProgressBar percent={row.percent} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type AuthorRoadmapDeepDiveProps = {
  className?: string;
};

export function AuthorRoadmapDeepDive({ className = "" }: AuthorRoadmapDeepDiveProps) {
  return (
    <div className={`space-y-10 ${className}`}>
      <section className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">
          Creative Integrity Flywheel
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          {authorRoadmapHeroBlurb()}
        </p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUTHOR_FLYWHEEL.map((step, i) => (
            <li
              key={step.phase}
              className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/90">
                {i + 1} · {step.phase}
              </p>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">{step.headline}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Progress pulse">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Progress pulse
        </h2>
        <p className="mt-1 text-xs text-slate-500">As of {AUTHOR_ROADMAP_AS_OF}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AUTHOR_PROGRESS_PULSE.map((pulse) => (
            <li
              key={pulse.label}
              className="rounded-2xl border border-violet-500/15 bg-slate-950/35 p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-slate-200">{pulse.label}</p>
                <span className="text-lg font-semibold text-violet-200">{pulse.percent}%</span>
              </div>
              <ProgressBar percent={pulse.percent} />
              <p className="mt-2 text-[11px] text-slate-500">{pulse.hint}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Phase feature breakdown" className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Phase feature breakdown
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <PhaseDetailTable title="Phase 1 — Foundation" rows={AUTHOR_PHASE_1_DETAIL} />
          <PhaseDetailTable title="Phase 2 — Professionalization" rows={AUTHOR_PHASE_2_DETAIL} />
          <PhaseDetailTable title="Phase 3 — Scaling" rows={AUTHOR_PHASE_3_DETAIL} />
        </div>
      </section>

      <section aria-label="Sovereign lexicon">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Sovereign lexicon
        </h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-violet-500/15">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 font-medium">Definition</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Impact</th>
              </tr>
            </thead>
            <tbody>
              {AUTHOR_LEXICON.map((row) => (
                <tr key={row.term} className="border-t border-slate-800/70 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-violet-300">
                    {row.term}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{row.definition}</td>
                  <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                    {row.impact}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2" aria-label="Tiers and publisher keys">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">Author tiers</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-violet-500/15">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {AUTHOR_TIERS.map((row) => (
                  <tr key={row.tier} className="border-t border-slate-800/70 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-violet-300">
                      {row.tier}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.price}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.capabilities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">
            Publisher encryption keys
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-violet-500/15">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                </tr>
              </thead>
              <tbody>
                {AUTHOR_PUBLISHER_KEYS.map((row) => (
                  <tr key={row.level} className="border-t border-slate-800/70">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-violet-300">
                      {row.level}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{row.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-200">MSGF lifecycle states</h3>
            <ul className="mt-3 space-y-2">
              {AUTHOR_MSGF_STATES.map((s) => (
                <li
                  key={s.state}
                  className="rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-xs"
                >
                  <code className="font-semibold text-violet-300">{s.state}</code>
                  <span className="text-slate-500"> — </span>
                  <span className="text-slate-400">{s.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
