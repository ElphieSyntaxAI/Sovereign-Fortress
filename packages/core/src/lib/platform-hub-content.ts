/**
 * Platform chooser ("picker") copy — SSOT for apex hub + MSGF `/hub` landing.
 * Roadmap sources: docs/MSGF_V1_ROADMAP.md, docs/AUTHOR_ECOSYSTEM_ROADMAP.md,
 * docs/syntax-education/ROADMAP.md. Update when shipping milestones change.
 */

export const PLATFORM_HUB_ROADMAP_AS_OF = "2026-08-12";

export const ELPHIE_PRODUCT_HOSTS = {
  apex: "elphiesyntax.com",
  author: "authorecosystem.elphiesyntax.com",
  authorApi: "api.authorecosystem.elphiesyntax.com",
  msgf: "elphiesgatedai.elphiesyntax.com",
  education: "syntaxeducates.elphiesyntax.com",
} as const;

export type PlatformHubTone = "emerald" | "amethyst" | "topaz";

/** Shipped-stage labels for the public picker (Aug 2026). */
export type PlatformHubAvailability =
  | "beta_testing"
  | "foundational_testing"
  | "in_development";

export type PlatformHubRoadmapPhase = {
  label: string;
  status: string;
  highlights: readonly string[];
};

export type PlatformHubPrimaryCta = {
  label: string;
  /** Path on `productionHost` (leading `/`) or absolute https URL. */
  path: string;
};

/** Marketing-stage labels for public roadmap explorer cards. */
export type PlatformHypeFeatureStage =
  | "beta_live"
  | "shipped"
  | "foundational"
  | "in_development"
  | "coming_soon"
  | "vision";

export type PlatformHypeFeature = {
  id: string;
  title: string;
  tagline: string;
  stage: PlatformHypeFeatureStage;
  /** Optional category chip — e.g. "Governance", "Classroom" */
  category?: string;
  /** Path on `productionHost` or absolute https URL for live CTAs. */
  ctaPath?: string;
  ctaLabel?: string;
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
  hypeFeatures: readonly PlatformHypeFeature[];
  /** When true, primary CTA is hidden unless operator/prelaunch access. */
  prelaunch: boolean;
  primaryCta: PlatformHubPrimaryCta | null;
};

const AUTHOR_PHASES: readonly PlatformHubRoadmapPhase[] = [
  {
    label: "Phase 1 — Foundation (~78%)",
    status: "Foundational testing · live",
    highlights: [
      "Document ingest V3.2 (~90%) — Google Docs / uploads → wiki, outline, world bible",
      "Project switcher 100% — MS: nav dropdown, hub kanban, zero cross-book bleed",
      "HAL v2 certificate (~70%) — ML-DSA-65 proof bundles + Vault Seal export",
      "MSGF Pulse bridge (~90%) — Librarian & Critic via Shadow/Active; savings on author_ecosystem tenant",
      "Unified auth + Vault Pact registration on api.authorecosystem + authorecosystem client",
    ],
  },
  {
    label: "Phase 2 — Professionalization (~42%)",
    status: "Next · immediate focus",
    highlights: [
      "Cool Down locks (~70%) — 4w / 6w / 8w tiers + verify-result unlock",
      "Bicameral audit (~50%) — Librarian logic + Critic sensitivity revision dossiers",
      "Editor suite (~30%) — HAL scores, revision history, deploy-gate advisory",
      "Community Guild (~10%) — verified translators, artists, voice actors",
    ],
  },
  {
    label: "Phase 3 — Scaling & sovereignty (~5%)",
    status: "Planned",
    highlights: [
      "Publisher Hub — anonymized WIP scouting with HAL scores (no IP exposure)",
      "Personality lore bots (~15%) — character RAG for fans, non-spoiler boundaries",
      "Multimedia vault + graph comparison — Patreon-style content × sales analytics",
      "Author growth tracking — vocabulary & craft analytics over your career arc",
    ],
  },
];

const MSGF_PHASES: readonly PlatformHubRoadmapPhase[] = [
  {
    label: "V3.2-ULTRA — SWEEP · SHARD · DEFEND",
    status: "Shipped · ops",
    highlights: [
      "Cold pgvector + hot Redis active slices on Pulse",
      "Shadow Proxy + Active Governance at /api/v1",
      "Ops heartbeat — tier batches, bug inbox, Hall purge",
    ],
  },
  {
    label: "CONVERGE · ARBITRATE · TRI",
    status: "Beta · active",
    highlights: [
      "TRI majority (Claude + Gemini + Grok when enabled)",
      "Heal-queue human arbitration + Sentinel bug FAB",
      "Free 7-day Shadow Proxy trial + email savings report",
    ],
  },
  {
    label: "MSGF 1.0 GA",
    status: "Beta testing → RC",
    highlights: [
      "Standalone console at elphiesgatedai.elphiesyntax.com",
      "Stripe entitlements + DocuSign / Dropbox Sign gates",
      "Embedded engine for Author + Education tenants",
    ],
  },
];

const EDUCATION_PHASES: readonly PlatformHubRoadmapPhase[] = [
  {
    label: "Syntax Education 1.0 track (~84% code)",
    status: "In development",
    highlights: [
      "Layer A toolbox + Layer B AI allowance (grade-aware)",
      "Utah S.B. 149 / H.B. 273 gates + teacher lesson builder",
      "Google Classroom OAuth + Docs add-on scaffold",
    ],
  },
  {
    label: "Classroom workflows (~72% Phase 2)",
    status: "Coding",
    highlights: [
      "Parent dashboard · reading gate · Citation Hall",
      "Canvas LTI 1.3 routes (secondary smoke)",
      "Human Effort Certificate → Classroom grade stub",
    ],
  },
  {
    label: "District soak + launch",
    status: "Not open yet",
    highlights: [
      "Live migrations / OAuth / Docs soak",
      "syntaxeducates.elphiesyntax.com host",
      "District curriculum RAG soak",
    ],
  },
];

const AUTHOR_HYPE: readonly PlatformHypeFeature[] = [
  {
    id: "ingest-v32",
    title: "Document ingest V3.2",
    tagline:
      "Google Docs & uploads → authorship Q&A → review → commit into wiki, outline, and world bible. Dual-disagree triggers T3 HITL + verify fail — no silent lore drift.",
    stage: "foundational",
    category: "Ingest · ~90%",
    ctaPath: "/beta",
    ctaLabel: "Join foundational testing",
  },
  {
    id: "project-switcher",
    title: "Project switcher & manuscript hub",
    tagline:
      "MS: nav dropdown + hub kanban — activate with manuscriptId / tenantId / seriesId. Outline, wiki, and drafting remount per book. Shipped 100%.",
    stage: "shipped",
    category: "Workspace",
    ctaPath: "/beta",
    ctaLabel: "Request access",
  },
  {
    id: "hal-v2-cert",
    title: "HAL v2 authorship certificate",
    tagline:
      "Exportable proof bundle with Vault Seal + Lore-Git chain. ML-DSA-65 (FIPS 204) over RFC 8785 JSON when MSGF_HAL_PQC_SIGN=1 — defend Chain of Origin.",
    stage: "foundational",
    category: "Sovereignty · ~70%",
  },
  {
    id: "vault-pact",
    title: "Vault Pact zero-training seal",
    tagline:
      "Bilateral NDA: no model training, no human browsing. Optional Hybrid KEM attestation envelope on registration — contractual data sovereignty.",
    stage: "foundational",
    category: "Legal",
    ctaPath: "/vault-pact",
    ctaLabel: "Read Vault Pact",
  },
  {
    id: "msgf-pulse-bridge",
    title: "MSGF Pulse bridge",
    tagline:
      "HAL chunk-pulse → Gated AI routing with x-msgf-converge-tier. Token savings visible on elphiesgatedai for tenant author_ecosystem — same brain as MSGF beta.",
    stage: "foundational",
    category: "Governance · ~90%",
  },
  {
    id: "shadow-active-librarian",
    title: "Shadow/Active Librarian & Critic",
    tagline:
      "~85% MSGF governance adoption — revision intelligence through /api/v1 gateway, verify-result on unlock/commit, quarantine ops links when drift spikes.",
    stage: "foundational",
    category: "Bicameral prep",
  },
  {
    id: "author-rag-sidekick",
    title: "Author RAG sidekick",
    tagline:
      "Continuity and outline adherence assistant — OpenAI via MSGF gateway when governance mode ≠ off. Lore-Git Vault retrieval, not generic chat.",
    stage: "foundational",
    category: "Intelligence · ~75%",
  },
  {
    id: "planning-command-center",
    title: "Planning command center",
    tagline:
      "Manuscript hub kanban, word-count + outline percentage tracking, series-scoped RAG share for multi-book sagas — one sovereign command surface.",
    stage: "foundational",
    category: "Planning",
  },
  {
    id: "cool-down-locks",
    title: "Cool Down revision locks",
    tagline:
      "4w / 6w / 8w lock tiers + 24h planning-sync cooldown. Read-only state gate forces professional distance — unlock posts MSGF verify-result (~70% built).",
    stage: "coming_soon",
    category: "Workflow · Phase 2",
  },
  {
    id: "bicameral-audit",
    title: "Bicameral audit reports",
    tagline:
      "Librarian (logic) + Critic (sensitivity) revision dossiers — continuity, plot holes, market appeal with MSGF drift scoring (~50% built).",
    stage: "coming_soon",
    category: "Publisher proof",
  },
  {
    id: "editor-suite",
    title: "Editor suite & deploy-gate",
    tagline:
      "Human editor dashboard with HAL scores and revision history. Optional MSGF_AUTHOR_REQUIRE_DEPLOY_GATE advisory before manuscript handoff (~30%).",
    stage: "coming_soon",
    category: "Collaboration",
  },
  {
    id: "community-guild",
    title: "Community Guild marketplace",
    tagline:
      "Verified translators, artists, and voice actors inside Vault Pact boundaries — Tier 2+ guild access levels (~10% scaffold).",
    stage: "coming_soon",
    category: "Marketplace",
  },
  {
    id: "author-tiers",
    title: "Five author tiers (Free → $199.99)",
    tagline:
      "Tier 1 HAL-only → Tier 5 with 20 WIP, 7 lore bots, automated sales tracking, and courses. WIP caps and guild levels scale with subscription.",
    stage: "foundational",
    category: "Pricing SSOT",
    ctaPath: "/beta",
    ctaLabel: "Join waitlist",
  },
  {
    id: "publisher-keys",
    title: "Four publisher encryption keys",
    tagline:
      "Level 1 HAL average (free) → Level 4 full forensic audit trail. Publishers buy proof depth without seeing your manuscript until you opt into discovery.",
    stage: "vision",
    category: "Publisher Hub",
  },
  {
    id: "publisher-hub",
    title: "Publisher Hub scouting",
    tagline:
      "STATE_DISCOVERY — anonymized WIP feed with HAL scores, blurbs, and genre. Proof-based scouting; your identity stays sealed until you choose exposure.",
    stage: "vision",
    category: "Discovery",
  },
  {
    id: "lore-bots-multimedia",
    title: "Lore bots + multimedia vault",
    tagline:
      "Character-specific RAG for fan interaction (non-spoiler). Patreon-style video/audio vault with graph comparison vs sales data — Phase 3 horizon.",
    stage: "vision",
    category: "Scale",
  },
];

const MSGF_HYPE: readonly PlatformHypeFeature[] = [
  {
    id: "shadow-trial-7d",
    title: "Free 7-day Shadow Proxy trial",
    tagline:
      "Up to 7 days of live proof — clock starts on first call. Then start 3-day Individual Pro full access before you buy.",
    stage: "beta_live",
    category: "Try it now",
    ctaPath: "/shadow-trial",
    ctaLabel: "Start free trial",
  },
  {
    id: "tri-converge",
    title: "TRI majority CONVERGE",
    tagline:
      "Claude + Gemini + Grok when enabled — Big Brain majority on high drift, heal-queue human arbitration.",
    stage: "beta_live",
    category: "Consensus",
    ctaPath: "/sign-up",
    ctaLabel: "Join beta",
  },
  {
    id: "pulse-guard",
    title: "Pulse Guard IDE verify",
    tagline:
      "0-token prompt optimizer, Run Scripts, Safe Build — verify-result → Vault, repeated fail → Hall.",
    stage: "beta_live",
    category: "IDE",
    ctaPath: "/sign-up",
    ctaLabel: "Join beta",
  },
  {
    id: "sentinel-inbox",
    title: "Sentinel bug FAB + inbox",
    tagline:
      "Floating report button routes to operator bug inbox — Sentry issues quarantine to Vault, not silent Hall.",
    stage: "shipped",
    category: "Ops",
  },
  {
    id: "esign-gates",
    title: "DocuSign / Dropbox Sign gates",
    tagline:
      "Team invites and webhook queue — contractual onboarding before console seats go live.",
    stage: "shipped",
    category: "Integrations",
  },
  {
    id: "hybrid-pq-vault",
    title: "Quantum-ready hybrid vault",
    tagline:
      "Hybrid KEM (X25519 + ML-KEM-768) envelopes + HAL v2 ML-DSA-65 when flags enabled — harvest-now-decrypt-later resistant.",
    stage: "shipped",
    category: "Security",
  },
  {
    id: "shadow-proxy-gateway",
    title: "Shadow Proxy / Active gateway",
    tagline:
      "OpenAI + Anthropic compatible /api/v1 — prove savings in Shadow mode, enforce governance in Active.",
    stage: "beta_live",
    category: "Gateway",
    ctaPath: "/shadow-trial",
    ctaLabel: "Try Shadow Proxy",
  },
  {
    id: "governance-audit-platform",
    title: "Governance audit platform",
    tagline:
      "Audit hub, Session Replay + harm HITL, most-used rankings, model fitness, diff impact, budgets, and SIEM export on /admin/ops.",
    stage: "shipped",
    category: "Compliance",
    ctaPath: "/admin/ops",
    ctaLabel: "Open ops",
  },
  {
    id: "stripe-entitlements",
    title: "Stripe entitlements + team seats",
    tagline:
      "Checkout code for $99 Pro perpetual and $49/user/mo Startup Team — flip mock off after live smoke on elphiesgatedai.",
    stage: "beta_live",
    category: "Billing",
    ctaPath: "/pricing",
    ctaLabel: "See pricing",
  },
  {
    id: "workspace-sso",
    title: "Workspace SSO + company domains",
    tagline:
      "Google Workspace SSO, domain allowlists, signed ARBITRATE audits — configure when going live.",
    stage: "shipped",
    category: "Enterprise",
  },
];

const EDUCATION_HYPE: readonly PlatformHypeFeature[] = [
  {
    id: "layer-ab-workspace",
    title: "Layer A toolbox + Layer B allowance",
    tagline:
      "Grade-aware AI sandbox — Socratic Layer A tools with metered Layer B assistance teachers control per lesson.",
    stage: "in_development",
    category: "Workspace",
  },
  {
    id: "utah-policy-gates",
    title: "Utah S.B. 149 / H.B. 273 gates",
    tagline:
      "Policy-aware curriculum slicing — district-approved content only, with audit trails for compliance reviewers.",
    stage: "in_development",
    category: "Governance",
  },
  {
    id: "lesson-builder",
    title: "Teacher lesson builder",
    tagline:
      "Compose assignments with resource slices, reading gates, and human-effort certificates — one board for the class.",
    stage: "in_development",
    category: "Classroom",
  },
  {
    id: "classroom-oauth",
    title: "Google Classroom OAuth",
    tagline:
      "Roster sync + grade stub hooks — Classroom as source of truth while MSGF brain stays tenant-isolated.",
    stage: "in_development",
    category: "Integrations",
  },
  {
    id: "hec-certificate",
    title: "Human Effort Certificate",
    tagline:
      "Prove student authorship before AI assistance counts — Classroom grade stub when effort threshold met.",
    stage: "coming_soon",
    category: "Integrity",
  },
  {
    id: "canvas-lti",
    title: "Canvas LTI 1.3 launch",
    tagline:
      "Secondary LMS path — deep-link into Layer A/B workspace with district curriculum RAG behind the gate.",
    stage: "coming_soon",
    category: "Integrations",
  },
  {
    id: "parent-dashboard",
    title: "Parent dashboard + reading gate",
    tagline:
      "Guardian visibility into assignments and reading progress — Citation Hall for source transparency.",
    stage: "coming_soon",
    category: "Family",
  },
  {
    id: "district-rag-soak",
    title: "District curriculum RAG soak",
    tagline:
      "Live migrations, OAuth, and Docs add-on production soak — syntaxeducates host when districts are ready.",
    stage: "vision",
    category: "Launch",
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
      "Sovereign narrative infrastructure — document ingest into wiki & outline, HAL proof-of-authorship, Vault Pact NDA, MSGF-gated Librarian & Critic, and Cool Down locks on the Phase 2 path. ~48% overall across three phases; foundational testing on authorecosystem.",
    bullets: [
      "Phase 1 ~78% — ingest (~90%), project switcher (100%), HAL cert, MSGF Pulse bridge",
      "Phase 2 ~42% — Cool Down locks, bicameral audit, editor suite, Community Guild",
      "Five tiers Free → $199.99 · Publisher Hub discovery on the Phase 3 horizon",
    ],
    tone: "amethyst",
    availability: "foundational_testing",
    roadmapHeadline: "Creative Integrity Flywheel · Phase 1 ~78% · foundational testing",
    productionHost: ELPHIE_PRODUCT_HOSTS.author,
    roadmapDoc: "docs/AUTHOR_ECOSYSTEM_ROADMAP.md",
    phases: AUTHOR_PHASES,
    hypeFeatures: AUTHOR_HYPE,
    prelaunch: false,
    primaryCta: { label: "Join foundational testing", path: "/beta" },
  },
  {
    id: "education",
    anchor: "education",
    eyebrow: "K–12 · LTI 1.3 · Utah-aware",
    title: "Syntax Education",
    tagline:
      "Socratic sandbox with grade-aware AI Allowance and district-approved curriculum slicing — on the shared MSGF brain, isolated by tenant. Code ~78% of full roadmap; host and public registration still in development.",
    bullets: [
      "Vite shell + lessons, board, curriculum, governance UI wired in repo",
      "Classroom OAuth + Docs add-on need production env soak",
      "Public host syntaxeducates.elphiesyntax.com — not open for signup yet",
    ],
    tone: "topaz",
    availability: "in_development",
    roadmapHeadline: "Education 1.0 · In development (~78% code complete)",
    productionHost: ELPHIE_PRODUCT_HOSTS.education,
    roadmapDoc: "docs/syntax-education/ROADMAP.md",
    phases: EDUCATION_PHASES,
    hypeFeatures: EDUCATION_HYPE,
    prelaunch: true,
    primaryCta: null,
  },
  {
    id: "msgf",
    anchor: "msgf",
    eyebrow: "Prefrontal cortex · For developers & enterprise teams",
    title: "MSGF — Gated AI",
    tagline:
      "Prefrontal cortex for AI — MSGF V3.2-ULTRA on elphiesgatedai. Six pillars, Shadow Proxy proof mode, TRI consensus, governance audit hub, and operator ops — beta testing now with waitlist for console seats.",
    bullets: [
      "Shadow Proxy / Active Governance — /api/v1 OpenAI + Anthropic gateway",
      "Free 7-day Shadow Proxy trial — live savings + email report, then 3-day Pro",
      "Beta console — Pulse Guard, dashboard, admin ops on elphiesgatedai",
    ],
    tone: "emerald",
    availability: "beta_testing",
    roadmapHeadline: "MSGF 1.0 · Beta testing on elphiesgatedai",
    productionHost: ELPHIE_PRODUCT_HOSTS.msgf,
    roadmapDoc: "docs/MSGF_V1_ROADMAP.md",
    phases: MSGF_PHASES,
    hypeFeatures: MSGF_HYPE,
    prelaunch: false,
    primaryCta: { label: "Join beta", path: "/sign-up" },
  },
];

export function platformHubEntryById(
  id: PlatformHubEntry["id"]
): PlatformHubEntry | undefined {
  return PLATFORM_HUB_ENTRIES.find((e) => e.id === id);
}

export function hypeFeatureStageLabel(stage: PlatformHypeFeatureStage): string {
  switch (stage) {
    case "beta_live":
      return "Beta · live now";
    case "shipped":
      return "Shipped";
    case "foundational":
      return "Foundational testing";
    case "in_development":
      return "In development";
    case "coming_soon":
      return "Coming soon";
    case "vision":
      return "On the horizon";
  }
}

/** Resolve a hype-feature CTA against production hosts (beta stays on live domains). */
export function hypeFeatureCtaUrl(
  entry: PlatformHubEntry,
  feature: PlatformHypeFeature
): string | null {
  if (!feature.ctaPath?.trim()) return null;
  const path = feature.ctaPath.trim();
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `https://${entry.productionHost}${normalized}`;
}

export function availabilityLabel(
  availability: PlatformHubAvailability
): string {
  switch (availability) {
    case "beta_testing":
      return "Beta testing";
    case "foundational_testing":
      return "Foundational testing";
    case "in_development":
      return "In development";
  }
}

export function platformPrimaryCtaUrl(entry: PlatformHubEntry): string | null {
  if (!entry.primaryCta) return null;
  const path = entry.primaryCta.path.trim();
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `https://${entry.productionHost}${normalized}`;
}

export function productionMapLine(): string {
  return `Production map: ${ELPHIE_PRODUCT_HOSTS.apex} → picker · ${ELPHIE_PRODUCT_HOSTS.author} · ${ELPHIE_PRODUCT_HOSTS.education} · ${ELPHIE_PRODUCT_HOSTS.msgf}`;
}

/** Intro blurb for picker hero — keep in sync with PLATFORM_HUB_ENTRIES availability. */
export function platformHubIntroBlurb(): string {
  return "Three surfaces, one shared MSGF brain. MSGF is in beta testing on elphiesgatedai; Author Ecosystem is in foundational testing on authorecosystem; Syntax Education is still being coded.";
}
