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
 * Distribution Build ID: MSGF-6d594fa-20260519T162432Z-internal
 */
/**
 * Product family explorer — primary-dashboard launchpad for the three customer-facing
 * Elphie Syntax surfaces (per docs/MONOREPO_PRODUCTS.md).
 *
 * Jewel-tone mapping (kept in family with `--color-jewel-emerald` / `--color-jewel-purple`
 * and the existing dashboard accent palette):
 *   - MSGF Gated AI    → emerald (the engine; canonical green)
 *   - Author Ecosystem → amethyst / violet
 *   - Syntax Education → topaz / amber
 */
import Link from "next/link";

type JewelTone = "emerald" | "amethyst" | "topaz";

type ProductCard = {
  id: "msgf" | "author" | "education";
  eyebrow: string;
  title: string;
  tagline: string;
  summary: string;
  bullets: string[];
  detailHref: string;
  liveUrl: string | null;
  liveLabel: string;
  tone: JewelTone;
};

const MSGF_APP_URL =
  process.env.NEXT_PUBLIC_MSGF_APP_URL || "https://elphiesgatedai.elphiesyntax.com";
const AUTHOR_APP_URL = process.env.NEXT_PUBLIC_AUTHOR_APP_URL || null;
const EDUCATION_APP_URL =
  process.env.NEXT_PUBLIC_EDUCATION_APP_URL || "https://syntaxeducates.elphiesyntax.com";

const PRODUCTS: ProductCard[] = [
  {
    id: "msgf",
    eyebrow: "Brain · Engine",
    title: "MSGF — Gated AI",
    tagline: "Stateful, self-defending AI orchestration",
    summary:
      "MSGF V3.2-ULTRA: six isolated pillars, 1.1.1 genealogical lineage, Redis hot + Postgres cold, dual-model consensus, mandatory human tie-breaker on RED disagreement.",
    bullets: [
      "SWEEP → SHARD → DEFEND → CROSS-REF → CONVERGE → ARBITRATE → PERSIST",
      "Vault (positive) vs Hall (negative) cross-reference on every Pulse",
      "Tiered batching: RED immediate · YELLOW 6h · GREEN 24h",
    ],
    detailHref: "/products/msgf",
    liveUrl: MSGF_APP_URL,
    liveLabel: "Open MSGF console",
    tone: "emerald",
  },
  {
    id: "author",
    eyebrow: "Creative Integrity Flywheel",
    title: "Author Ecosystem",
    tagline: "From “Protecting the Work” to “Perfecting the Work”",
    summary:
      "Sovereign narrative infrastructure for authors. HAL Ledger biometric proof, Vault Pact zero-training NDA, Cool Down revision locks, bicameral Librarian + Critic audit, and the Publisher Hub anonymized scouting feed.",
    bullets: [
      "Phase 1 — HAL v2 Certificate, Author RAG, unified registration",
      "Phase 2 — Cool Down lock, revision reports, Editor Suite, Guild",
      "Phase 3 — Multimedia Vault, sales graphs, Personality Lore Bots",
    ],
    detailHref: "/products/author",
    liveUrl: AUTHOR_APP_URL,
    liveLabel: "Open Author dashboard",
    tone: "amethyst",
  },
  {
    id: "education",
    eyebrow: "K–12 · LTI 1.3 · Utah-aware",
    title: "Syntax Education",
    tagline: "Socratic sandbox with grade-aware AI Allowance",
    summary:
      "Layered Workspace Control: permanent grade-cohort toolbox (Layer A) + teacher-set AI Allowance regulator (Layer B). District-approved curriculum slicing, Canvas LTI 1.3, Human Effort Certificate, reading dependency triggers.",
    bullets: [
      "Phase 1 — ELA/History sandbox, The Call → P4, Socratic tutor, Canvas LTI",
      "Phase 2 — Math/Science gates, Google Workspace + MS 365 add-ons",
      "Phase 3 — K–3 print hub (H.B. 273), Citation Hall, state laboratory launch",
    ],
    detailHref: "/products/education",
    liveUrl: EDUCATION_APP_URL,
    liveLabel: "Open Education app",
    tone: "topaz",
  },
];

const TONE_STYLES: Record<
  JewelTone,
  {
    ring: string;
    eyebrow: string;
    title: string;
    badgeDot: string;
    primaryButton: string;
    secondaryButton: string;
    chipDot: string;
    accentGlow: string;
  }
> = {
  emerald: {
    ring: "border-emerald-500/25 hover:border-emerald-400/40",
    eyebrow: "text-emerald-300/85",
    title: "from-emerald-200 via-emerald-100 to-emerald-300",
    badgeDot: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]",
    primaryButton:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25",
    secondaryButton: "text-emerald-200/85 hover:text-emerald-100",
    chipDot: "bg-emerald-300/80",
    accentGlow: "from-emerald-500/10 via-transparent to-transparent",
  },
  amethyst: {
    ring: "border-violet-500/25 hover:border-violet-400/45",
    eyebrow: "text-violet-300/85",
    title: "from-violet-100 via-fuchsia-100 to-violet-300",
    badgeDot: "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.55)]",
    primaryButton:
      "border-violet-500/30 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25",
    secondaryButton: "text-violet-200/85 hover:text-violet-100",
    chipDot: "bg-violet-300/80",
    accentGlow: "from-violet-500/10 via-transparent to-transparent",
  },
  topaz: {
    ring: "border-amber-500/25 hover:border-amber-400/45",
    eyebrow: "text-amber-300/85",
    title: "from-amber-100 via-orange-100 to-amber-300",
    badgeDot: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]",
    primaryButton:
      "border-amber-500/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25",
    secondaryButton: "text-amber-200/85 hover:text-amber-100",
    chipDot: "bg-amber-300/80",
    accentGlow: "from-amber-500/10 via-transparent to-transparent",
  },
};

function ProductCardTile({ product }: { product: ProductCard }) {
  const tone = TONE_STYLES[product.tone];

  return (
    <article
      className={`glass-panel glass-panel-emerald relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-5 transition ${tone.ring}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90 ${tone.accentGlow}`}
        aria-hidden
      />

      <header className="relative space-y-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${tone.badgeDot}`} aria-hidden />
          <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${tone.eyebrow}`}>
            {product.eyebrow}
          </p>
        </div>
        <h3
          className={`bg-gradient-to-r bg-clip-text text-xl font-bold tracking-tight text-transparent ${tone.title}`}
        >
          {product.title}
        </h3>
        <p className="text-sm text-slate-300">{product.tagline}</p>
      </header>

      <p className="relative text-sm leading-relaxed text-slate-400">{product.summary}</p>

      <ul className="relative space-y-1.5 text-xs text-slate-300">
        {product.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone.chipDot}`}
              aria-hidden
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <footer className="relative mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <Link
          href={product.detailHref}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${tone.primaryButton}`}
        >
          Find out more
          <span aria-hidden>→</span>
        </Link>
        {product.liveUrl ? (
          <a
            href={product.liveUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={`text-xs font-medium underline-offset-4 hover:underline ${tone.secondaryButton}`}
          >
            {product.liveLabel} ↗
          </a>
        ) : null}
      </footer>
    </article>
  );
}

export function ProductExplorerSection() {
  return (
    <section
      aria-label="Elphie Syntax product family"
      className="glass-panel rounded-2xl border border-violet-500/15 p-5 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Elphie Syntax · Product family
          </p>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            <span className="text-gradient-jewel">Explore each surface</span>
          </h2>
          <p className="text-sm text-slate-400">
            One brain (MSGF) powers the Author Ecosystem and Syntax Education. Open any
            product&apos;s roadmap detail page below, or jump straight to its live dashboard.
          </p>
        </div>
        <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:inline">
          Three surfaces · One MSGF brain
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
          <ProductCardTile key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
