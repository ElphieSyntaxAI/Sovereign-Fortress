"use client";

import { useMemo, useState } from "react";

import {
  PLATFORM_HUB_ENTRIES,
  PLATFORM_HUB_ROADMAP_AS_OF,
  availabilityLabel,
  hypeFeatureCtaUrl,
  hypeFeatureStageLabel,
  platformPrimaryCtaUrl,
  type PlatformHubEntry,
  type PlatformHubTone,
  type PlatformHypeFeature,
  type PlatformHypeFeatureStage,
} from "@elphie-syntax/core";

export type PlatformRoadmapExplorerProps = {
  variant?: "full" | "embedded";
  initialProductId?: PlatformHubEntry["id"];
  showPhaseTimeline?: boolean;
  className?: string;
  /** Base URL for MSGF-hosted product pages (e.g. https://elphiesgatedai…). Empty = relative `/products`. */
  productPageBaseUrl?: string;
};

type StageFilter = "all" | PlatformHypeFeatureStage;

const TONE: Record<
  PlatformHubTone,
  {
    tabActive: string;
    tabIdle: string;
    chip: string;
    cardRing: string;
    eyebrow: string;
    titleGradient: string;
    cta: string;
    phaseBullet: string;
    stageBeta: string;
    stageShipped: string;
    stageFoundational: string;
    stageDev: string;
    stageSoon: string;
    stageVision: string;
  }
> = {
  emerald: {
    tabActive: "border-emerald-400/60 bg-emerald-500/20 text-emerald-50",
    tabIdle: "border-slate-700/60 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-200",
    chip: "bg-emerald-400/90 shadow-[0_0_10px_rgba(52,211,153,0.45)]",
    cardRing: "border-emerald-500/20 hover:border-emerald-400/35",
    eyebrow: "text-emerald-300/85",
    titleGradient: "from-emerald-200 via-emerald-100 to-emerald-300",
    cta: "text-emerald-200 hover:text-emerald-100",
    phaseBullet: "bg-emerald-300/80",
    stageBeta: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    stageShipped: "border-teal-500/35 bg-teal-500/10 text-teal-200",
    stageFoundational: "border-violet-500/35 bg-violet-500/15 text-violet-200",
    stageDev: "border-amber-500/35 bg-amber-500/15 text-amber-200",
    stageSoon: "border-slate-600/50 bg-slate-800/50 text-slate-300",
    stageVision: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
  },
  amethyst: {
    tabActive: "border-violet-400/60 bg-violet-500/20 text-violet-50",
    tabIdle: "border-slate-700/60 text-slate-400 hover:border-violet-500/30 hover:text-violet-200",
    chip: "bg-violet-400/90 shadow-[0_0_10px_rgba(167,139,250,0.45)]",
    cardRing: "border-violet-500/20 hover:border-violet-400/35",
    eyebrow: "text-violet-300/85",
    titleGradient: "from-violet-100 via-fuchsia-200 to-violet-300",
    cta: "text-violet-200 hover:text-violet-100",
    phaseBullet: "bg-violet-300/80",
    stageBeta: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    stageShipped: "border-teal-500/35 bg-teal-500/10 text-teal-200",
    stageFoundational: "border-violet-500/35 bg-violet-500/15 text-violet-200",
    stageDev: "border-amber-500/35 bg-amber-500/15 text-amber-200",
    stageSoon: "border-slate-600/50 bg-slate-800/50 text-slate-300",
    stageVision: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
  },
  topaz: {
    tabActive: "border-amber-400/60 bg-amber-500/20 text-amber-50",
    tabIdle: "border-slate-700/60 text-slate-400 hover:border-amber-500/30 hover:text-amber-200",
    chip: "bg-amber-400/90 shadow-[0_0_10px_rgba(251,191,36,0.45)]",
    cardRing: "border-amber-500/20 hover:border-amber-400/35",
    eyebrow: "text-amber-300/85",
    titleGradient: "from-amber-100 via-orange-200 to-amber-300",
    cta: "text-amber-200 hover:text-amber-100",
    phaseBullet: "bg-amber-300/80",
    stageBeta: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    stageShipped: "border-teal-500/35 bg-teal-500/10 text-teal-200",
    stageFoundational: "border-violet-500/35 bg-violet-500/15 text-violet-200",
    stageDev: "border-amber-500/35 bg-amber-500/15 text-amber-200",
    stageSoon: "border-slate-600/50 bg-slate-800/50 text-slate-300",
    stageVision: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
  },
};

const STAGE_FILTERS: { id: StageFilter; label: string }[] = [
  { id: "all", label: "All features" },
  { id: "beta_live", label: "Beta · live" },
  { id: "shipped", label: "Shipped" },
  { id: "foundational", label: "Foundational" },
  { id: "in_development", label: "In dev" },
  { id: "coming_soon", label: "Coming soon" },
  { id: "vision", label: "Horizon" },
];

function stageBadgeClass(tone: PlatformHubTone, stage: PlatformHypeFeatureStage): string {
  const styles = TONE[tone];
  switch (stage) {
    case "beta_live":
      return styles.stageBeta;
    case "shipped":
      return styles.stageShipped;
    case "foundational":
      return styles.stageFoundational;
    case "in_development":
      return styles.stageDev;
    case "coming_soon":
      return styles.stageSoon;
    case "vision":
      return styles.stageVision;
  }
}

function FeatureCard({
  entry,
  feature,
}: {
  entry: PlatformHubEntry;
  feature: PlatformHypeFeature;
}) {
  const tone = TONE[entry.tone];
  const ctaUrl = hypeFeatureCtaUrl(entry, feature);

  return (
    <article
      className={`group flex flex-col gap-3 rounded-2xl border bg-slate-950/35 p-4 transition ${tone.cardRing}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          {feature.category ? (
            <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${tone.eyebrow}`}>
              {feature.category}
            </p>
          ) : null}
          <h4 className="text-sm font-semibold tracking-tight text-slate-100">{feature.title}</h4>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${stageBadgeClass(entry.tone, feature.stage)}`}
        >
          {hypeFeatureStageLabel(feature.stage)}
        </span>
      </div>
      <p className="flex-1 text-xs leading-relaxed text-slate-300">{feature.tagline}</p>
      {ctaUrl ? (
        <a
          href={ctaUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={`inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline ${tone.cta}`}
        >
          {feature.ctaLabel ?? "Try on production ↗"}
        </a>
      ) : null}
    </article>
  );
}

function PhaseTimeline({ entry }: { entry: PlatformHubEntry }) {
  const tone = TONE[entry.tone];
  return (
    <ol className="grid gap-3 lg:grid-cols-3">
      {entry.phases.map((phase) => (
        <li
          key={phase.label}
          className="rounded-2xl border border-slate-700/60 bg-slate-950/35 p-4 text-sm text-slate-200"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-slate-100">{phase.label}</p>
            <span className={`text-[10px] font-medium uppercase tracking-wide ${tone.eyebrow}`}>
              {phase.status}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
            {phase.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone.phaseBullet}`}
                  aria-hidden
                />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function PlatformRoadmapExplorer({
  variant = "embedded",
  initialProductId = "msgf",
  showPhaseTimeline = true,
  className = "",
  productPageBaseUrl = "",
}: PlatformRoadmapExplorerProps) {
  const [activeId, setActiveId] = useState<PlatformHubEntry["id"]>(initialProductId);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");

  const activeEntry = useMemo(
    () => PLATFORM_HUB_ENTRIES.find((e) => e.id === activeId) ?? PLATFORM_HUB_ENTRIES[0],
    [activeId]
  );

  const filteredFeatures = useMemo(() => {
    if (stageFilter === "all") return activeEntry.hypeFeatures;
    return activeEntry.hypeFeatures.filter((f) => f.stage === stageFilter);
  }, [activeEntry, stageFilter]);

  const tone = TONE[activeEntry.tone];
  const productPageHref = productPageBaseUrl
    ? `${productPageBaseUrl.replace(/\/$/, "")}/products/${activeEntry.id}`
    : `/products/${activeEntry.id}`;
  const primaryCta = platformPrimaryCtaUrl(activeEntry);

  return (
    <section
      className={`space-y-6 ${className}`}
      aria-label="Platform roadmap explorer"
    >
      {variant === "full" ? (
        <header className="space-y-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Explore the roadmap
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span
              className="bg-gradient-to-r bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #6ee7b7 0%, #c4b5fd 45%, #a855f7 100%)",
              }}
            >
              What we&apos;re building — and what&apos;s live today
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-slate-400">
            Beta signup, Shadow Proxy trials, and foundational testing run on{" "}
            <strong className="font-medium text-slate-200">production hosts</strong> — staging is
            for operators only. Snapshot · {PLATFORM_HUB_ROADMAP_AS_OF}
          </p>
        </header>
      ) : (
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              <span
                className="bg-gradient-to-r bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #6ee7b7 0%, #c4b5fd 45%, #a855f7 100%)",
                }}
              >
                Explore the roadmap
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Beta &amp; trials on production · updated {PLATFORM_HUB_ROADMAP_AS_OF}
            </p>
          </div>
        </header>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Platforms">
        {PLATFORM_HUB_ENTRIES.map((entry) => {
          const styles = TONE[entry.tone];
          const isActive = entry.id === activeId;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(entry.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                isActive ? styles.tabActive : styles.tabIdle
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${styles.chip}`} aria-hidden />
              {entry.title}
            </button>
          );
        })}
      </div>

      <div
        className={`rounded-3xl border p-5 sm:p-6 ${tone.cardRing} bg-slate-950/25`}
        role="tabpanel"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${tone.eyebrow}`}>
                {activeEntry.eyebrow}
              </p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stageBadgeClass(activeEntry.tone, activeEntry.availability === "beta_testing" ? "beta_live" : activeEntry.availability === "foundational_testing" ? "foundational" : "in_development")}`}
              >
                {availabilityLabel(activeEntry.availability)}
              </span>
            </div>
            <h3
              className={`bg-gradient-to-r bg-clip-text text-2xl font-bold tracking-tight text-transparent ${tone.titleGradient}`}
            >
              {activeEntry.title}
            </h3>
            <p className="max-w-2xl text-sm text-slate-300">{activeEntry.tagline}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {primaryCta && !activeEntry.prelaunch ? (
              <a
                href={primaryCta}
                target="_blank"
                rel="noreferrer noopener"
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${tone.tabActive}`}
              >
                {activeEntry.primaryCta?.label ?? "Get started"}
                <span aria-hidden>↗</span>
              </a>
            ) : null}
            <a
              href={productPageHref}
              target={productPageBaseUrl ? "_blank" : undefined}
              rel={productPageBaseUrl ? "noreferrer noopener" : undefined}
              className={`inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100`}
            >
              Full product page {productPageBaseUrl ? "↗" : "→"}
            </a>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter by stage">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStageFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                stageFilter === f.id
                  ? "border-slate-500 bg-slate-800/80 text-slate-100"
                  : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFeatures.map((feature) => (
            <li key={feature.id}>
              <FeatureCard entry={activeEntry} feature={feature} />
            </li>
          ))}
        </ul>

        {filteredFeatures.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No features in this filter yet — try All.</p>
        ) : null}

        {showPhaseTimeline ? (
          <div className="mt-8 space-y-3 border-t border-slate-800/70 pt-6">
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Phase timeline
            </h4>
            <PhaseTimeline entry={activeEntry} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
