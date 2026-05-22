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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/**
 * `app/page.tsx` — "What are you looking for?" platform chooser hub.
 *
 * Why this is on `/` (not /hub or /landing):
 *  - `elphiesyntax.com` is the global hub. During testing, the same hub can be
 *    served from the default Cloud Run URL without redirecting away.
 *  - MSGF brand marketing ("Glass box sovereignty…") still lives at `/brain`
 *    (the legacy `HomeLanding`) and stays linkable from the MSGF card.
 *  - Detail pages already exist at `/products/{author,education,msgf}` and
 *    we link straight into them from each card's "Find out more".
 *
 * Twin: `apps/author-ecosystem/client/src/pages/PlatformHubPage.jsx` carries
 * the same chooser for temporary/apex deployments. Keep copy and palette aligned.
 */
import Link from "next/link";

import { canAccessPrelaunchProducts } from "@/lib/prelaunch-product-access";

import { LandingNav } from "./LandingNav";
import { PublicEcoMetricsWidget } from "./PublicEcoMetricsWidget";

type ToneId = "emerald" | "amethyst" | "topaz";

type PlatformPrimary =
  | { label: string; href: string; external: false }
  | { label: string; href: string; external: true };

type Platform = {
  id: string;
  anchor: string;
  eyebrow: string;
  title: string;
  tagline: string;
  bullets: readonly string[];
  tone: ToneId;
  primary: PlatformPrimary;
  prelaunch: boolean;
  /** `/products/{id}` on MSGF — internal route. */
  learnMoreHref: string;
};

const AUTHOR_HOST =
  process.env.AUTHOR_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_AUTHOR_APP_URL?.trim() ||
  "";
const SYNTAX_EDUCATES_HOST =
  process.env.EDUCATION_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_EDUCATION_APP_URL?.trim() ||
  "https://syntaxeducates.elphiesyntax.com";

const PLATFORMS: readonly Platform[] = [
  {
    id: "author",
    anchor: "author",
    eyebrow: "Sovereign · For writers & publishers",
    title: "Author Ecosystem",
    tagline:
      "Sovereign narrative infrastructure — HAL biometric proof, Vault Pact NDA, Cool Down revision locks.",
    bullets: [
      "HAL Ledger — biometric proof of human authorship",
      "Vault Pact — zero-training, no-human-browsing NDA",
      "Cool Down + Bicameral audit — publisher-grade revision receipts",
    ],
    tone: "amethyst",
    primary: {
      label: "Open Author Ecosystem",
      href: AUTHOR_HOST || "/products/author",
      external: Boolean(AUTHOR_HOST),
    },
    prelaunch: true,
    learnMoreHref: "/products/author",
  },
  {
    id: "education",
    anchor: "education",
    eyebrow: "K–12 · LTI 1.3 · Utah-aware",
    title: "Syntax Education",
    tagline:
      "Socratic sandbox with grade-aware AI Allowance, district-approved curriculum slicing, and Canvas LTI 1.3.",
    bullets: [
      "Layered Workspace Control — Layer A toolbox · Layer B allowance",
      "Canvas LTI 1.3 + de-identified privacy gate",
      "Human Effort Certificate → SpeedGrader passback",
    ],
    tone: "topaz",
    primary: {
      label: "Open Syntax Education",
      href: SYNTAX_EDUCATES_HOST,
      external: true,
    },
    prelaunch: true,
    learnMoreHref: "/products/education",
  },
  {
    id: "msgf",
    anchor: "msgf",
    eyebrow: "Brain · For developers & enterprise teams",
    title: "MSGF — Gated AI",
    tagline:
      "Stateful, self-defending AI orchestration. Six pillars, hot/cold storage, dual-model consensus, human tie-breaker.",
    bullets: [
      "SWEEP → SHARD → DEFEND → CONVERGE → ARBITRATE → PERSIST",
      "Vault (positive) vs Hall (negative) cross-reference on every Pulse",
      "RED immediate · YELLOW 6h · GREEN 24h tiered batching",
    ],
    tone: "emerald",
    primary: {
      label: "Sign in to MSGF console",
      href: "/sign-in",
      external: false,
    },
    prelaunch: false,
    learnMoreHref: "/products/msgf",
  },
];

const TONE: Record<
  ToneId,
  {
    ring: string;
    eyebrow: string;
    chipDot: string;
    titleGradient: string;
    primary: string;
    secondary: string;
    sectionAccent: string;
    chipBullet: string;
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
  },
};

function PrimaryCta({
  platform,
  canOpenPrelaunch,
}: {
  platform: Platform;
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
  if (platform.primary.external) {
    return (
      <a
        href={platform.primary.href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
      >
        {platform.primary.label}
        <span aria-hidden>↗</span>
      </a>
    );
  }
  return (
    <Link href={platform.primary.href} className={className}>
      {platform.primary.label}
      <span aria-hidden>→</span>
    </Link>
  );
}

function QuickCard({
  platform,
  canOpenPrelaunch,
}: {
  platform: Platform;
  canOpenPrelaunch: boolean;
}) {
  const styles = TONE[platform.tone];
  return (
    <article
      className={`glass-panel flex flex-col gap-4 rounded-2xl border p-5 transition ${styles.ring}`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${styles.chipDot}`} aria-hidden />
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${styles.eyebrow}`}
        >
          {platform.eyebrow}
        </p>
      </div>

      <h3
        className={`bg-gradient-to-r bg-clip-text text-xl font-bold tracking-tight text-transparent ${styles.titleGradient}`}
      >
        {platform.title}
      </h3>

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
          Find out more →
        </a>
        <PrimaryCta platform={platform} canOpenPrelaunch={canOpenPrelaunch} />
      </div>
    </article>
  );
}

function DetailSection({
  platform,
  canOpenPrelaunch,
}: {
  platform: Platform;
  canOpenPrelaunch: boolean;
}) {
  const styles = TONE[platform.tone];
  return (
    <section
      id={platform.anchor}
      className={`scroll-mt-24 rounded-3xl border p-6 sm:p-8 ${styles.sectionAccent}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-1">
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${styles.eyebrow}`}
          >
            {platform.eyebrow}
          </p>
          <h2
            className={`bg-gradient-to-r bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl ${styles.titleGradient}`}
          >
            {platform.title}
          </h2>
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

      <p className="mt-5 text-xs text-slate-400">
        Want the deep dive?{" "}
        <Link
          href={platform.learnMoreHref}
          className={`font-medium underline-offset-4 hover:underline ${styles.secondary}`}
        >
          Read the {platform.title} roadmap →
        </Link>
      </p>
    </section>
  );
}

export async function PlatformHubLanding() {
  const canOpenPrelaunch = await canAccessPrelaunchProducts();

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <LandingNav />

      <main className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:py-16">
        <section className="text-center">
          <p className="mb-3 text-xs text-slate-500">
            Production map: elphiesyntax.com → global hub · authorecosystem ·
            syntaxeducates · elphiesgatedai
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Welcome to Elphie Syntax
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            <span className="text-gradient-jewel">What are you looking for?</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Three surfaces, one shared MSGF brain. Pick the platform that fits how you
            build — or how you learn — and we&apos;ll take you straight to it.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-3" aria-label="Pick a platform">
          {PLATFORMS.map((p) => (
            <QuickCard key={p.id} platform={p} canOpenPrelaunch={canOpenPrelaunch} />
          ))}
        </section>

        <PublicEcoMetricsWidget />

        <section className="space-y-8" aria-label="What each platform does">
          <header className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="text-gradient-jewel">Find out what each platform does</span>
            </h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Source · /docs roadmaps
            </span>
          </header>

          {PLATFORMS.map((p) => (
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
            <Link
              href="/brain"
              className="font-semibold text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline"
            >
              See the MSGF brand page →
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
