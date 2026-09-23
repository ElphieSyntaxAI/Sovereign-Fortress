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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Reusable "Find out more" detail shell for the three customer-facing surfaces
 * (MSGF / Author Ecosystem / Syntax Education). Jewel-tone aware: each page picks
 * an `emerald`, `amethyst`, or `topaz` accent and the shell renders consistently.
 *
 * Content is sourced from the corresponding roadmap doc under `docs/`.
 */
import Link from "next/link";

import {
  hypeFeatureCtaUrl,
  hypeFeatureStageLabel,
  platformHubEntryById,
  type PlatformHubEntry,
  type PlatformHypeFeature,
} from "@elphie-syntax/core";

export type ProductTone = "emerald" | "amethyst" | "topaz";

export type ProductPhase = {
  label: string;
  status: string;
  highlights: string[];
};

export type ProductMetric = {
  label: string;
  value: string;
  hint?: string;
};

export type ProductDetailProps = {
  tone: ProductTone;
  eyebrow: string;
  title: string;
  tagline: string;
  vision: string;
  liveUrl: string | null;
  liveLabel: string;
  roadmapDocPath: string;
  metrics: ProductMetric[];
  phases: ProductPhase[];
  /** Pull hype feature cards from platform hub SSOT when set. */
  platformId?: PlatformHubEntry["id"];
  pillarRows?: { pillar: string; capability: string; notes?: string }[];
  footnotes?: string[];
};

const TONE: Record<
  ProductTone,
  {
    badge: string;
    ringSoft: string;
    chip: string;
    primary: string;
    secondary: string;
    titleGradient: string;
    accentText: string;
    sectionRing: string;
  }
> = {
  emerald: {
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
    ringSoft: "border-emerald-500/20",
    chip: "bg-emerald-400/85 shadow-[0_0_10px_rgba(52,211,153,0.4)]",
    primary:
      "border-emerald-500/35 bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/30",
    secondary:
      "border-emerald-500/25 text-emerald-200 hover:bg-emerald-500/10",
    titleGradient: "from-emerald-200 via-emerald-100 to-emerald-300",
    accentText: "text-emerald-300/90",
    sectionRing: "border-emerald-500/15",
  },
  amethyst: {
    badge: "border-violet-500/30 bg-violet-500/15 text-violet-200",
    ringSoft: "border-violet-500/20",
    chip: "bg-violet-400/85 shadow-[0_0_10px_rgba(167,139,250,0.45)]",
    primary:
      "border-violet-500/35 bg-violet-500/20 text-violet-50 hover:bg-violet-500/30",
    secondary:
      "border-violet-500/25 text-violet-200 hover:bg-violet-500/10",
    titleGradient: "from-violet-100 via-fuchsia-200 to-violet-300",
    accentText: "text-violet-300/90",
    sectionRing: "border-violet-500/15",
  },
  topaz: {
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-200",
    ringSoft: "border-amber-500/20",
    chip: "bg-amber-400/85 shadow-[0_0_10px_rgba(251,191,36,0.4)]",
    primary:
      "border-amber-500/35 bg-amber-500/20 text-amber-50 hover:bg-amber-500/30",
    secondary:
      "border-amber-500/25 text-amber-200 hover:bg-amber-500/10",
    titleGradient: "from-amber-100 via-orange-200 to-amber-300",
    accentText: "text-amber-300/90",
    sectionRing: "border-amber-500/15",
  },
};

function stageBadgeForFeature(
  tone: ProductTone,
  stage: PlatformHypeFeature["stage"]
): string {
  const t = TONE[tone];
  switch (stage) {
    case "beta_live":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
    case "shipped":
      return "border-teal-500/35 bg-teal-500/10 text-teal-200";
    case "foundational":
      return t.badge;
    case "in_development":
      return "border-amber-500/35 bg-amber-500/15 text-amber-200";
    case "coming_soon":
      return "border-slate-600/50 bg-slate-800/50 text-slate-300";
    case "vision":
      return "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200";
  }
}

function HypeFeatureGrid({
  entry,
  toneKey,
}: {
  entry: PlatformHubEntry;
  toneKey: ProductTone;
}) {
  const tone = TONE[toneKey];
  return (
    <section aria-label="Feature spotlight" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
          Feature spotlight
        </h2>
        <Link
          href="/roadmap"
          className={`text-xs font-semibold uppercase tracking-[0.16em] underline-offset-4 hover:underline ${tone.accentText}`}
        >
          Interactive roadmap →
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entry.hypeFeatures.map((feature) => {
          const ctaUrl = hypeFeatureCtaUrl(entry, feature);
          return (
            <li
              key={feature.id}
              className={`glass-panel rounded-2xl border p-4 ${tone.ringSoft}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  {feature.category ? (
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${tone.accentText}`}>
                      {feature.category}
                    </p>
                  ) : null}
                  <h3 className="mt-1 text-sm font-semibold text-slate-100">{feature.title}</h3>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${stageBadgeForFeature(toneKey, feature.stage)}`}
                >
                  {hypeFeatureStageLabel(feature.stage)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{feature.tagline}</p>
              {ctaUrl ? (
                <a
                  href={ctaUrl}
                  className={`mt-3 inline-flex text-xs font-semibold underline-offset-4 hover:underline ${tone.accentText}`}
                >
                  {feature.ctaLabel ?? "Try on production ↗"}
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ProductDetailShell(props: ProductDetailProps) {
  const tone = TONE[props.tone];
  const hubEntry = props.platformId ? platformHubEntryById(props.platformId) : undefined;

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <main className="mx-auto max-w-5xl space-y-10 px-5 py-10 sm:py-14">
        <nav className="relative z-10 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <a
            href="/"
            className="rounded-full border border-slate-700/70 px-3 py-1 font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            ← MSGF home
          </a>
          <span className="text-slate-700">·</span>
          <a
            href="/hub"
            className="rounded-full border border-slate-700/70 px-3 py-1 font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            Platform picker
          </a>
          <span className="text-slate-700">·</span>
          <a
            href="/roadmap"
            className={`rounded-full border px-3 py-1 font-medium transition ${tone.secondary}`}
          >
            Roadmap explorer
          </a>
          <span className="text-slate-700">·</span>
          <span className="uppercase tracking-[0.2em]">Product detail</span>
        </nav>

        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${tone.badge}`}>
              <span className={`h-2 w-2 rounded-full ${tone.chip}`} aria-hidden />
              {props.eyebrow}
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Source · {props.roadmapDocPath}
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            <span className={`bg-gradient-to-r bg-clip-text text-transparent ${tone.titleGradient}`}>
              {props.title}
            </span>
          </h1>

          <p className="max-w-3xl text-base text-slate-300 sm:text-lg">{props.tagline}</p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {props.liveUrl ? (
              <a
                href={props.liveUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${tone.primary}`}
              >
                {props.liveLabel}
                <span aria-hidden>↗</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-800/40 px-4 py-2 text-sm font-medium text-slate-400">
                Coming soon
              </span>
            )}
            <Link
              href="/roadmap"
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${tone.secondary}`}
            >
              Explore roadmap
            </Link>
          </div>
        </header>

        {hubEntry ? <HypeFeatureGrid entry={hubEntry} toneKey={props.tone} /> : null}

        <section
          aria-label="Vision"
          className={`glass-panel rounded-2xl border p-5 sm:p-6 ${tone.sectionRing}`}
        >
          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${tone.accentText}`}>
            Vision
          </p>
          <p className="mt-3 text-base leading-relaxed text-slate-200">{props.vision}</p>
        </section>

        {props.metrics.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
            {props.metrics.map((metric) => (
              <div
                key={metric.label}
                className={`glass-panel rounded-2xl border p-5 ${tone.ringSoft}`}
              >
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                  {metric.value}
                </p>
                {metric.hint ? (
                  <p className="mt-1 text-xs text-slate-400">{metric.hint}</p>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        <section aria-label="Roadmap phases" className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
              Roadmap phases
            </h2>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Read in order
            </span>
          </div>
          <ol className="space-y-3">
            {props.phases.map((phase, idx) => (
              <li
                key={phase.label}
                className={`glass-panel rounded-2xl border p-5 ${tone.ringSoft}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${tone.accentText}`}>
                      Phase {idx + 1}
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
                      {phase.label}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${tone.badge}`}
                  >
                    {phase.status}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                  {phase.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone.chip}`}
                        aria-hidden
                      />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        {props.pillarRows && props.pillarRows.length > 0 ? (
          <section aria-label="Pillar mapping" className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
              Pillar mapping
            </h2>
            <div className={`glass-panel overflow-hidden rounded-2xl border ${tone.ringSoft}`}>
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pillar</th>
                    <th className="px-4 py-3 font-medium">Capability</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {props.pillarRows.map((row, i) => (
                    <tr
                      key={`${row.pillar}-${i}`}
                      className="border-t border-slate-800/70 align-top"
                    >
                      <td className={`whitespace-nowrap px-4 py-3 text-xs font-semibold ${tone.accentText}`}>
                        {row.pillar}
                      </td>
                      <td className="px-4 py-3 text-slate-200">{row.capability}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{row.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {props.footnotes && props.footnotes.length > 0 ? (
          <footer className="space-y-1 border-t border-slate-800/70 pt-5 text-[11px] text-slate-500">
            {props.footnotes.map((f) => (
              <p key={f}>{f}</p>
            ))}
          </footer>
        ) : null}
      </main>
    </div>
  );
}
