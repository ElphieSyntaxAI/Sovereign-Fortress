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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
/**
 * Zod contracts for V3.2 differential state (Vault vs Hall) and 1.1.1 genealogical bug index.
 *
 * Postgres mirror: `supabase/migrations/20260523120000_crossref_db_enums.sql`
 * — `msgf_governance_pillar`, `msgf_constraint_ledger`, DOMAIN types for bug-index slugs,
 *   `pillar_vectors` typed columns + `trg_pillar_vectors_crossref_enforce`.
 */

import { z } from "zod";

import { withMsgfMetadataScope } from "@/lib/services/msgf-metadata-scope";

// -----------------------------------------------------------------------------
// Shared with Postgres ENUM / DOMAIN (keep in sync with migration)
// -----------------------------------------------------------------------------

/** Mirrors `public.msgf_governance_pillar`. */
export const MSG_DB_GOVERNANCE_PILLARS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

/** Mirrors `public.msgf_constraint_ledger`. */
export const MSG_DB_CONSTRAINT_LEDGERS = ["vault", "hall"] as const;

/** Mirrors `public.msgf_vault_hall_pillar`. */
export const MSG_DB_VAULT_HALL_PILLARS = ["P6"] as const;

/** Mirrors `public.msgf_scheduling_tier`. */
export const MSG_DB_SCHEDULING_TIERS = ["RED", "YELLOW", "GREEN"] as const;

/** Mirrors `public.msgf_bug_index_level_1` DOMAIN regex. */
export const MSG_DB_BUG_INDEX_LEVEL_1_REGEX = /^\d+\.0[_A-Z0-9]+$/i;

/** Mirrors `public.msgf_bug_index_level_1_1` DOMAIN regex. */
export const MSG_DB_BUG_INDEX_LEVEL_11_REGEX = /^\d+\.\d+[_A-Z0-9]+$/i;

/** Mirrors `public.msgf_bug_index_level_1_1_1` DOMAIN regex. */
export const MSG_DB_BUG_INDEX_LEVEL_111_REGEX = /^\d+\.\d+\.\d+[_A-Z0-9]+$/i;

/**
 * Level 1 — major module / category.
 *
 * Pattern: `<root>.0_<SLUG>` where `<root>` is any positive integer.
 * - Pulse / engineering roots: `1.0_PULSE`, `1.0_AUTH_GATE`, `1.0_ELA`
 * - Education domain roots: `2.0_BEHAVIORAL`, `3.0_RESEARCH` (Syntax Education §2.6.1)
 *
 * Backward compatible: all existing `1.0_*` slugs still validate.
 */
export const BugIndexLevel1Schema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    MSG_DB_BUG_INDEX_LEVEL_1_REGEX,
    "level_1_category must match <root>.0_<SLUG> (e.g. 1.0_PULSE, 3.0_RESEARCH)"
  );

/**
 * Level 1.1 — sub-module / branch (e.g. `1.1_DEFEND`, `3.1_CITATIONS`).
 *
 * Pattern: `<root>.<branch>_<SLUG>` — the branch number may be any non-negative integer.
 */
export const BugIndexLevel11Schema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    MSG_DB_BUG_INDEX_LEVEL_11_REGEX,
    "level_1_1_branch must match <root>.<branch>_<SLUG> (e.g. 1.1_DEFEND, 3.1_CITATIONS)"
  );

/**
 * Level 1.1.1 — discrete fix delta / lineage instance.
 *
 * Pattern: `<root>.<branch>.<instance>_<SLUG>` — e.g. `1.1.1_CONSENSUS_VAULT`,
 * `3.1.2_UNATTRIBUTED_SOURCE_STRING`.
 */
export const BugIndexLevel111Schema = z
  .string()
  .min(1)
  .max(160)
  .regex(
    MSG_DB_BUG_INDEX_LEVEL_111_REGEX,
    "level_1_1_1_instance must match <root>.<branch>.<instance>_<SLUG>"
  );

/** Extract numeric root from `1.0_SLUG` → `"1"`. */
export function genealogicalRootFromCategory(level_1_category: string): string | null {
  const m = /^(\d+)\.0_/i.exec(level_1_category.trim());
  return m?.[1] ?? null;
}

/** Ensures 1.0 / 1.1 / 1.1.1 slugs share the same genealogical root (e.g. all start with `1.`). */
export function assertGenealogicalBugIndexCoherent(
  index: {
    level_1_category: string;
    level_1_1_branch: string;
    level_1_1_1_instance: string;
  },
  ctx?: z.RefinementCtx
): void {
  const root = genealogicalRootFromCategory(index.level_1_category);
  const branchOk = root != null && new RegExp(`^${root}\\.\\d+[_A-Z0-9]+$`, "i").test(index.level_1_1_branch);
  const instanceOk =
    root != null && new RegExp(`^${root}\\.\\d+\\.\\d+[_A-Z0-9]+$`, "i").test(index.level_1_1_1_instance);
  if (!root || !branchOk || !instanceOk) {
    const message =
      "bug_index levels must share the same genealogical root (e.g. 1.0_AUTH, 1.1_GATE, 1.1.1_DELTA).";
    if (ctx) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["level_1_1_branch"] });
      return;
    }
    throw new Error(message);
  }
}

export const GenealogicalBugIndexSchema = z
  .object({
    level_1_category: BugIndexLevel1Schema,
    level_1_1_branch: BugIndexLevel11Schema,
    level_1_1_1_instance: BugIndexLevel111Schema,
  })
  .strict()
  .superRefine((index, ctx) => assertGenealogicalBugIndexCoherent(index, ctx));

export type GenealogicalBugIndex = z.infer<typeof GenealogicalBugIndexSchema>;

/** V3.0 engineering governance pillar on `pillar_vectors` (distinct from Vault/Hall `P6` ledger tag). */
export const MsgfGovernancePillarSchema = z.enum(MSG_DB_GOVERNANCE_PILLARS);
export type MsgfGovernancePillar = z.infer<typeof MsgfGovernancePillarSchema>;

export const ConstraintLedgerKindSchema = z.enum(MSG_DB_CONSTRAINT_LEDGERS);
export type ConstraintLedgerKind = z.infer<typeof ConstraintLedgerKindSchema>;

export const VaultHallPillarSchema = z.enum(MSG_DB_VAULT_HALL_PILLARS);

export const MsgfSchedulingTierSchema = z.enum(MSG_DB_SCHEDULING_TIERS);
export type MsgfSchedulingTier = z.infer<typeof MsgfSchedulingTierSchema>;

/** Typed columns on `pillar_vectors` / `msgf_sandbox` (CROSS-REF hardening). */
export const PillarVectorCrossRefColumnsSchema = z
  .object({
    governance_pillar: MsgfGovernancePillarSchema,
    vault_hall_pillar: VaultHallPillarSchema,
    constraint_ledger: ConstraintLedgerKindSchema,
    level_1_category: BugIndexLevel1Schema,
    level_1_1_branch: BugIndexLevel11Schema,
    level_1_1_1_instance: BugIndexLevel111Schema,
    genealogical_root: z.number().int().positive().optional(),
    scheduling_tier: MsgfSchedulingTierSchema.nullable().optional(),
  })
  .strict();

export type PillarVectorCrossRefColumns = z.infer<typeof PillarVectorCrossRefColumnsSchema>;

/** Base object shape (extendable for SWEEP ingest rows). */
export const VaultHallMetadataObjectSchema = z
  .object({
    pillar: VaultHallPillarSchema,
    ledger: ConstraintLedgerKindSchema,
    index_type: z.literal("genealogical_bug_index"),
    /** Hierarchical 1.1.1 index (canonical). */
    bug_index: GenealogicalBugIndexSchema,
    /** Shadow / lineage query helpers (aligned with `msgf-shadow`). */
    instance: z.literal("1.1.1"),
    category: BugIndexLevel1Schema,
    branch: BugIndexLevel11Schema,
    /** Full instance slug (duplicate of bug_index.level_1_1_1_instance for ilike filters). */
    instance_slug: BugIndexLevel111Schema,
    entity_id: z.string().uuid().optional(),
    tenant_id: z.string().optional(),
    legal_version: z.string().optional(),
    hal_score: z.number().finite().optional(),
    summary: z.string().max(2000).optional(),
    persisted_at: z.string().optional(),
    tier: MsgfSchedulingTierSchema.optional(),
    reason: z.string().max(4000).optional(),
    lom_attempts: z.number().int().min(0).max(32).optional(),
    test_force_mismatch: z.boolean().optional(),
  })
  .strict();

function refineVaultHallMetadataMirror(
  meta: z.infer<typeof VaultHallMetadataObjectSchema>,
  ctx: z.RefinementCtx
): void {
  if (meta.category !== meta.bug_index.level_1_category) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "category must equal bug_index.level_1_category",
      path: ["category"],
    });
  }
  if (meta.branch !== meta.bug_index.level_1_1_branch) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "branch must equal bug_index.level_1_1_branch",
      path: ["branch"],
    });
  }
  if (meta.instance_slug !== meta.bug_index.level_1_1_1_instance) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "instance_slug must equal bug_index.level_1_1_1_instance",
      path: ["instance_slug"],
    });
  }
}

/** Metadata stored on `pillar_vectors` and mirrored on `p4_narrative_logs.metadata`. */
export const VaultHallMetadataSchema = VaultHallMetadataObjectSchema.superRefine(
  refineVaultHallMetadataMirror
);

export type VaultHallMetadata = z.infer<typeof VaultHallMetadataSchema>;

/** Narrative log row metadata — always includes `bug_index` + `ledger`. */
export const NarrativeLogPulseMetadataSchema = z
  .object({
    bug_index: GenealogicalBugIndexSchema,
    ledger: ConstraintLedgerKindSchema,
    pillar: VaultHallPillarSchema,
    index_type: z.literal("genealogical_bug_index"),
    pulse_engine: z.literal(true),
  })
  .passthrough();

export type NarrativeLogPulseMetadata = z.infer<typeof NarrativeLogPulseMetadataSchema>;

export function buildGenealogicalBugIndex(parts: {
  level_1_category: string;
  level_1_1_branch: string;
  level_1_1_1_instance: string;
}): GenealogicalBugIndex {
  return GenealogicalBugIndexSchema.parse(parts);
}

/** Preset indices for Pulse pipeline paths. */
export const PULSE_BUG_INDEX = {
  vaultConsensusOk: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_CONVERGE",
    level_1_1_1_instance: "1.1.1_CONSENSUS_VAULT",
  }),
  hallShadowReject: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_DEFEND",
    level_1_1_1_instance: "1.1.1_SHADOW_REJECT",
  }),
  hallLomRecursion: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_DEFEND",
    level_1_1_1_instance: "1.1.1_LOM_RECURSION_LIMIT",
  }),
  hallHitlRequired: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_ARBITRATE",
    level_1_1_1_instance: "1.1.1_HITL_TIEBREAKER",
  }),
  hallConsensusFailed: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_CONVERGE",
    level_1_1_1_instance: "1.1.1_CONSENSUS_REJECT",
  }),
  hallLomDisagreement: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_CONVERGE",
    level_1_1_1_instance: "1.1.1_LOM_MODEL_DISAGREE",
  }),
  /** Admin Decision Portal — Vault arbitration beat for P2 Cross-Ref prioritization. */
  adminArbitrationBeat: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_ARBITRATE",
    level_1_1_1_instance: "1.1.1_ADMIN_ARBITRATION_BEAT",
  }),
  /** P2 Roadmap education — operator resolution prioritized in Cross-Ref (branch slug uses underscore; P2 step is CROSS-REF). */
  p2EducationVault: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_CROSSREF",
    level_1_1_1_instance: "1.1.1_P2_EDUCATION_VAULT",
  }),
  /** MsgfSentinel FAB — user-reported diagnostic snapshot (self-heal). */
  userSentinelReport: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_SELF_HEAL",
    level_1_1_1_instance: "1.1.1_USER_SENTINEL",
  }),
  /** Author document ingest — user or system rejected mapping (Hall learning). */
  authorIngestBadMapping: buildGenealogicalBugIndex({
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_DOCUMENT_BAD_MAPPING",
  }),
  /** Author document ingest — shadow blocked commit (matches prior Hall pattern). */
  authorIngestShadowBlock: buildGenealogicalBugIndex({
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_DEFEND",
    level_1_1_1_instance: "1.1.1_INGEST_SHADOW_BLOCK",
  }),
  /** Author document ingest — SWEEP shard: compiled source text. */
  authorIngestWikiSource: buildGenealogicalBugIndex({
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_SOURCE",
  }),
  /** Author document ingest — SWEEP shard: character wiki entry. */
  authorIngestWikiCharacter: buildGenealogicalBugIndex({
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_CHARACTER",
  }),
  /** Author document ingest — SWEEP shard: setting / location wiki entry. */
  authorIngestWikiSetting: buildGenealogicalBugIndex({
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_SETTING",
  }),
  /** Author document ingest — SWEEP shard: plot beat / scene card. */
  authorIngestWikiPlotBeat: buildGenealogicalBugIndex({
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_PLOT_BEAT",
  }),
  /** Author document ingest — SWEEP shard: manuscript outline aggregate. */
  authorIngestWikiOutline: buildGenealogicalBugIndex({
    level_1_category: "1.0_AUTHOR",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_WIKI_OUTLINE",
  }),
  /** Admin-approved promotion from local_state_cache → vault_core (system DNA). */
  globalPromotionVault: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_PERSIST",
    level_1_1_1_instance: "1.1.1_GLOBAL_PROMOTION_VAULT",
  }),
  /** LLM abort, timeout, or recursion-depth cap — operational dead letter (no silent retry). */
  hallCostRunawayDeadLetter: buildGenealogicalBugIndex({
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_OPS",
    level_1_1_1_instance: "1.1.1_COST_RUNAWAY_DEAD_LETTER",
  }),
} as const;

export function buildVaultHallMetadata(input: {
  ledger: z.infer<typeof ConstraintLedgerKindSchema>;
  bugIndex: GenealogicalBugIndex;
  entityId?: string;
  tenantId?: string;
  /** @deprecated Use `entityId` — mapped to `entity_id` in metadata. */
  authorId?: string;
  legalVersion?: string;
  halScore?: number;
  summary?: string;
  tier?: MsgfSchedulingTier;
  reason?: string;
  lomAttempts?: number;
  testForceMismatch?: boolean;
}): VaultHallMetadata {
  const entityId = input.entityId?.trim() || input.authorId?.trim();
  const tenantId = input.tenantId?.trim();

  const base = {
    pillar: "P6" as const,
    ledger: input.ledger,
    index_type: "genealogical_bug_index" as const,
    bug_index: input.bugIndex,
    instance: "1.1.1" as const,
    category: input.bugIndex.level_1_category,
    branch: input.bugIndex.level_1_1_branch,
    instance_slug: input.bugIndex.level_1_1_1_instance,
    ...(input.legalVersion ? { legal_version: input.legalVersion } : {}),
    ...(input.halScore != null ? { hal_score: input.halScore } : {}),
    ...(input.summary ? { summary: input.summary } : {}),
    persisted_at: new Date().toISOString(),
    ...(input.tier ? { tier: input.tier } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.lomAttempts != null ? { lom_attempts: input.lomAttempts } : {}),
    ...(input.testForceMismatch ? { test_force_mismatch: true } : {}),
  };

  const scoped =
    tenantId != null && tenantId.length > 0
      ? withMsgfMetadataScope(base, {
          tenantId,
          ...(entityId ? { entityId } : {}),
        })
      : base;

  return VaultHallMetadataSchema.parse(scoped);
}

/** Minimal metadata shape for CROSS-REF column projection (Vault/Hall + SWEEP ingest). */
export type PillarVectorCrossRefMetadataInput = {
  ledger: ConstraintLedgerKind;
  bug_index: GenealogicalBugIndex;
  governance_pillar?: MsgfGovernancePillar;
  /** SWEEP rows set `pillar` to governance P1–P6; Vault/Hall rows use `P6`. */
  pillar?: MsgfGovernancePillar | z.infer<typeof VaultHallPillarSchema>;
};

/**
 * Maps validated Vault/Hall metadata to `pillar_vectors` typed columns.
 * Postgres trigger `msgf_pillar_vectors_crossref_enforce` re-validates and mirrors JSONB.
 */
export function pillarVectorCrossRefColumnsFromMetadata(
  metadata: PillarVectorCrossRefMetadataInput,
  options?: { scheduling_tier?: MsgfSchedulingTier | null }
): PillarVectorCrossRefColumns {
  const governance_pillar = MsgfGovernancePillarSchema.parse(
    metadata.governance_pillar ?? metadata.pillar ?? "P6"
  );
  const root = genealogicalRootFromCategory(metadata.bug_index.level_1_category);

  return PillarVectorCrossRefColumnsSchema.parse({
    governance_pillar,
    vault_hall_pillar: "P6",
    constraint_ledger: metadata.ledger,
    level_1_category: metadata.bug_index.level_1_category,
    level_1_1_branch: metadata.bug_index.level_1_1_branch,
    level_1_1_1_instance: metadata.bug_index.level_1_1_1_instance,
    ...(root != null ? { genealogical_root: Number(root) } : {}),
    ...(options?.scheduling_tier !== undefined
      ? { scheduling_tier: options.scheduling_tier }
      : {}),
  });
}

export function buildNarrativeLogMetadata(input: {
  ledger: z.infer<typeof ConstraintLedgerKindSchema>;
  bugIndex: GenealogicalBugIndex;
  extra?: Record<string, unknown>;
}): NarrativeLogPulseMetadata {
  return NarrativeLogPulseMetadataSchema.parse({
    bug_index: input.bugIndex,
    ledger: input.ledger,
    pillar: "P6",
    index_type: "genealogical_bug_index",
    pulse_engine: true,
    ...input.extra,
  });
}
