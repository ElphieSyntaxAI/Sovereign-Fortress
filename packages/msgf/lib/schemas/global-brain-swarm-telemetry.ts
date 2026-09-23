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
 * Zero-text Global Brain swarm telemetry — how a wave failed, never what the user said.
 */

import { z } from "zod";

import { SWARM_CAUSE_CODES, SWARM_FIX_IDS } from "@/lib/services/swarm-fix-catalog";

export const GLOBAL_BRAIN_SWARM_SCHEMA_VERSION = "1.0" as const;

export const SwarmCauseCodeSchema = z.enum(SWARM_CAUSE_CODES);
export const SwarmFixIdSchema = z.enum(SWARM_FIX_IDS);

export const GlobalBrainDriftFactorsSchema = z.object({
  vault_contradiction: z.number().finite(),
  shadow_tier: z.number().finite(),
  hal_penalty: z.number().finite(),
  biometric_drift: z.number().finite(),
  text_entropy: z.number().finite(),
});

export const GlobalBrainSuggestedFixSchema = z.object({
  id: SwarmFixIdSchema,
  rank: z.number().int().min(1).max(3),
  title: z.string().min(1).max(120),
  fix_summary: z.string().min(1).max(2000),
  rationale: z.string().min(1).max(1500),
});

export const GlobalBrainSwarmTelemetrySchema = z.object({
  schema_version: z.literal(GLOBAL_BRAIN_SWARM_SCHEMA_VERSION),
  kind: z.enum(["bot_swarm_detected", "bot_swarm_observed"]),
  enforced: z.boolean(),
  cause_codes: z.array(SwarmCauseCodeSchema).min(1),
  cause_composite: z.string().min(1).max(256),
  spawn_depth: z.number().int().min(0),
  parent_child_edge: z.boolean(),
  sibling_edge: z.boolean(),
  child_count: z.number().int().min(0),
  entity_count: z.number().int().min(0),
  inflight: z.number().int().min(0),
  edge_kind_counts: z.object({
    spawn: z.number().int().min(0),
    tool: z.number().int().min(0),
    peer: z.number().int().min(0),
  }),
  tokens_in: z.number().finite().min(0),
  tokens_out: z.number().finite().min(0),
  token_burn: z.number().finite().min(0),
  mandate_sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  silo_ref: z.string().min(1).max(32),
  drift: z.object({
    score: z.number().finite().nullable(),
    escalate_to_global_brain: z.boolean().nullable(),
    factors: GlobalBrainDriftFactorsSchema.nullable(),
  }),
  primary_fix_id: SwarmFixIdSchema,
  suggested_fixes: z.array(GlobalBrainSuggestedFixSchema).min(1).max(3),
});

export type GlobalBrainSwarmTelemetry = z.infer<
  typeof GlobalBrainSwarmTelemetrySchema
>;

/** Keys that must never appear on the Global Brain envelope. */
export const GLOBAL_BRAIN_STRIPPED_KEYS = [
  "prompt",
  "completion",
  "pulseText",
  "pulse_text",
  "prompt_text",
  "completion_text",
  "agent_id",
  "parent_agent_id",
  "entity_id",
  "tenant_id",
  "filePath",
  "file_path",
  "promoted_keys",
  "blocked_keys",
] as const;
