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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
 */
/**
 * Zod contracts for V3.2 differential state (Vault vs Hall) and 1.1.1 genealogical bug index.
 */

import { z } from "zod";

import { withMsgfMetadataScope } from "@/lib/services/msgf-metadata-scope";

/** Level 1.0 — major module / category (e.g. `1.0_PULSE`, `1.0_AUTH_GATE`). */
export const BugIndexLevel1Schema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^1\.0[_A-Z0-9]+$/i,
    "level_1_category must start with 1.0_ (genealogical category)"
  );

/** Level 1.1 — sub-module or LOM gate (e.g. `1.1_DEFEND`, `1.1_CONVERGE`). */
export const BugIndexLevel11Schema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^1\.1[_A-Z0-9]+$/i, "level_1_1_branch must start with 1.1_");

/** Level 1.1.1 — discrete fix delta / instance (e.g. `1.1.1_CONSENSUS_VAULT`). */
export const BugIndexLevel111Schema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^1\.1\.1[_A-Z0-9]+$/i, "level_1_1_1_instance must start with 1.1.1_");

export const GenealogicalBugIndexSchema = z
  .object({
    level_1_category: BugIndexLevel1Schema,
    level_1_1_branch: BugIndexLevel11Schema,
    level_1_1_1_instance: BugIndexLevel111Schema,
  })
  .strict();

export type GenealogicalBugIndex = z.infer<typeof GenealogicalBugIndexSchema>;

export const ConstraintLedgerKindSchema = z.enum(["vault", "hall"]);

export const VaultHallPillarSchema = z.literal("P6");

/** Metadata stored on `pillar_vectors` and mirrored on `p4_narrative_logs.metadata`. */
export const VaultHallMetadataSchema = z
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
    tier: z.enum(["RED", "YELLOW", "GREEN"]).optional(),
    reason: z.string().max(4000).optional(),
    lom_attempts: z.number().int().min(0).max(32).optional(),
    test_force_mismatch: z.boolean().optional(),
  })
  .strict();

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
  tier?: "RED" | "YELLOW" | "GREEN";
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
