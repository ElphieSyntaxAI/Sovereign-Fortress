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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/**
 * Sentinel self-heal — DiagnosticSnapshot → LogicDrift → Emergency LOM → Local Delta → msgf_incidents.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SelfHealReportBodySchema,
  type DiagnosticSnapshot,
  type SelfHealReportBody,
} from "@/lib/schemas/diagnostic-snapshot";
import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import { buildNarrativeLogMetadata } from "@/lib/schemas/vault-hall-metadata";
import {
  runEmergencyLomSession,
  type EmergencyLomSessionResult,
} from "@/lib/services/emergency-lom-session";
import { isCostRunawayError } from "@/lib/services/cost-runaway-guard";
import { recordCostRunawayDeadLetterSafe } from "@/lib/services/llm-dead-letter";
import { logicDriftService } from "@/lib/services/LogicDriftService";
import { applyLocalSessionDelta } from "@/lib/services/local-session-delta";
import { loadP2Roadmap } from "@/lib/services/p2-flow-roadmap";
import {
  insertMsgfArbitrateIncident,
  insertMsgfUserSentinelIncident,
} from "@/lib/services/msgf-incidents";
import {
  formatSentinelResumeMessage,
  mapRemediationPillarToGovernancePillar,
  pillarLabelForId,
  type HealedPillarSummary,
} from "@/lib/connector/self-heal-report-ui";
import type { ModularRemediationStrategy } from "@/lib/services/RemediationEngine";
import {
  remediationEngine,
  toAdminIncidentStrategyDto,
} from "@/lib/services/RemediationEngine";
import { tenantIdForNarrativeLog } from "@/src/lib/tenant-ids";
import {
  GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS,
  GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
  type GlobalPromotionStatus,
} from "@/lib/services/global-approval-gate";

const SENTINEL_BUG_INDEX = PULSE_BUG_INDEX.userSentinelReport;
const SENTINEL_INSTANCE = SENTINEL_BUG_INDEX.level_1_1_1_instance;
const LOM_REC_INSTANCE = PULSE_BUG_INDEX.hallLomRecursion.level_1_1_1_instance;

export type SelfHealReportResult = {
  ok: true;
  narrative_log_id: string | null;
  incident_id: string | null;
  escalated_to_arbitrate: boolean;
  logic_drift_score: number;
  logic_drift_escalate: boolean;
  emergency_lom: {
    gemini_verdict: string;
    claude_verdict: string;
    roadmap_conflict_detected: boolean;
  };
  local_delta_applied: boolean;
  local_delta_strategy_id: string | null;
  remediation_strategies: ReturnType<typeof toAdminIncidentStrategyDto>[];
  healed_pillars: HealedPillarSummary[];
  user_resume_message: string;
  global_promotion_status: GlobalPromotionStatus;
  local_cache_id: string | null;
};

function hasManualInterventionRequired(snapshot: DiagnosticSnapshot): boolean {
  const pillars = snapshot.pillar_health;
  if (!pillars || typeof pillars !== "object") return false;
  const list = (pillars as { pillars?: { status?: string; pending_incidents?: number }[] })
    .pillars;
  if (!Array.isArray(list)) return false;
  return list.some((p) => p.status === "red" || (p.pending_incidents ?? 0) > 0);
}

function shouldApplyLocalDelta(params: {
  driftContradictsP2: boolean;
  lomConflict: boolean;
  driftScore: number;
  escalationThreshold: number;
}): boolean {
  return (
    params.lomConflict ||
    params.driftContradictsP2 ||
    params.driftScore > params.escalationThreshold
  );
}

function deriveHealedPillars(params: {
  snapshot: DiagnosticSnapshot;
  localDeltaApplied: boolean;
  localStrategy: ModularRemediationStrategy | null;
}): HealedPillarSummary[] {
  if (!params.localDeltaApplied) return [];

  const seen = new Set<string>();
  const out: HealedPillarSummary[] = [];

  const push = (pillar: string, label?: string) => {
    if (seen.has(pillar)) return;
    seen.add(pillar);
    out.push({ pillar, label: label ?? pillarLabelForId(pillar) });
  };

  if (params.localStrategy) {
    push(
      mapRemediationPillarToGovernancePillar(params.localStrategy.pillar),
      `${pillarLabelForId(mapRemediationPillarToGovernancePillar(params.localStrategy.pillar))}`
    );
  }

  const health = params.snapshot.pillar_health;
  if (health && typeof health === "object") {
    const list = (health as { pillars?: { pillar?: string; label?: string; status?: string }[] })
      .pillars;
    if (Array.isArray(list)) {
      for (const entry of list) {
        const status = entry.status ?? "";
        if (
          status === "red" ||
          status === "yellow" ||
          status === "yellow_self_healing" ||
          status === "predicted"
        ) {
          const id = typeof entry.pillar === "string" ? entry.pillar : "P2";
          push(id, typeof entry.label === "string" ? entry.label : undefined);
        }
      }
    }
  }

  if (!out.length) {
    push("P2");
  }

  return out;
}

export async function persistSelfHealReport(params: {
  adminSupabase: SupabaseClient;
  body: SelfHealReportBody;
  entityId: string;
  tenantId: string;
}): Promise<SelfHealReportResult> {
  const snapshot = SelfHealReportBodySchema.parse({
    ...params.body,
    entity_id: params.body.entity_id ?? params.body.author_id ?? params.entityId,
  });

  const tenantId = snapshot.tenant_id?.trim() || params.tenantId;

  const drift = await logicDriftService.assessFromDiagnosticSnapshot({
    adminSupabase: params.adminSupabase,
    snapshot,
    tenantId,
    entityId: params.entityId,
    documentId:
      typeof snapshot.editor?.manuscript_id === "string"
        ? snapshot.editor.manuscript_id
        : undefined,
  });

  const p2Roadmap = await loadP2Roadmap(params.adminSupabase, tenantId);

  let emergencyLom: EmergencyLomSessionResult;
  try {
    emergencyLom = await runEmergencyLomSession({
      snapshot,
      drift,
      p2Roadmap,
    });
  } catch (e) {
    if (isCostRunawayError(e)) {
      await recordCostRunawayDeadLetterSafe({
        adminSupabase: params.adminSupabase,
        tenantId,
        entityId: params.entityId,
        operation: "self_heal.emergency_lom",
        error: e,
      });
      emergencyLom = {
        gemini: {
          verdict: "INCONCLUSIVE",
          reason: "Emergency LOM aborted by cost-runaway guard (timeout or recursion cap).",
        },
        claude: {
          verdict: "INCONCLUSIVE",
          reason: "Emergency LOM aborted by cost-runaway guard (timeout or recursion cap).",
        },
        modelsAgree: true,
        roadmapConflictDetected: false,
        lomRecursionPath: "emergency_sentinel",
      };
    } else {
      throw e;
    }
  }

  const sentinelStrategies = remediationEngine.getModularStrategiesForIncident(SENTINEL_INSTANCE);
  const lomLocalStrategies = remediationEngine.getLocalStrategiesForIncident(LOM_REC_INSTANCE);
  const localStrategy =
    sentinelStrategies.find((s) => s.id === "local-sentinel-unblock") ??
    lomLocalStrategies.find((s) => s.id === "local-sweep-format") ??
    sentinelStrategies.find((s) => s.scope === "local") ??
    null;

  const remediationDtos = remediationEngine
    .getModularStrategiesForIncident(SENTINEL_INSTANCE)
    .map(toAdminIncidentStrategyDto);

  let localDeltaApplied = false;
  let localDeltaStrategyId: string | null = null;
  let localCacheId: string | null = null;
  let globalPromotionStatus: GlobalPromotionStatus = GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS;

  if (
    localStrategy &&
    shouldApplyLocalDelta({
      driftContradictsP2: drift.contradictsP2Roadmap,
      lomConflict: emergencyLom.roadmapConflictDetected,
      driftScore: drift.score,
      escalationThreshold: drift.escalation_threshold,
    })
  ) {
    const delta = await applyLocalSessionDelta({
      supabase: params.adminSupabase,
      entityId: params.entityId,
      snapshot,
      drift,
      lom: emergencyLom,
      localStrategy,
    });
    localDeltaApplied = delta.applied;
    localDeltaStrategyId = delta.strategyId;
    localCacheId = delta.local_cache_id ?? null;
    globalPromotionStatus =
      (delta.promotion_status as GlobalPromotionStatus | undefined) ??
      GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS;
  }

  const narrativeMeta = buildNarrativeLogMetadata({
    ledger: "hall",
    bugIndex: SENTINEL_BUG_INDEX,
    extra: {
      beat_kind: "diagnostic_snapshot",
      diagnostic_snapshot: snapshot,
      self_heal_report: true,
      source: snapshot.source,
      logic_drift: {
        score: drift.score,
        factors: drift.factors,
        contradicts_p2_roadmap: drift.contradictsP2Roadmap,
        escalate_to_global_brain: drift.escalateToGlobalBrain,
        preflight_tier: drift.preflightTier,
        hal_score: drift.halScore,
      },
      emergency_lom: emergencyLom,
      local_delta_applied: localDeltaApplied,
      local_delta_strategy_id: localDeltaStrategyId,
      remediation_strategies: remediationDtos,
    },
  });

  const { data: logRow, error: logErr } = await params.adminSupabase
    .from("p4_narrative_logs")
    .insert({
      tenant_id: tenantIdForNarrativeLog(tenantId),
      actor_id: params.entityId,
      action_type: "DIAGNOSTIC_SNAPSHOT",
      message: snapshot.operator_note.slice(0, 2000),
      severity: hasManualInterventionRequired(snapshot) ? "Violation" : "Warning",
      metadata: narrativeMeta,
    })
    .select("id")
    .maybeSingle();

  if (logErr) {
    throw new Error(`p4_narrative_logs insert failed: ${logErr.message}`);
  }

  const incidentId = await insertMsgfUserSentinelIncident({
    adminSupabase: params.adminSupabase,
    userId: params.entityId,
    scope: { tenantId, entityId: params.entityId },
    narrativeLogId: logRow?.id as string | undefined,
    bugIndex: SENTINEL_BUG_INDEX,
    strategies: null,
  });

  let escalated = false;
  if (hasManualInterventionRequired(snapshot) || drift.escalateToGlobalBrain) {
    const arbitrateId = await insertMsgfArbitrateIncident({
      adminSupabase: params.adminSupabase,
      userId: params.entityId,
      scope: { tenantId, entityId: params.entityId },
      narrativeLogId: logRow?.id as string | undefined,
      bugIndex: drift.escalateToGlobalBrain
        ? PULSE_BUG_INDEX.hallLomRecursion
        : PULSE_BUG_INDEX.hallHitlRequired,
    });
    escalated = arbitrateId != null;
  }

  const healedPillars = deriveHealedPillars({
    snapshot,
    localDeltaApplied,
    localStrategy,
  });

  const userResumeMessage = localDeltaApplied
    ? globalPromotionStatus === GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING
      ? `${formatSentinelResumeMessage(healedPillars)} Global DNA update is pending admin approval.`
      : formatSentinelResumeMessage(healedPillars)
    : escalated
      ? "Report logged. Ops review is required before you resume high-risk actions."
      : formatSentinelResumeMessage([]);

  return {
    ok: true,
    narrative_log_id: (logRow?.id as string | undefined) ?? null,
    incident_id: incidentId,
    escalated_to_arbitrate: escalated,
    logic_drift_score: drift.score,
    logic_drift_escalate: drift.escalateToGlobalBrain,
    emergency_lom: {
      gemini_verdict: emergencyLom.gemini.verdict,
      claude_verdict: emergencyLom.claude.verdict,
      roadmap_conflict_detected: emergencyLom.roadmapConflictDetected,
    },
    local_delta_applied: localDeltaApplied,
    local_delta_strategy_id: localDeltaStrategyId,
    remediation_strategies: remediationDtos,
    healed_pillars: healedPillars,
    user_resume_message: userResumeMessage,
    global_promotion_status: globalPromotionStatus,
    local_cache_id: localCacheId,
  };
}
