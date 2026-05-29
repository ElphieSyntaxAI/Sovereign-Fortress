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
/**
 * `app/page.tsx` — "What are you looking for?" platform chooser hub.
 * Copy SSOT: packages/core/src/lib/platform-hub-content.ts
 * Twin: apps/author-ecosystem/client/src/pages/PlatformHubPage.jsx
 */
import Link from "next/link";

import {
  PLATFORM_HUB_ENTRIES,
  PLATFORM_HUB_ROADMAP_AS_OF,
  availabilityLabel,
  productionMapLine,
  type PlatformHubAvailability,
  type PlatformHubEntry,
  type PlatformHubTone,
} from "@elphie-syntax/core";

import { canAccessPrelaunchProducts } from "@/lib/prelaunch-product-access";

import { AuthLandingNav } from "./AuthLandingNav";
import { PublicEcoMetricsWidget } from "./PublicEcoMetricsWidget";

type PlatformPrimary =
  | { label: string; href: string; external: false }
  | { label: string; href: string; external: true };

const AUTHOR_HOST =
  process.env.AUTHOR_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_AUTHOR_APP_URL?.trim() ||
  "https://authorecosystem.elphiesyntax.com";
const SYNTAX_EDUCATES_HOST =
  process.env.EDUCATION_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_EDUCATION_APP_URL?.trim() ||
  "https://syntaxeducates.elphiesyntax.com";

const TONE: Record<
  PlatformHubTone,
  {
    ring: string;
    eyebrow: string;
    chipDot: string;
    titleGradient: string;
    primary: string;
    secondary: string;
    sectionAccent: string;
    chipBullet: string;
    statusLive: string;
    statusDeploy: string;
    statusSoon: string;
  }
> = {
  emerald: {
    ring: "border-emerald-500/25 hover:border-emerald-400/45",
    eyebrow: "text-emerald-300/85",
    chipDot: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]",
    titleGradient: "from-emerald-200 via-emerald-100 to-emerald-300",
    primary:
      "border-emerald-500/40 bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/30",
    secondary: "text-emerald-200/85 hover:text-emerald-100",
    sectionAccent: "border-emerald-500/20 bg-emerald-500/5",
    chipBullet: "bg-emerald-300/80",
    statusLive: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
    statusDeploy: "border-violet-500/35 bg-violet-500/15 text-violet-200",
    statusSoon: "border-slate-600/50 bg-slate-800/50 text-slate-400",
  },
  amethyst: {
    ring: "border-violet-500/25 hover:border-violet-400/45",
    eyebrow: "text-violet-300/85",
    chipDot: "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.55)]",
    titleGradient: "from-violet-100 via-fuchsia-200 to-violet-300",
    primary:
      "border-violet-500/40 bg-violet-500/20 text-violet-50 hover:bg-violet-500/30",
    secondary: "text-violet-200/85 hover:text-violet-100",
    sectionAccent: "border-violet-500/20 bg-violet-500/5",
    chipBullet: "bg-violet-300/80",
    statusLive: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
    statusDeploy: "border-violet-500/35 bg-violet-500/15 text-violet-200",
    statusSoon: "border-slate-600/50 bg-slate-800/50 text-slate-400",
  },
  topaz: {
    ring: "border-amber-500/25 hover:border-amber-400/45",
    eyebrow: "text-amber-300/85",
    chipDot: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]",
    titleGradient: "from-amber-100 via-orange-200 to-amber-300",
    primary:
      "border-amber-500/40 bg-amber-500/20 text-amber-50 hover:bg-amber-500/30",
    secondary: "text-amber-200/85 hover:text-amber-100",
    sectionAccent: "border-amber-500/20 bg-amber-500/5",
    chipBullet: "bg-amber-300/80",
    statusLive: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
    statusDeploy: "border-violet-500/35 bg-violet-500/15 text-violet-200",
    statusSoon: "border-slate-600/50 bg-slate-800/50 text-slate-400",
  },
};

function statusBadgeClass(tone: PlatformHubTone, availability: PlatformHubAvailability) {
  const styles = TONE[tone];
  if (availability === "live") return styles.statusLive;
  if (availability === "deploying") return styles.statusDeploy;
  return styles.statusSoon;
}

function resolvePrimary(platform: PlatformHubEntry): PlatformPrimary {
  if (platform.id === "author") {
    return {
      label: "Open Author Ecosystem",
      href: AUTHOR_HOST,
      external: true,
    };
  }
  if (platform.id === "education") {
    return {
      label: "Open Syntax Education",
      href: SYNTAX_EDUCATES_HOST,
      external: true,
    };
  }
  return {
    label: "Sign in to MSGF console",
    href: "/sign-in",
    external: false,
  };
}

function PrimaryCta({
  platform,
  canOpenPrelaunch,
}: {
  platform: PlatformHubEntry;
  canOpenPrelaunch: boolean;
}) {
  const styles = TONE[platform.tone];
  const className = `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${styles.primary}`;
  if (platform.prelaunch && !canOpenPrelaunch) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-800/40 px-4 py-2 text-sm font-medium text-slate-400">
        Coming soon
      </span>
    );
  }
  const primary = resolvePrimary(platform);
  if (primary.external) {
    return (
      <a
        href={primary.href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
      >
        {primary.label}
        <span aria-hidden>↗</span>
      </a>
    );
  }
  return (
    <Link href={primary.href} className={className}>
      {primary.label}
      <span aria-hidden>→</span>
    </Link>
  );
}

function AvailabilityBadge({ platform }: { platform: PlatformHubEntry }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(platform.tone, platform.availability)}`}
    >
      {availabilityLabel(platform.availability)}
    </span>
  );
}

function QuickCard({
  platform,
  canOpenPrelaunch,
}: {
  platform: PlatformHubEntry;
  canOpenPrelaunch: boolean;
}) {
  const styles = TONE[platform.tone];
  return (
    <article
      className={`glass-panel flex flex-col gap-4 rounded-2xl border p-5 transition ${styles.ring}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${styles.chipDot}`} aria-hidden />
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${styles.eyebrow}`}
          >
            {platform.eyebrow}
          </p>
        </div>
        <AvailabilityBadge platform={platform} />
      </div>

      <h3
        className={`bg-gradient-to-r bg-clip-text text-xl font-bold tracking-tight text-transparent ${styles.titleGradient}`}
      >
        {platform.title}
      </h3>

      <p className="text-xs font-medium text-slate-400">{platform.roadmapHeadline}</p>
      <p className="text-[11px] text-slate-500">
        <span className="text-slate-400">Host ·</span> {platform.productionHost}
      </p>

      <p className="text-sm leading-relaxed text-slate-300">{platform.tagline}</p>

      <ul className="space-y-1.5 text-xs text-slate-300">
        {platform.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${styles.chipBullet}`}
              aria-hidden
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <a
          href={`#${platform.anchor}`}
          className={`text-xs font-semibold underline-offset-4 hover:underline ${styles.secondary}`}
        >
          Roadmap &amp; details →
        </a>
        <PrimaryCta platform={platform} canOpenPrelaunch={canOpenPrelaunch} />
      </div>
    </article>
  );
}

function RoadmapPhaseBlock({
  platform,
  phase,
}: {
  platform: PlatformHubEntry;
  phase: PlatformHubEntry["phases"][number];
}) {
  const styles = TONE[platform.tone];
  return (
    <li className="glass-panel rounded-2xl border border-slate-700/60 p-4 text-sm text-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-100">{phase.label}</p>
        <span className={`text-[10px] font-medium uppercase tracking-wide ${styles.eyebrow}`}>
          {phase.status}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
        {phase.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${styles.chipBullet}`}
              aria-hidden
            />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function DetailSection({
  platform,
  canOpenPrelaunch,
}: {
  platform: PlatformHubEntry;
  canOpenPrelaunch: boolean;
}) {
  const styles = TONE[platform.tone];
  const hostUrl = `https://${platform.productionHost}`;
  return (
    <section
      id={platform.anchor}
      className={`scroll-mt-24 rounded-3xl border p-6 sm:p-8 ${styles.sectionAccent}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${styles.eyebrow}`}
            >
              {platform.eyebrow}
            </p>
            <AvailabilityBadge platform={platform} />
          </div>
          <h2
            className={`bg-gradient-to-r bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl ${styles.titleGradient}`}
          >
            {platform.title}
          </h2>
          <p className="text-sm text-slate-400">{platform.roadmapHeadline}</p>
          <p className="text-xs text-slate-500">
            Production ·{" "}
            <a
              href={hostUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={`underline-offset-4 hover:underline ${styles.secondary}`}
            >
              {platform.productionHost} ↗
            </a>
          </p>
        </div>
        <PrimaryCta platform={platform} canOpenPrelaunch={canOpenPrelaunch} />
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200 sm:text-base">
        {platform.tagline}
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {platform.bullets.map((bullet) => (
          <li
            key={bullet}
            className="glass-panel rounded-2xl border border-slate-700/60 p-4 text-sm text-slate-200"
          >
            <div className="flex items-start gap-2">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${styles.chipBullet}`}
                aria-hidden
              />
              <span>{bullet}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
          Roadmap position
        </h3>
        <ul className="grid gap-3 lg:grid-cols-3">
          {platform.phases.map((phase) => (
            <RoadmapPhaseBlock key={phase.label} platform={platform} phase={phase} />
          ))}
        </ul>
      </div>

      <p className="mt-5 text-xs text-slate-400">
        Deep dive ·{" "}
        <Link
          href={`/products/${platform.id}`}
          className={`font-medium underline-offset-4 hover:underline ${styles.secondary}`}
        >
          {platform.title} product page →
        </Link>
        <span className="mx-2 text-slate-600">·</span>
        <span className="text-slate-500">SSOT {platform.roadmapDoc}</span>
      </p>
    </section>
  );
}

export async function PlatformHubLanding() {
  const canOpenPrelaunch = await canAccessPrelaunchProducts();

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />

      <main className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:py-16">
        <section className="text-center">
          <p className="mb-2 text-xs text-slate-500">{productionMapLine()}</p>
          <p className="mb-3 text-[11px] text-slate-600">
            Roadmap snapshot · updated {PLATFORM_HUB_ROADMAP_AS_OF}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Welcome to Elphie Syntax
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            <span className="text-gradient-jewel">What are you looking for?</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Three surfaces, one shared MSGF brain. MSGF 1.0 RC is live on{" "}
            <span className="text-emerald-300/90">elphiesgatedai</span>; Author Phase 1 is
            deploying to <span className="text-violet-300/90">authorecosystem</span>; Syntax
            Education remains prelaunch.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-3" aria-label="Pick a platform">
          {PLATFORM_HUB_ENTRIES.map((p) => (
            <QuickCard key={p.id} platform={p} canOpenPrelaunch={canOpenPrelaunch} />
          ))}
        </section>

        <PublicEcoMetricsWidget />

        <section className="space-y-8" aria-label="Roadmap and platform details">
          <header className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="text-gradient-jewel">Roadmap &amp; what each platform does</span>
            </h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              As of {PLATFORM_HUB_ROADMAP_AS_OF}
            </span>
          </header>

          {PLATFORM_HUB_ENTRIES.map((p) => (
            <DetailSection key={p.id} platform={p} canOpenPrelaunch={canOpenPrelaunch} />
          ))}
        </section>

        <section className="text-center">
          <p className="text-sm text-slate-400">
            Already have an MSGF console account?{" "}
            <Link
              href="/sign-in"
              className="font-semibold text-emerald-300 underline-offset-4 hover:text-emerald-200 hover:underline"
            >
              Sign in here →
            </Link>
            <span className="mx-2 text-slate-700">·</span>
            <a
              href={AUTHOR_HOST}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline"
            >
              Author on authorecosystem ↗
            </a>
            <span className="mx-2 text-slate-700">·</span>
            <Link
              href="/brain"
              className="font-semibold text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline"
            >
              MSGF brand page →
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-violet-500/10 bg-slate-950/40 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Elphie Syntax LLC. All rights reserved.</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Link href="/pricing" className="text-violet-400/85 underline-offset-4 hover:underline">
            Pricing
          </Link>
          <span className="text-slate-700">·</span>
          <Link href="/status" className="text-violet-400/85 underline-offset-4 hover:underline">
            System status
          </Link>
          <span className="text-slate-700">·</span>
          <Link
            href="/getting-started"
            className="text-emerald-400/85 underline-offset-4 hover:underline"
          >
            Getting started
          </Link>
        </p>
      </footer>
    </div>
  );
}
