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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Tenant-facing Sentinel JSON — no raw LOM verdicts, remediation templates, or model transcripts.
 */

import { LOGIC_DRIFT_ESCALATION_THRESHOLD } from "@/lib/services/logic-drift";

import type { SelfHealReportResult } from "./self-heal-report";

export type TenantReasoningSummary = {
  headline: string;
  detail: string | null;
};

export type TenantLogicDriftPublic = {
  /** Coarse band for UI (score is 0–1 internal drift). */
  band: "stable" | "elevated" | "critical";
  escalated: boolean;
  /** Rounded snapshot drift score (0–1). */
  score: number;
};

export function buildTenantReasoningSummary(result: SelfHealReportResult): TenantReasoningSummary {
  if (result.escalated_to_arbitrate) {
    return {
      headline: "Manual review required — a governance pillar needs operator attention.",
      detail: result.logic_drift_escalate
        ? "Logic drift in your session crossed an internal safeguard threshold."
        : "An incident was logged for the ops dashboard to review.",
    };
  }

  if (result.emergency_lom.roadmap_conflict_detected) {
    return {
      headline: "Conflict detected in Pillar 2 (Flow Sequence).",
      detail:
        "Your current step did not align with the configured roadmap. A local safeguard may have been applied.",
    };
  }

  if (result.local_delta_applied) {
    return {
      headline: "Session stabilization applied.",
      detail: null,
    };
  }

  return {
    headline: "Diagnostic snapshot recorded.",
    detail:
      "No automatic change was required. You can keep working; ops may still review reports asynchronously.",
  };
}

export function buildTenantLogicDriftPublic(result: SelfHealReportResult): TenantLogicDriftPublic {
  const score = Number.isFinite(result.logic_drift_score) ? result.logic_drift_score : 0;
  const escalated = result.logic_drift_escalate === true;
  const threshold = LOGIC_DRIFT_ESCALATION_THRESHOLD;

  let band: TenantLogicDriftPublic["band"] = "stable";
  if (result.escalated_to_arbitrate || escalated || score >= threshold) {
    band = "critical";
  } else if (
    result.emergency_lom.roadmap_conflict_detected ||
    score >= threshold * 0.45 ||
    score >= 0.12
  ) {
    band = "elevated";
  }

  return {
    band,
    escalated,
    score: Math.round(score * 1000) / 1000,
  };
}

/** Body returned to browsers / Sentinel — safe for tenants. */
export function buildTenantSentinelSelfHealBody(result: SelfHealReportResult) {
  return {
    ok: true as const,
    narrative_log_id: result.narrative_log_id,
    incident_id: result.incident_id,
    incident_source: "USER_SENTINEL" as const,
    escalated_to_arbitrate: result.escalated_to_arbitrate,
    logic_drift: buildTenantLogicDriftPublic(result),
    reasoning_summary: buildTenantReasoningSummary(result),
    local_delta_applied: result.local_delta_applied,
    healed_pillars: result.healed_pillars,
    user_resume_message: result.user_resume_message,
    global_promotion_status: result.global_promotion_status,
    local_cache_id: result.local_cache_id,
  };
}
