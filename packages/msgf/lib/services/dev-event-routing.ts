/**
 * Dev-event routing — bypasses Pulse biometric / keystroke pipeline; Heal Cheap only.
 */

import type { DevEventBody } from "@/lib/schemas/dev-event";

export const DEV_EVENT_EXECUTION_TIER = "CHEAP" as const;
export const DEV_EVENT_HEAL_PATHWAY = "heal_cheap" as const;

export type DevEventRoutingDecision = {
  execution_tier: typeof DEV_EVENT_EXECUTION_TIER;
  heal_pathway: typeof DEV_EVENT_HEAL_PATHWAY;
  biometric_evaluation_skipped: true;
  pulse_pipeline_skipped: true;
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
    biometric_evaluation_skipped: true,
    pulse_pipeline_skipped: true,
  };
}
