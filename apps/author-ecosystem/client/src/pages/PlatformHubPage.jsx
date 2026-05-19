import { Link } from "react-router-dom";

/**
 * elphiesyntax.com home — "What are you looking for?" platform chooser.
 *
 * Replaces the old login-first landing so first-time visitors can:
 *   1. Pick the platform that fits how they build
 *   2. Read what each platform actually does (jump anchor to a detail block)
 *   3. Enter the live surface — or sign in to the author dashboard hosted here
 *
 * Jewel-tone palette stays in family with the MSGF dashboard / product family
 * (emerald · amethyst-violet · topaz-amber on slate / `landing-mesh` chrome).
 */

const AUTHOR_HOST = import.meta.env.VITE_AUTHOR_APP_URL || "";
const GATED_AI_HOST =
  import.meta.env.VITE_MSGF_APP_URL || "https://elphiesgatedai.elphiesyntax.com";
const EDUCATION_HOST =
  import.meta.env.VITE_EDUCATION_APP_URL || "https://syntaxeducates.elphiesyntax.com";

function isApexHubHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "elphiesyntax.com" || host === "www.elphiesyntax.com";
}

function getAuthorPrimaryTarget() {
  if (AUTHOR_HOST) {
    return { to: AUTHOR_HOST, external: true };
  }
  if (isApexHubHost()) {
    return { to: "https://authorecosystem.elphiesyntax.com", external: true };
  }
  // Keep Cloud Run/default test URLs on the current Author app.
  return { to: "/sign-in", external: false };
}

const PLATFORMS = [
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
      to: AUTHOR_HOST,
      external: true,
    },
    learnMoreHref: `${GATED_AI_HOST}/products/author`,
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
      to: EDUCATION_HOST,
      external: true,
    },
    learnMoreHref: `${GATED_AI_HOST}/products/education`,
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
      label: "Open MSGF console",
      to: GATED_AI_HOST,
      external: true,
    },
    learnMoreHref: `${GATED_AI_HOST}/products/msgf`,
  },
];

const TONE = {
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

const HUB_MESH = {
  backgroundColor: "#0a0612",
  backgroundImage: [
    "radial-gradient(ellipse 80% 50% at 18% -10%, rgba(16, 185, 129, 0.22), transparent 55%)",
    "radial-gradient(ellipse 70% 45% at 85% 12%, rgba(168, 85, 247, 0.28), transparent 50%)",
    "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(245, 158, 11, 0.18), transparent 50%)",
  ].join(", "),
};

const GLASS_PANEL_STYLE = {
  background: "rgba(15, 23, 42, 0.45)",
  border: "1px solid rgba(167, 139, 250, 0.22)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};

function PrimaryCta({ platform }) {
  const styles = TONE[platform.tone];
  const className = `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${styles.primary}`;
  const primary =
    platform.id === "author"
      ? { ...platform.primary, ...getAuthorPrimaryTarget() }
      : platform.primary;
  if (primary.external) {
    return (
      <a
        href={primary.to}
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
    <Link to={primary.to} className={className}>
      {primary.label}
      <span aria-hidden>→</span>
    </Link>
  );
}

function QuickCard({ platform }) {
  const styles = TONE[platform.tone];
  return (
    <article
      style={GLASS_PANEL_STYLE}
      className={`flex flex-col gap-4 rounded-2xl border p-5 transition ${styles.ring}`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${styles.chipDot}`} aria-hidden />
        <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${styles.eyebrow}`}>
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
        <PrimaryCta platform={platform} />
      </div>
    </article>
  );
}

function DetailSection({ platform }) {
  const styles = TONE[platform.tone];
  return (
    <section
      id={platform.anchor}
      className={`scroll-mt-24 rounded-3xl border p-6 sm:p-8 ${styles.sectionAccent}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-1">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${styles.eyebrow}`}>
            {platform.eyebrow}
          </p>
          <h2
            className={`bg-gradient-to-r bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl ${styles.titleGradient}`}
          >
            {platform.title}
          </h2>
        </div>
        <PrimaryCta platform={platform} />
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200 sm:text-base">
        {platform.tagline}
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {platform.bullets.map((bullet) => (
          <li
            key={bullet}
            style={GLASS_PANEL_STYLE}
            className="rounded-2xl border border-slate-700/60 p-4 text-sm text-slate-200"
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
        <a
          href={platform.learnMoreHref}
          target="_blank"
          rel="noreferrer noopener"
          className={`font-medium underline-offset-4 hover:underline ${styles.secondary}`}
        >
          Read the {platform.title} roadmap ↗
        </a>
      </p>
    </section>
  );
}

export default function PlatformHubPage() {
  return (
    <div className="min-h-screen text-slate-100" style={HUB_MESH}>
      <header className="border-b border-violet-500/10 bg-slate-950/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/brand/elphie-syntax-logo.png"
              alt=""
              aria-hidden
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-xl border border-emerald-400/30 bg-emerald-500/10 object-contain"
            />
            <span className="text-sm font-semibold tracking-tight text-slate-100">
              Elphie Syntax
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-xs">
            <Link
              to="/sign-in"
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

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
            <span
              className="bg-gradient-to-r bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #6ee7b7 0%, #c4b5fd 45%, #a855f7 100%)",
              }}
            >
              What are you looking for?
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Three surfaces, one shared MSGF brain. Pick the platform that fits how you
            build — or how you learn — and we&apos;ll take you straight to it.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-3" aria-label="Pick a platform">
          {PLATFORMS.map((p) => (
            <QuickCard key={p.id} platform={p} />
          ))}
        </section>

        <section className="space-y-8" aria-label="What each platform does">
          <header className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span
                className="bg-gradient-to-r bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #6ee7b7 0%, #c4b5fd 45%, #a855f7 100%)",
                }}
              >
                Find out what each platform does
              </span>
            </h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Source · /docs roadmaps
            </span>
          </header>

          {PLATFORMS.map((p) => (
            <DetailSection key={p.id} platform={p} />
          ))}
        </section>

        <section className="text-center">
          <p className="text-sm text-slate-400">
            Already have an Elphie Syntax author account?{" "}
            <Link
              to="/sign-in"
              className="font-semibold text-emerald-300 underline-offset-4 hover:text-emerald-200 hover:underline"
            >
              Sign in here →
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-violet-500/10 bg-slate-950/40 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Elphie Syntax LLC. All rights reserved.</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Link to="/terms" className="text-emerald-400/85 underline-offset-4 hover:underline">
            Terms &amp; Conditions
          </Link>
          <span className="text-slate-700">·</span>
          <Link to="/nda" className="text-emerald-400/85 underline-offset-4 hover:underline">
            NDAs
          </Link>
          <span className="text-slate-700">·</span>
          <Link to="/vault-pact" className="text-emerald-400/85 underline-offset-4 hover:underline">
            Vault Pact
          </Link>
          <span className="text-slate-700">·</span>
          <a
            href={GATED_AI_HOST}
            target="_blank"
            rel="noreferrer noopener"
            className="text-violet-400/85 underline-offset-4 hover:underline"
          >
            MSGF Gated AI ↗
          </a>
        </p>
      </footer>
    </div>
  );
}
