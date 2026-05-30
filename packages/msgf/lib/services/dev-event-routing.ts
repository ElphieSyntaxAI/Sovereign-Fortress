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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * Dev-event routing — Small Brain only; bypasses Pulse biometric / Big Brain CONVERGE.
 */

import type { DevEventBody } from "@/lib/schemas/dev-event";
import {
  MSGF_BRAIN_SMALL,
  type MsgfBrainTier,
} from "@/lib/services/brain-routing-policy";

export const DEV_EVENT_EXECUTION_TIER = "CHEAP" as const;
export const DEV_EVENT_HEAL_PATHWAY = "heal_cheap" as const;

export type DevEventRoutingDecision = {
  execution_tier: typeof DEV_EVENT_EXECUTION_TIER;
  heal_pathway: typeof DEV_EVENT_HEAL_PATHWAY;
  brain_tier: MsgfBrainTier;
  biometric_evaluation_skipped: true;
  pulse_pipeline_skipped: true;
  /** Tenant Vault / local cache only until admin promotes to global DNA. */
  global_admin_approval_required: false;
};

/**
 * Maps structured IDE build failures to Heal Cheap (no CONVERGE / biometric gate).
 */
export function routeDevEventBuildFailure(body: DevEventBody): DevEventRoutingDecision {
  if (body.kind !== "build_failed") {
    throw new Error(`dev-event routing: unsupported kind ${body.kind}`);
  }
  return {
    execution_tier: DEV_EVENT_EXECUTION_TIER,
    heal_pathway: DEV_EVENT_HEAL_PATHWAY,
    brain_tier: MSGF_BRAIN_SMALL,
    biometric_evaluation_skipped: true,
    pulse_pipeline_skipped: true,
    global_admin_approval_required: false,
  };
}
