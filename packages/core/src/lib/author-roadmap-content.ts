/**
 * Author Ecosystem roadmap deep content — SSOT for public roadmap pages.
 * Companion: docs/author-ecosystem/AUTHOR_ECOSYSTEM_ROADMAP.md · picker: platform-hub-content.ts
 */

export const AUTHOR_ROADMAP_AS_OF = "2026-08-12";

export type AuthorProgressPulse = {
  label: string;
  percent: number;
  hint: string;
};

export type AuthorLexiconEntry = {
  term: string;
  definition: string;
  impact: string;
};

export type AuthorTierRow = {
  tier: string;
  price: string;
  capabilities: string;
};

export type AuthorPublisherKeyRow = {
  level: string;
  scope: string;
};

export type AuthorFlywheelStep = {
  phase: string;
  headline: string;
  body: string;
};

export type AuthorPhaseDetailRow = {
  feature: string;
  description: string;
  percent: number;
};

export type AuthorMsgfState = {
  state: string;
  meaning: string;
};

/** Weighted progress from docs/author-ecosystem/AUTHOR_ECOSYSTEM_ROADMAP.md §0 */
export const AUTHOR_PROGRESS_PULSE: readonly AuthorProgressPulse[] = [
  {
    label: "Phase 1 — Foundation",
    percent: 78,
    hint: "Ingest, project switcher, HAL bridge, MSGF governance wires",
  },
  {
    label: "Phase 2 — Professionalization",
    percent: 42,
    hint: "Revision cooldown, dual review, editor suite, guild",
  },
  {
    label: "Phase 3 — Scaling & discovery",
    percent: 5,
    hint: "Publisher Hub, multimedia vault, lore bots, growth analytics",
  },
  {
    label: "Overall (Phases 1–3)",
    percent: 48,
    hint: "Weighted toward Phase 1 on authorecosystem",
  },
  {
    label: "MSGF governance adoption",
    percent: 85,
    hint: "Shadow/Active gateway, verify-result, quarantine ops links",
  },
];

export const AUTHOR_FLYWHEEL: readonly AuthorFlywheelStep[] = [
  {
    phase: "Protect",
    headline: "Protect the work first",
    body:
      "Vault Pact (no-training agreement), authorship attestation, and manuscript isolation — your IP never trains a model and never gets human-browsed without contract.",
  },
  {
    phase: "Ingest",
    headline: "Planning docs become lore",
    body:
      "Google Docs & uploads → wiki, outline, world bible via MSGF V3.2 ingest — authorship Q&A, dual-disagree HITL, sync_msgf_brain when Pulse is ready.",
  },
  {
    phase: "Govern",
    headline: "MSGF as AI gateway",
    body:
      "Librarian + Critic route through shadow / enforcement — token cost visible on elphiesgatedai, verify-result on commit and unlock.",
  },
  {
    phase: "Perfect",
    headline: "Professional distance",
    body:
      "Revision cooldown forces professional distance; dual Librarian + Critic receipts give publishers a logic audit — from WIP to discovery without exposing identity early.",
  },
];

export const AUTHOR_LEXICON: readonly AuthorLexiconEntry[] = [
  {
    term: "HAL Ledger",
    definition: "Human Authorship Ledger — rhythm telemetry and interaction proof (authorship attestation).",
    impact: "Chain of Origin for copyright defense.",
  },
  {
    term: "Vault Pact",
    definition: "Bilateral NDA enforcing no model training and no human browsing of tenant content.",
    impact: "Contractual no-training agreement — Hybrid KEM seal when enabled.",
  },
  {
    term: "Revision cooldown",
    definition: "Mandatory read-only period after a draft is finished (4w / 6w / 8w tiers + 24h planning-sync gate).",
    impact: "Professional revision distance; unlock posts MSGF verify-result.",
  },
  {
    term: "Dual review",
    definition: "Librarian (logic) + Critic (sensitivity) dual-model revision dossier.",
    impact: "Publisher-ready logic audit receipt.",
  },
  {
    term: "Active Project",
    definition: "Scoped manuscriptId + tenantId + optional seriesId — no cross-book bleed.",
    impact: "Wiki, outline, drafting, and HAL bind to one book at a time.",
  },
  {
    term: "Series RAG share",
    definition: "Sibling manuscripts in the same series may share lore retrieval.",
    impact: "Continuity within a series — never across unrelated books.",
  },
  {
    term: "Publisher Hub",
    definition: "Anonymized WIP feed with HAL scores, blurbs, and genre tags.",
    impact: "Proof-based scouting without IP exposure.",
  },
];

export const AUTHOR_TIERS: readonly AuthorTierRow[] = [
  { tier: "Tier 1 (Free)", price: "—", capabilities: "Extension + HAL + 1 WIP" },
  {
    tier: "Tier 2",
    price: "$29.99/mo",
    capabilities: "Dashboard + 2 WIP + Guild access (Level 1 editors)",
  },
  {
    tier: "Tier 3",
    price: "$79.99/mo",
    capabilities: "5 WIP + 1 Lore Bot + Guild access (Level 2 editors)",
  },
  {
    tier: "Tier 4",
    price: "$109.99/mo",
    capabilities: "10 WIP + 3 Lore Bots + manual sales tracking + video (3–5)",
  },
  {
    tier: "Tier 5",
    price: "$199.99/mo",
    capabilities: "20 WIP + 7 Lore Bots + automated sales + courses",
  },
];

export const AUTHOR_PUBLISHER_KEYS: readonly AuthorPublisherKeyRow[] = [
  { level: "Level 1", scope: "Core HAL average (Free)" },
  { level: "Level 2", scope: "Chapter-level timestamps and general metrics" },
  { level: "Level 3", scope: "In-depth session-level audit trail" },
  { level: "Level 4", scope: "Full forensic audit trail (max detail)" },
];

export const AUTHOR_PHASE_1_DETAIL: readonly AuthorPhaseDetailRow[] = [
  {
    feature: "Document ingest (MSGF V3.2)",
    description: "Uploads & Google Docs → wiki, outline, world bible; T3 HITL on dual-disagree.",
    percent: 90,
  },
  {
    feature: "Project switcher (nav + hub)",
    description: "MS: dropdown, kanban activate, per-book remount — series RAG share retained.",
    percent: 100,
  },
  {
    feature: "HAL v2 certificate",
    description: "Exportable proof bundle + Vault Seal; ML-DSA-65 when MSGF_HAL_PQC_SIGN=1.",
    percent: 70,
  },
  {
    feature: "MSGF Pulse bridge",
    description: "Authorship telemetry → MSGF routing; token cost on tenant_id=author_ecosystem.",
    percent: 90,
  },
  {
    feature: "MSGF governance (shadow / enforcement)",
    description: "Librarian + Critic gateway, verify-result, deploy-gate advisory, quarantine links.",
    percent: 85,
  },
  {
    feature: "Author RAG sidekick",
    description: "Continuity and outline adherence via MSGF gateway when mode ≠ off.",
    percent: 75,
  },
  {
    feature: "Unified registration",
    description: "Atomic Auth + Profile + Pact + optional Hybrid KEM attestation envelope.",
    percent: 70,
  },
];

export const AUTHOR_PHASE_2_DETAIL: readonly AuthorPhaseDetailRow[] = [
  {
    feature: "Revision cooldown",
    description: "Read-only state gate; timer unlocks post MSGF verify-result.",
    percent: 70,
  },
  {
    feature: "Revision reports",
    description: "Continuity, plot holes, market appeal — Critic via MSGF gateway.",
    percent: 50,
  },
  {
    feature: "Editor suite",
    description: "Human editor dashboard; HAL scores + optional deploy-gate.",
    percent: 30,
  },
  {
    feature: "Community Guild",
    description: "Verified translators, artists, voice actors marketplace.",
    percent: 10,
  },
];

export const AUTHOR_PHASE_3_DETAIL: readonly AuthorPhaseDetailRow[] = [
  {
    feature: "Author growth tracking",
    description: "Vocabulary and craft analytics over time.",
    percent: 5,
  },
  {
    feature: "Multimedia vault",
    description: "Video / audio — Patreon-style or Stripe-gated fan content.",
    percent: 0,
  },
  {
    feature: "Graph comparison",
    description: "Sales × multimedia engagement × AI insights.",
    percent: 0,
  },
  {
    feature: "Personality lore bots",
    description: "Character-specific RAG for fan interaction (non-spoiler).",
    percent: 15,
  },
];

export const AUTHOR_MSGF_STATES: readonly AuthorMsgfState[] = [
  { state: "STATE_SOVEREIGN", meaning: "Vault Pact signed; HAL active." },
  { state: "STATE_COOLDOWN", meaning: "Manuscript locked; revision logic active." },
  { state: "STATE_AUDIT", meaning: "Librarian / Critic generating dual-review reports." },
  { state: "STATE_DISCOVERY", meaning: "Anonymized manuscript visible in Publisher Hub." },
];

export function authorRoadmapHeroBlurb(): string {
  return "Protect the work, then perfect it — manuscript workspace with authorship attestation, Vault Pact no-training agreement, and MSGF-governed revision intelligence. Foundational testing is open on authorecosystem; join the waitlist for a seat.";
}
