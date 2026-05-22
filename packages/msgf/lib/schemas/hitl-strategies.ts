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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
import { z } from "zod";

import { P2_FLOW_SEQUENCE_STEPS } from "@/lib/services/p2-flow-roadmap";

const P2_STEP_ENUM = P2_FLOW_SEQUENCE_STEPS as unknown as [
  (typeof P2_FLOW_SEQUENCE_STEPS)[number],
  ...(typeof P2_FLOW_SEQUENCE_STEPS)[number][],
];

export const HitlStrategyIdSchema = z.enum(["A", "B", "C"]);

export const HitlConsequenceFactorsSchema = z.object({
  roadmap_alignment: z.number().finite().min(0).max(40),
  modular_compliance: z.number().finite().min(0).max(30),
  risk_penalty: z.number().finite().min(0).max(30),
  ai_assessment: z.number().finite().min(0).max(30),
});

export const HitlIncidentStrategySchema = z.object({
  id: HitlStrategyIdSchema,
  title: z.string().min(1).max(120),
  fix_summary: z.string().min(1).max(2000),
  p2_step: z.enum(P2_STEP_ENUM),
  consequence_score: z.number().finite().min(0).max(100),
  consequence_factors: HitlConsequenceFactorsSchema,
  rationale: z.string().min(1).max(1500),
});

export const HitlIncidentStrategiesSchema = z.object({
  generated_at: z.string(),
  roadmap_version: z.string(),
  p2_pipeline: z.array(z.enum(P2_STEP_ENUM)),
  strategies: z.array(HitlIncidentStrategySchema).length(3),
});

export type HitlIncidentStrategy = z.infer<typeof HitlIncidentStrategySchema>;
export type HitlIncidentStrategies = z.infer<typeof HitlIncidentStrategiesSchema>;

export const AiHitlStrategyDraftSchema = z.object({
  id: HitlStrategyIdSchema,
  title: z.string(),
  fix_summary: z.string(),
  p2_step: z.enum(P2_STEP_ENUM),
  ai_risk_assessment: z.number().finite().min(0).max(100),
  rationale: z.string(),
});

export const AiHitlStrategiesResponseSchema = z.object({
  strategies: z.array(AiHitlStrategyDraftSchema).length(3),
});
