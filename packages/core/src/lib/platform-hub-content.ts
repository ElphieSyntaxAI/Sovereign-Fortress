/**
 * Platform chooser ("picker") copy — SSOT for apex hub + MSGF `/` landing.
 * Roadmap sources: docs/MSGF_V1_ROADMAP.md, docs/AUTHOR_ECOSYSTEM_ROADMAP.md,
 * docs/syntax-education/ROADMAP.md. Update when shipping milestones change.
 */

export const PLATFORM_HUB_ROADMAP_AS_OF = "2026-05-25";

export const ELPHIE_PRODUCT_HOSTS = {
  apex: "elphiesyntax.com",
  author: "authorecosystem.elphiesyntax.com",
  authorApi: "api.authorecosystem.elphiesyntax.com",
  msgf: "elphiesgatedai.elphiesyntax.com",
  education: "syntaxeducates.elphiesyntax.com",
} as const;

export type PlatformHubTone = "emerald" | "amethyst" | "topaz";
export type PlatformHubAvailability = "live" | "deploying" | "prelaunch";

export type PlatformHubRoadmapPhase = {
  label: string;
  status: string;
  highlights: readonly string[];
};

export type PlatformHubEntry = {
  id: "author" | "education" | "msgf";
  anchor: string;
  eyebrow: string;
  title: string;
  tagline: string;
  bullets: readonly string[];
  tone: PlatformHubTone;
  availability: PlatformHubAvailability;
  /** Shown on cards — e.g. "Phase 1 · Foundation" */
  roadmapHeadline: string;
  productionHost: string;
  roadmapDoc: string;
  phases: readonly PlatformHubRoadmapPhase[];
  prelaunch: boolean;
};

const AUTHOR_PHASES: readonly PlatformHubRoadmapPhase[] = [
  {
    label: "Phase 1 — Foundation (current)",
    status: "In flight · deploy-ready",
    highlights: [
      "Document ingest (MSGF V3.2) — uploads & Google Docs → wiki, outline, world bible",
      "HAL Ledger + MSGF Pulse bridge — token savings on Gated AI dashboard",
      "Manuscript hub, planning command center, Vault Pact registration",
      "Unified auth — Supabase + BFF on api.authorecosystem",
    ],
  },
  {
    label: "Phase 2 — Professionalization",
    status: "Next",
    highlights: [
      "Cool Down revision locks (4w / 6w / 8w tiers)",
      "Bicameral audit — Librarian + Critic revision reports",
      "Editor suite + Community Guild marketplace",
    ],
  },
  {
    label: "Phase 3 — Scaling & sovereignty",
    status: "Planned",
    highlights: [
      "Publisher Hub (anonymized WIP scouting)",
      "Multimedia vault + personality lore bots",
      "Growth analytics & graph comparison",
    ],
  },
];

const MSGF_PHASES: readonly PlatformHubRoadmapPhase[] = [
  {
    label: "V3.2-ULTRA — SWEEP · SHARD · DEFEND",
    status: "Shipped (ops)",
    highlights: [
      "Cold pgvector + hot Redis active slices on Pulse",
      "Shadow preflight + Vault/Hall cross-reference",
      "Ops heartbeat — tier batches, 6h/nightly heals, Hall purge",
    ],
  },
  {
    label: "CONVERGE · ARBITRATE",
    status: "Partial · active",
    highlights: [
      "Dual-model consensus on RED/critical paths",
      "Heal-queue human arbitration + circuit breaker after 3 failures",
      "Post-ingest healing console (web + Pulse Guard IDE)",
    ],
  },
  {
    label: "MSGF 1.0 GA",
    status: "RC · Stripe after test signoff",
    highlights: [
      "Standalone console at elphiesgatedai.elphiesyntax.com",
      "Embedded engine for Author + Education tenants",
      "BYOK multi-tenant API + contract licenses",
    ],
  },
];

const EDUCATION_PHASES: readonly PlatformHubRoadmapPhase[] = [
  {
    label: "Syntax Education 1.0 track",
    status: "Prelaunch",
    highlights: [
      "Layer A toolbox + Layer B AI allowance (grade-aware)",
      "Canvas LTI 1.3 + de-identified privacy gate",
      "Curriculum tree picker → resource_context_id slicing",
    ],
  },
  {
    label: "Classroom workflows",
    status: "Planned",
    highlights: [
      "Human Effort Certificate → SpeedGrader passback",
      "Socratic sandbox with district-approved slices",
      "Utah-aware policy templates",
    ],
  },
];

/** Static platform definitions (hosts are production defaults; override URLs at CTA build time). */
export const PLATFORM_HUB_ENTRIES: readonly PlatformHubEntry[] = [
  {
    id: "author",
    anchor: "author",
    eyebrow: "Sovereign · For writers & publishers",
    title: "Author Ecosystem",
    tagline:
      "Sovereign narrative infrastructure — document ingest into wiki & outline, HAL proof-of-authorship, Vault Pact NDA, and MSGF-gated revision intelligence.",
    bullets: [
      "Document ingest — scan → authorship → review → commit (wiki, outline, world bible)",
      "HAL Ledger — biometric proof linked to MSGF Pulse & token savings",
      "Vault Pact — zero-training, no-human-browsing contractual seal",
    ],
    tone: "amethyst",
    availability: "deploying",
    roadmapHeadline: "Phase 1 · Foundation — shipping to authorecosystem",
    productionHost: ELPHIE_PRODUCT_HOSTS.author,
    roadmapDoc: "docs/AUTHOR_ECOSYSTEM_ROADMAP.md",
    phases: AUTHOR_PHASES,
    prelaunch: false,
  },
  {
    id: "education",
    anchor: "education",
    eyebrow: "K–12 · LTI 1.3 · Utah-aware",
    title: "Syntax Education",
    tagline:
      "Socratic sandbox with grade-aware AI Allowance, district-approved curriculum slicing, and Canvas LTI 1.3 — on the shared MSGF brain, isolated by tenant.",
    bullets: [
      "Layered Workspace Control — Layer A toolbox · Layer B allowance",
      "Canvas LTI 1.3 + de-identified privacy gate (roadmap)",
      "Human Effort Certificate → SpeedGrader passback (planned)",
    ],
    tone: "topaz",
    availability: "prelaunch",
    roadmapHeadline: "Education 1.0 · Prelaunch",
    productionHost: ELPHIE_PRODUCT_HOSTS.education,
    roadmapDoc: "docs/syntax-education/ROADMAP.md",
    phases: EDUCATION_PHASES,
    prelaunch: true,
  },
  {
    id: "msgf",
    anchor: "msgf",
    eyebrow: "Brain · For developers & enterprise teams",
    title: "MSGF — Gated AI",
    tagline:
      "MSGF V3.2-ULTRA — stateful, self-defending orchestration. Six pillars, hot/cold storage, dual-model consensus, mandatory human tie-breaker on RED disagreement.",
    bullets: [
      "SWEEP → SHARD → DEFEND → CONVERGE → ARBITRATE → PERSIST",
      "Vault (positive) vs Hall (negative) on every Pulse",
      "RED immediate · YELLOW 6h · GREEN 24h tiered batching",
    ],
    tone: "emerald",
    availability: "live",
    roadmapHeadline: "MSGF 1.0 RC · V3.2-ULTRA on elphiesgatedai",
    productionHost: ELPHIE_PRODUCT_HOSTS.msgf,
    roadmapDoc: "docs/MSGF_V1_ROADMAP.md",
    phases: MSGF_PHASES,
    prelaunch: false,
  },
];

export function availabilityLabel(
  availability: PlatformHubAvailability
): string {
  switch (availability) {
    case "live":
      return "Live";
    case "deploying":
      return "Deploying";
    case "prelaunch":
      return "Coming soon";
  }
}

export function productionMapLine(): string {
  return `Production map: ${ELPHIE_PRODUCT_HOSTS.apex} → global hub · ${ELPHIE_PRODUCT_HOSTS.author} · ${ELPHIE_PRODUCT_HOSTS.education} · ${ELPHIE_PRODUCT_HOSTS.msgf}`;
}
