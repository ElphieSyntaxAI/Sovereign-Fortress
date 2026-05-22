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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
/**
 * Strict Zod contracts for GET/POST /api/msgf/heal-queue.
 */

import { z } from "zod";

import {
  GenealogicalBugIndexSchema,
  MsgfGovernancePillarSchema,
  MsgfSchedulingTierSchema,
} from "@/lib/schemas/vault-hall-metadata";
import { REMEDIATION_STATE } from "@/lib/schemas/remediation-state";

export const RemediationStateSchema = z.enum([
  REMEDIATION_STATE.ACTIVE,
  REMEDIATION_STATE.SCHEDULED,
  REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
  REMEDIATION_STATE.RESOLVED,
]);
export type RemediationState = z.infer<typeof RemediationStateSchema>;

export const HealQueueActionTypeSchema = z.enum([
  "BULK",
  "BULK_EXPENSIVE",
  "BULK_INEXPENSIVE",
  "INDIVIDUAL",
  "SCHEDULED",
]);
export type HealQueueActionType = z.infer<typeof HealQueueActionTypeSchema>;

export const HealQueuePresetIntervalSchema = z.enum(["immediate", "1h", "6h", "nightly"]);
export type HealQueuePresetInterval = z.infer<typeof HealQueuePresetIntervalSchema>;

/** Mirrors `public.msgf_scheduling_tier` (Postgres ENUM). */
export const HealQueueSchedulingTierSchema = MsgfSchedulingTierSchema;
export type HealQueueSchedulingTier = z.infer<typeof HealQueueSchedulingTierSchema>;

/** License silo slug (e.g. `integration_sandbox`) or legacy UUID tenant id. */
export const MsgfHealQueueTenantIdSchema = z
  .string()
  .trim()
  .min(1, "tenant_id is required")
  .max(128);

export const IngestRemediationActionSchema = z
  .object({
    tenant_id: MsgfHealQueueTenantIdSchema,
    action_type: HealQueueActionTypeSchema,
    file_paths: z.array(z.string().min(1).max(512)).optional(),
    preset_interval: HealQueuePresetIntervalSchema.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.action_type === "INDIVIDUAL") {
      if (!body.file_paths?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "file_paths required for INDIVIDUAL action",
          path: ["file_paths"],
        });
      }
    }
    if (body.action_type === "SCHEDULED") {
      if (!body.file_paths?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "file_paths required for SCHEDULED action",
          path: ["file_paths"],
        });
      }
      if (!body.preset_interval) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "preset_interval required for SCHEDULED action",
          path: ["preset_interval"],
        });
      }
    }
  });

export type IngestRemediationAction = z.infer<typeof IngestRemediationActionSchema>;

export const HealQueueTenantQuerySchema = z
  .object({
    tenant_id: MsgfHealQueueTenantIdSchema,
  })
  .strict();

export const HealTaskTokenEstimateSchema = z
  .object({
    cost_tier: z.enum(["expensive", "inexpensive"]),
    strategy_scope: z.enum(["global", "local", "unknown"]),
    consequence_score: z.number().int().min(0).max(100),
    tokens_without_msgf: z.number().int().min(0),
    tokens_with_msgf: z.number().int().min(0),
    tokens_saved: z.number().int().min(0),
  })
  .strict();

export type HealTaskTokenEstimateDto = z.infer<typeof HealTaskTokenEstimateSchema>;

export const HealQueueTokenSummarySchema = z
  .object({
    healable_item_count: z.number().int().min(0),
    expensive_count: z.number().int().min(0),
    inexpensive_count: z.number().int().min(0),
    arbitration_blocked_count: z.number().int().min(0),
    without_msgf_total: z.number().int().min(0),
    with_msgf_batch_total: z.number().int().min(0),
    tokens_saved_vs_naive: z.number().int().min(0),
    savings_pct: z.number().min(0).max(100),
    expensive_subset: z.object({
      without_msgf_total: z.number().int().min(0),
      with_msgf_batch_total: z.number().int().min(0),
      tokens_saved: z.number().int().min(0),
    }),
    inexpensive_subset: z.object({
      without_msgf_total: z.number().int().min(0),
      with_msgf_batch_total: z.number().int().min(0),
      tokens_saved: z.number().int().min(0),
    }),
  })
  .strict();

export type HealQueueTokenSummaryDto = z.infer<typeof HealQueueTokenSummarySchema>;

export const HealActionTokenReportSchema = z
  .object({
    before_msgf_tokens: z.number().int().min(0),
    after_msgf_tokens: z.number().int().min(0),
    tokens_saved: z.number().int().min(0),
    savings_pct: z.number().min(0).max(100),
    items_targeted: z.number().int().min(0),
    note: z.string().min(1),
  })
  .strict();

export type HealActionTokenReportDto = z.infer<typeof HealActionTokenReportSchema>;

export const RemediationTaskSchema = z
  .object({
    task_id: z.string().uuid(),
    file_path: z.string().min(1).max(512),
    governance_pillar: MsgfGovernancePillarSchema,
    bug_index: GenealogicalBugIndexSchema,
    reason: z.string().min(1).max(512),
    source: z.enum(["brain_readiness", "pillar_vector", "scheduled"]),
    pillar_vector_id: z.string().uuid().nullable(),
    scheduling_tier: HealQueueSchedulingTierSchema.nullable(),
    preset_interval: HealQueuePresetIntervalSchema.nullable(),
    remediation_state: RemediationStateSchema.nullable().optional(),
    consecutive_failure_count: z.number().int().min(0).max(32).optional(),
    circuit_breaker_open: z.boolean().optional(),
    token_estimate: HealTaskTokenEstimateSchema.optional(),
  })
  .strict();

export type RemediationTask = z.infer<typeof RemediationTaskSchema>;

export const HumanArbitrationRecommendationSchema = z
  .object({
    strategy_id: z.string().min(1),
    scope: z.enum(["global", "local"]),
    pillar: z.string().min(1),
    label: z.string().min(1),
    recommended_code_fix: z.string().min(1),
    predicted_consequence: z.string().min(1),
    consequence_score: z.number().int().min(0).max(100),
    risk: z.string().min(1),
    rationale: z.string().min(1),
    apply_to_future_sessions: z.boolean(),
  })
  .strict();

export const HumanArbitrationComparisonPairSchema = z
  .object({
    label: z.string().min(1),
    left: HumanArbitrationRecommendationSchema,
    right: HumanArbitrationRecommendationSchema,
  })
  .strict();

export const HumanArbitrationPackageSchema = z
  .object({
    file_path: z.string().min(1).max(512),
    bug_index: GenealogicalBugIndexSchema,
    governance_pillar: MsgfGovernancePillarSchema,
    remediation_state: z.literal(REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION),
    incident_summary: z.string().min(1),
    consecutive_failures: z.number().int().min(1).max(32),
    primary: HumanArbitrationRecommendationSchema,
    alternatives: z.array(HumanArbitrationRecommendationSchema),
    comparison_pairs: z.array(HumanArbitrationComparisonPairSchema),
  })
  .strict();

export type HumanArbitrationRecommendation = z.infer<
  typeof HumanArbitrationRecommendationSchema
>;
export type HumanArbitrationComparisonPair = z.infer<
  typeof HumanArbitrationComparisonPairSchema
>;
export type HumanArbitrationPackage = z.infer<typeof HumanArbitrationPackageSchema>;

export const HumanArbitrationActionSchema = z.enum(["APPROVE_BYPASS", "DENY_PURGE"]);
export type HumanArbitrationAction = z.infer<typeof HumanArbitrationActionSchema>;

export const HealQueueHumanArbitrationBodySchema = z
  .object({
    tenant_id: MsgfHealQueueTenantIdSchema,
    file_path: z.string().min(1).max(512),
    action: HumanArbitrationActionSchema,
    operator_note: z.string().max(2000).optional(),
  })
  .strict();

export type HealQueueHumanArbitrationBody = z.infer<typeof HealQueueHumanArbitrationBodySchema>;

export const HealQueueGetResponseSchema = z
  .object({
    ok: z.literal(true),
    tenant_id: MsgfHealQueueTenantIdSchema,
    brain_readiness: z.object({
      readiness_score: z.number().int().min(0).max(100),
      missing_pillars: z.array(MsgfGovernancePillarSchema),
      baseline_training_required: z.boolean(),
      baseline_training_remaining: z.number().int().min(0),
      is_pillar_baseline_set: z.boolean(),
      brain_fully_initialized: z.boolean(),
    }),
    remediation_tasks: z.array(RemediationTaskSchema),
    human_arbitration_packages: z.array(HumanArbitrationPackageSchema),
    heal_token_summary: HealQueueTokenSummarySchema,
    audience_scope: z.enum(["user", "admin"]).optional(),
    big_brain_escalations_pending: z.number().int().min(0).optional(),
  })
  .strict();

export type HealQueueGetResponse = z.infer<typeof HealQueueGetResponseSchema>;

export const HealQueueGetEnvelopeSchema = z.union([
  HealQueueGetResponseSchema,
  z
    .object({
      ok: z.literal(false),
      error: z.string().optional(),
      message: z.string().optional(),
      issues: z
        .array(z.object({ path: z.string(), message: z.string() }))
        .optional(),
    })
    .strict(),
]);

export const HealQueuePostOkSchema = z
  .object({
    ok: z.literal(true),
    action_type: HealQueueActionTypeSchema,
    token_usage_report: HealActionTokenReportSchema.optional(),
  })
  .passthrough();

export type HealQueuePostOk = z.infer<typeof HealQueuePostOkSchema>;

export const HealQueuePostEnvelopeSchema = z.union([
  HealQueuePostOkSchema,
  z
    .object({
      ok: z.literal(false),
      error: z.string().optional(),
      message: z.string().optional(),
      issues: z
        .array(z.object({ path: z.string(), message: z.string() }))
        .optional(),
    })
    .strict(),
]);

export class HealQueueValidationError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: { path: string; message: string }[];

  constructor(
    message: string,
    issues: { path: string; message: string }[],
    status = 400
  ) {
    super(message);
    this.name = "HealQueueValidationError";
    this.code = "HEAL_QUEUE_VALIDATION_ERROR";
    this.status = status;
    this.issues = issues;
  }
}

function zodIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

export function parseIngestRemediationAction(raw: unknown): IngestRemediationAction {
  const parsed = IngestRemediationActionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HealQueueValidationError(
      "Invalid heal-queue remediation action.",
      zodIssues(parsed.error)
    );
  }
  return parsed.data;
}

export function parseHealQueueHumanArbitrationBody(raw: unknown): HealQueueHumanArbitrationBody {
  const parsed = HealQueueHumanArbitrationBodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new HealQueueValidationError(
      "Invalid heal-queue human arbitration action.",
      zodIssues(parsed.error)
    );
  }
  return parsed.data;
}

export function parseHealQueueTenantQuery(
  tenantId: string | null | undefined
): z.infer<typeof HealQueueTenantQuerySchema> {
  const parsed = HealQueueTenantQuerySchema.safeParse({ tenant_id: tenantId });
  if (!parsed.success) {
    throw new HealQueueValidationError(
      "tenant_id query param must be a valid UUID.",
      zodIssues(parsed.error)
    );
  }
  return parsed.data;
}

/** Maps UI preset → V3.2 tier batch cadence for ops cron. */
export const PRESET_INTERVAL_TO_SCHEDULING_TIER: Record<
  HealQueuePresetInterval,
  HealQueueSchedulingTier
> = {
  immediate: "RED",
  "1h": "YELLOW",
  "6h": "YELLOW",
  nightly: "GREEN",
};
