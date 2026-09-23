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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Maps MSGF self-heal API JSON → author-facing Sentinel copy.
 */

export type HealedPillarSummary = {
  pillar: string;
  label: string;
};

export type TenantReasoningSummaryDTO = {
  headline: string;
  detail: string | null;
};

export type TenantLogicDriftDTO = {
  band: "stable" | "elevated" | "critical";
  escalated: boolean;
  score: number;
};

export type SelfHealReportApiResponse = {
  ok?: boolean;
  error?: string | Record<string, unknown>;
  narrative_log_id?: string | null;
  incident_id?: string | null;
  incident_source?: string;
  escalated_to_arbitrate?: boolean;
  /** @deprecated Server returns coarse {@link TenantLogicDriftDTO} as `logic_drift` for tenants. */
  logic_drift_score?: number;
  logic_drift_escalate?: boolean;
  /** Tenant-safe coarse drift (preferred). */
  logic_drift?: TenantLogicDriftDTO;
  reasoning_summary?: TenantReasoningSummaryDTO;
  /** @deprecated Omitted from tenant API — internal models only. */
  emergency_lom?: {
    gemini_verdict?: string;
    claude_verdict?: string;
    roadmap_conflict_detected?: boolean;
  };
  local_delta_applied?: boolean;
  local_delta_strategy_id?: string | null;
  healed_pillars?: HealedPillarSummary[];
  user_resume_message?: string;
  /** @deprecated Omitted from tenant API. */
  remediation_strategies?: unknown[];
  global_promotion_status?: string;
  local_cache_id?: string | null;
};

export type SelfHealReportUIResult = {
  ok: true;
  narrativeLogId: string | null;
  incidentId: string | null;
  localDeltaApplied: boolean;
  escalatedToArbitrate: boolean;
  healedPillars: HealedPillarSummary[];
  userMessage: string;
  resumePrompt: string;
  reasoningSummary?: TenantReasoningSummaryDTO;
  logicDrift?: TenantLogicDriftDTO;
  raw: SelfHealReportApiResponse;
};

const P2_STEP_TO_PILLAR = {
  SWEEP: "P1",
  SHARD: "P1",
  DEFEND: "P6",
  "CROSS-REF": "P2",
  CONVERGE: "P6",
  ARBITRATE: "P2",
  PERSIST: "P4",
} as const;

type P2RemediationStep = keyof typeof P2_STEP_TO_PILLAR;

const PILLAR_LABELS: Record<string, string> = {
  P1: "Static Ledger (Immutable Rules & Security)",
  P2: "Flow Sequence (Pipeline & Execution Order)",
  P3: "Entity Profiles (Identity, Roles & Stylometry)",
  P4: "State Ledger (Runtime Telemetry & Active Memory)",
  P5: "Local Variables (Workspace Context Sharding)",
  P6: "Constraint Ledger (Vault vs. Hall Anomaly Isolation)",
};

export function pillarLabelForId(pillarId: string): string {
  return PILLAR_LABELS[pillarId] ?? pillarId;
}

export function mapRemediationPillarToGovernancePillar(p2Step: string): string {
  return P2_STEP_TO_PILLAR[p2Step as P2RemediationStep] ?? "P2";
}

/**
 * Build the resume line shown in the Sentinel FAB after a successful self-heal.
 */
export function formatSentinelResumeMessage(healedPillars: HealedPillarSummary[]): string {
  if (!healedPillars.length) {
    return "Diagnostic snapshot received. The Brain recorded your report.";
  }
  if (healedPillars.length === 1) {
    const p = healedPillars[0];
    return `Pillar ${p.label} (${p.pillar}) has been self-healed. Please resume.`;
  }
  const names = healedPillars.map((p) => `${p.label} (${p.pillar})`).join(", ");
  return `Pillars ${names} have been self-healed. Please resume.`;
}

function parseReasoningSummaryDto(
  raw: unknown
): TenantReasoningSummaryDTO | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const headline = typeof o.headline === "string" ? o.headline.trim() : "";
  if (!headline) return undefined;
  const detail =
    typeof o.detail === "string" && o.detail.trim() ? o.detail.trim() : null;
  return { headline, detail };
}

function parseLogicDriftDto(raw: unknown): TenantLogicDriftDTO | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const band = o.band;
  if (band !== "stable" && band !== "elevated" && band !== "critical") {
    return undefined;
  }
  return {
    band,
    escalated: o.escalated === true,
    score: typeof o.score === "number" && Number.isFinite(o.score) ? o.score : 0,
  };
}

export function parseSelfHealReportResponse(
  raw: SelfHealReportApiResponse,
  httpOk: boolean
): SelfHealReportUIResult {
  if (!httpOk || raw.ok === false) {
    const err =
      typeof raw.error === "string"
        ? raw.error
        : raw.error
          ? JSON.stringify(raw.error)
          : "Self-heal report failed.";
    throw new Error(err);
  }

  const healedPillars = Array.isArray(raw.healed_pillars) ? raw.healed_pillars : [];
  const localDeltaApplied = raw.local_delta_applied === true;
  const userMessage =
    typeof raw.user_resume_message === "string" && raw.user_resume_message.trim()
      ? raw.user_resume_message.trim()
      : localDeltaApplied
        ? formatSentinelResumeMessage(healedPillars)
        : formatSentinelResumeMessage([]);

  return {
    ok: true,
    narrativeLogId: raw.narrative_log_id ?? null,
    incidentId: raw.incident_id ?? null,
    localDeltaApplied,
    escalatedToArbitrate: raw.escalated_to_arbitrate === true,
    healedPillars,
    userMessage,
    resumePrompt: healedPillars.length
      ? "Please resume your session."
      : "Your report was logged for dashboard review.",
    reasoningSummary: parseReasoningSummaryDto(raw.reasoning_summary),
    logicDrift: parseLogicDriftDto(raw.logic_drift),
    raw,
  };
}
