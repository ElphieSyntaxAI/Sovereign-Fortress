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
/**
 * Session-local unblock delta — applies RemediationEngine local strategy to state_beats.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { StateLedgerP4, type KeystrokeEvent, type StateBeatRow } from "@/lib/P4";
import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import type { DiagnosticSnapshot } from "@/lib/schemas/diagnostic-snapshot";
import { buildRemediationFixTemplate } from "@/lib/services/RemediationEngine";
import type { ModularRemediationStrategy } from "@/lib/services/RemediationEngine";
import type { EmergencyLomSessionResult } from "@/lib/services/emergency-lom-session";
import { fetchProfileCompanyAndRole } from "@/lib/msgf-operator-access";
import type { SentinelDriftAssessment } from "@/lib/services/LogicDriftService";
import { saveLogicDeltaToLocalCache } from "@/lib/services/local-state-cache";
import { GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS } from "@/lib/services/global-approval-gate";

export const LOCAL_DELTA_BEAT_KIND = "local_delta" as const;

export type ApplyLocalSessionDeltaResult = {
  applied: boolean;
  storedBeat: StateBeatRow | null;
  strategyId: string | null;
  summary: string;
  local_cache_id?: string;
  promotion_status?: string;
};

function snapshotKeystrokesToP4(snapshot: DiagnosticSnapshot): KeystrokeEvent[] {
  const now = Date.now();
  return (snapshot.keystrokes_last_10 ?? []).map((k, i) => ({
    ts:
      typeof k.timestamp === "string" && !Number.isNaN(Date.parse(k.timestamp))
        ? Date.parse(k.timestamp)
        : now - (10 - i) * 80,
    key: k.key,
    type: k.isSystemEvent ? ("input" as const) : ("keydown" as const),
  }));
}

/**
 * Append a `local_delta` beat so the author session can proceed without global CONVERGE.
 */
export async function applyLocalSessionDelta(params: {
  supabase: SupabaseClient;
  entityId: string;
  snapshot: DiagnosticSnapshot;
  drift: SentinelDriftAssessment;
  lom: EmergencyLomSessionResult;
  localStrategy: ModularRemediationStrategy;
}): Promise<ApplyLocalSessionDeltaResult> {
  const fixTemplate = buildRemediationFixTemplate(
    params.localStrategy.pillar,
    params.localStrategy.fix,
    params.localStrategy.consequence
  );

  const summary = [
    "USER_SENTINEL local delta (session unblock).",
    fixTemplate,
    `LOM: gemini=${params.lom.gemini.verdict}, claude=${params.lom.claude.verdict}.`,
    `Drift score=${params.drift.score}.`,
  ].join(" ");

  const tenantId = params.snapshot.tenant_id?.trim();
  if (!tenantId) {
    return {
      applied: false,
      storedBeat: null,
      strategyId: null,
      summary: "tenant_id required for local LogicDelta cache.",
    };
  }
  const p4 = new StateLedgerP4(params.supabase, tenantId);
  const keystrokes = snapshotKeystrokesToP4(params.snapshot);

  const { company_id } = await fetchProfileCompanyAndRole(params.supabase, params.entityId);

  const storedBeat = await p4.appendBeat(params.entityId, summary.slice(0, 4000), {
    legalVersion: CURRENT_LEGAL_VERSION,
    label: "sentinel_local_delta",
    metadata: {
      beat_kind: LOCAL_DELTA_BEAT_KIND,
      source: "USER_SENTINEL",
      gateway: "local",
      unblocks_session: true,
      remediation_strategy_id: params.localStrategy.id,
      remediation_scope: params.localStrategy.scope,
      remediation_pillar: params.localStrategy.pillar,
      logic_drift_score: params.drift.score,
      logic_drift_factors: params.drift.factors,
      emergency_lom: {
        gemini: params.lom.gemini,
        claude: params.lom.claude,
        roadmap_conflict_detected: params.lom.roadmapConflictDetected,
      },
      diagnostic_snapshot_captured_at: params.snapshot.captured_at,
      keystroke_count: keystrokes.length,
      routing: "sentinel_self_heal_local_delta",
    },
  });

  const cached = await saveLogicDeltaToLocalCache(params.supabase, {
    tenantId,
    entityId: params.entityId,
    content: fixTemplate,
    summaryBeat: summary.slice(0, 500),
    source: "self_heal",
    globalize: false,
    companyId: company_id,
    metadata: {
      remediation_strategy_id: params.localStrategy.id,
      logic_drift_score: params.drift.score,
      emergency_lom: params.lom,
    },
  });

  return {
    applied: true,
    storedBeat,
    strategyId: params.localStrategy.id,
    summary,
    local_cache_id: cached.cacheId,
    promotion_status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS,
  };
}
