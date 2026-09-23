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

import { canAccessPrelaunchProducts } from "@/lib/prelaunch-product-access";
import { getAdminProductSurfaces } from "@/lib/admin-product-surfaces";

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
  localTestUrl?: string | null;
  localTestLabel?: string;
  tone: JewelTone;
};

const MSGF_APP_URL =
  process.env.NEXT_PUBLIC_MSGF_APP_URL || "https://elphiesgatedai.elphiesyntax.com";
const AUTHOR_APP_URL =
  process.env.NEXT_PUBLIC_AUTHOR_APP_URL ||
  process.env.AUTHOR_APP_URL?.trim() ||
  null;
const EDUCATION_APP_URL =
  process.env.NEXT_PUBLIC_EDUCATION_APP_URL ||
  process.env.EDUCATION_APP_URL?.trim() ||
  "https://syntaxeducates.elphiesyntax.com";

const PRODUCTS: ProductCard[] = [
  {
    id: "msgf",
    eyebrow: "AI gateway",
    title: "MSGF",
    tagline: "AI gateway with context governance",
    summary:
      "Six isolated policy domains, IDE verify, model routing and consensus, Sentry → Vault quarantine, Workspace SSO, SIEM, and optional post-quantum Vault envelopes.",
    bullets: [
      "Local prompt compiler + verify scripts / Safe Build + deploy gate",
      "Routing presets + three-model consensus on high drift",
      "Sentry quarantine · Workspace SSO · SIEM webhook on /admin/ops",
    ],
    detailHref: "/products/msgf",
    liveUrl: MSGF_APP_URL,
    liveLabel: "Open MSGF console",
    tone: "emerald",
  },
  {
    id: "author",
    eyebrow: "Authors · editors · publishers",
    title: "Author Ecosystem",
    tagline: "Protect the work, then perfect it",
    summary:
      "Manuscript workspace for authors: authorship attestation, no-training agreement (Vault Pact), revision cooldown, dual Librarian + Critic review, and a publisher discovery feed.",
    bullets: [
      "Phase 1 — authorship certificate, manuscript RAG, unified registration",
      "Phase 2 — revision cooldown, revision reports, editor suite",
      "Phase 3 — multimedia library, sales graphs, character lore bots",
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

      <footer className="relative mt-auto flex flex-col gap-2 pt-1">
        {product.liveUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={product.liveUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${tone.primaryButton}`}
            >
              {product.liveLabel}
              <span aria-hidden>↗</span>
            </a>
            {product.localTestUrl ? (
              <a
                href={product.localTestUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-600/50 px-4 py-2 text-sm font-medium transition hover:bg-white/5 ${tone.secondaryButton}`}
              >
                {product.localTestLabel ?? "Local dev"} ↗
              </a>
            ) : null}
          </div>
        ) : null}
        <Link
          href={product.detailHref}
          className="text-xs text-slate-500 hover:text-slate-300 hover:underline"
        >
          Find out more →
        </Link>
      </footer>
    </article>
  );
}

function productsForExplorer(canLaunch: boolean): ProductCard[] {
  if (!canLaunch) {
    return PRODUCTS.map((p) =>
      p.id === "author" ? { ...p, liveUrl: null, localTestUrl: null } : p
    );
  }

  const surfaces = getAdminProductSurfaces();
  const byId = new Map(surfaces.map((s) => [s.id, s]));

  return PRODUCTS.map((p) => {
    const surface = byId.get(p.id);
    if (!surface) return p;
    return {
      ...p,
      liveUrl: surface.testLaunch.href,
      liveLabel: surface.testLaunch.label,
      localTestUrl: surface.localTestLaunch?.href ?? null,
      localTestLabel: surface.localTestLaunch?.label,
    };
  });
}

export type ProductExplorerFilter = "all" | "sibling_products";

export async function ProductExplorerSection({
  filter = "all",
}: {
  /** `sibling_products` = Author + Education only (MSGF dashboard stays focused). */
  filter?: ProductExplorerFilter;
} = {}) {
  const canLaunch = await canAccessPrelaunchProducts();
  let products = productsForExplorer(canLaunch);
  if (filter === "sibling_products") {
    products = products.filter((p) => p.id !== "msgf");
  }

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
            <span className="text-gradient-jewel">
              {filter === "sibling_products" ? "Other Elphie Syntax products" : "Explore each surface"}
            </span>
          </h2>
          <p className="text-sm text-slate-400">
            {filter === "sibling_products"
              ? "MSGF is your governance engine on this dashboard. Author and Syntax Education are separate surfaces powered by the same brain."
              : canLaunch
                ? "Operator access: use Open buttons to test Author and Syntax Education. Everyone else sees roadmap details only."
                : "One brain (MSGF) powers the Author Ecosystem and Syntax Education. Open any product roadmap below."}
          </p>
        </div>
        <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:inline">
          Three surfaces · One MSGF brain
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCardTile key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
