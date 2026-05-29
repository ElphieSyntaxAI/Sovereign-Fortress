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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * V3.2 PERSIST — Vault/Hall writes and global CONVERGE response assembly.
 */

import { HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS } from "@/lib/msgf-hot-layer";
import type { PulseEngine, PulseConvergeContext } from "@/lib/services/PulseEngine";
import type { PulseFullPipelineInput, PulseFullPipelineOk } from "@/lib/services/PulseEngine";
import {
  buildConvergePublicResponseFields,
  usesPlatformMasterConvergeCredentials,
  type ConvergeConsensusRouting,
} from "@/lib/services/converge-consensus-routing";
import {
  buildPulseGlassBoxData,
  buildPulseRemediationSummaryGlobal,
  stripPublicBeat,
} from "@/lib/services/pulse-public-response";
import { ecoAggregatorClient } from "@/lib/services/EcoAggregatorClient";
import { extractProjectOriginFromPulseBody } from "@/lib/utils/pulse-eco-context";
import { recordPulseRoutingOutcome } from "@/lib/services/pulse-routing-stats";
import type { GatePhaseOk } from "@/lib/services/pulse-pipeline/gate-phase";

function estimateP5ContextShardingTokensSaved(ctx: PulseConvergeContext): number {
  const shardableContextChars =
    ctx.beatsContext.length +
    ctx.vaultCrossRefContext.length +
    ctx.p2FlowDirective.length +
    ctx.defendConstraints.length;
  const approximateContextTokens = Math.ceil(shardableContextChars / 4);
  const hotLayerMultiplier = ctx.hotLayerHit || ctx.lineageRedisHit ? 0.72 : 0.38;
  return Math.max(0, Math.floor(approximateContextTokens * hotLayerMultiplier));
}

export async function runPersistPhase(
  engine: PulseEngine,
  input: PulseFullPipelineInput,
  gate: GatePhaseOk,
  converged: PulseConvergeContext,
  convergeRouting: ConvergeConsensusRouting
): Promise<PulseFullPipelineOk> {
  const { defended, logicDrift, tenantCommercial, pulseTraceId } = gate;
  const platformMaster = usesPlatformMasterConvergeCredentials(convergeRouting);

  const persisted = await engine.persist({
    adminSupabase: input.adminSupabase,
    converged,
    pulseTraceId,
    rawBody: input.rawBody,
  });

  const p5TokensSaved = estimateP5ContextShardingTokensSaved(converged);
  if (p5TokensSaved > 0) {
    const projectOrigin =
      extractProjectOriginFromPulseBody(input.rawBody) ?? input.tenantId.trim();
    void ecoAggregatorClient.sendGlobalTelemetryPayload(input.tenantId, p5TokensSaved, {
      userId: input.entityId,
      projectOrigin,
    });
  }

  void recordPulseRoutingOutcome(input.tenantId, "global_converge", p5TokensSaved);

  const remediationSummary = buildPulseRemediationSummaryGlobal({
    ledger: persisted.ledger,
    humanTiebreakerRequired: converged.requiresTieBreaker,
    allHumanConfirmed: converged.allHumanConfirmed,
    modelsDisagree: converged.modelsDisagree,
  });

  const glass = buildPulseGlassBoxData({
    driftScore: logicDrift.score,
    preflightTier: String(converged.preflight.tier),
    routing: "global_brain_converge",
    humanTiebreakerRequired: converged.requiresTieBreaker,
    halScore: converged.halScore,
    ledger: persisted.ledger,
    consensusAllHuman: converged.allHumanConfirmed,
    modelsDisagree: converged.modelsDisagree,
    remediationSummary,
  });

  const publicBody: Record<string, unknown> = {
    ok: true,
    trace_id: pulseTraceId,
    data: glass,
    routing: "global_brain_converge",
    logic_drift_score: logicDrift.score,
    logic_drift_escalation_threshold: logicDrift.escalation_threshold,
    contradicts_p2_roadmap: logicDrift.contradictsP2Roadmap,
    is_pillar_baseline_set: defended.isPillarBaselineSet,
    beat: stripPublicBeat(converged.storedBeat),
    hal_score: converged.halScore,
    retry_count: converged.retryCount,
    tie_breaker_protocol_triggered: converged.tieBreakerProtocolTriggered,
    human_tiebreaker_required: converged.requiresTieBreaker,
    human_tiebreaker_resolved: converged.humanTieBreakerResolved,
    block_user: false,
    active_slice_ttl_seconds: HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
    hot_layer_hit: converged.hotLayerHit,
    lineage_redis_hit: converged.lineageRedisHit,
    vault_narrative_log_id: persisted.vaultNarrativeLogId,
    hall_narrative_log_id: persisted.hallNarrativeLogId,
    ledger: persisted.ledger,
    license_tenant: input.license.tenantId,
    license_tier: input.license.tierId,
    tenant_commercial_segment: tenantCommercial.segment,
    converge_credential_mode: platformMaster
      ? convergeRouting.segment === "individual_perpetual"
        ? "individual_perpetual_platform"
        : "corporate_system"
      : "individual_byok",
    ...buildConvergePublicResponseFields(convergeRouting),
    ...(convergeRouting.segment === "individual_perpetual" && "monthlyUsage" in convergeRouting
      ? {
          monthly_slices_consumed: convergeRouting.monthlyUsage.slicesConsumed,
          monthly_slice_soft_cap: convergeRouting.monthlyUsage.softCap,
        }
      : {}),
    defend_preflight_tier: converged.preflight.tier,
    vault_lineage_hits: converged.vaultLineage.length,
    vault_p2_aligned: converged.vaultP2Prioritized.aligned.length,
    vault_p2_contradicts_roadmap: converged.vaultP2Prioritized.contradicts.length,
    p2_roadmap_version: converged.p2Roadmap.version,
    consensus_all_human: converged.allHumanConfirmed,
    models_disagree: converged.modelsDisagree,
    momentum_increased: converged.momentumIncreased,
    v32_phase: ["gate", "consensus", "arbitrate", "persist"],
  };

  const forensic: Record<string, unknown> = {
    kind: "pulse_global_converge",
    trace_id: pulseTraceId,
    captured_at: new Date().toISOString(),
    tenant_id: input.tenantId,
    entity_id: input.entityId,
    pulse_text: defended.pulseText,
    keystrokes: defended.keystrokes,
    logic_drift: logicDrift,
    chunks: converged.chunks,
    p4_verify_results: converged.verifyResults,
    lom_consensus: converged.consensus.map((c) => ({
      gemini: c.gemini,
      claude: c.claude,
      agreement: c.agreement,
      decision: c.decision,
      halScore: c.halScore,
    })),
    hal_full: converged.hal,
    halt_state_summary: converged.haltStateSummary ?? null,
    persistable_delta: converged.persistableDelta,
    summary_beat: converged.summaryBeat,
    stored_beat_row: converged.storedBeat,
    gemini_verdict: converged.geminiVerdict,
    claude_verdict: converged.claudeVerdict,
    defend_preflight: converged.preflight,
    vault_cross_ref_context: converged.vaultCrossRefContext,
    p2_flow_directive: converged.p2FlowDirective,
    defend_constraints: converged.defendConstraints,
    vault_p2_prioritized: converged.vaultP2Prioritized,
    p2_roadmap: converged.p2Roadmap,
    narrative_ids: {
      vault: persisted.vaultNarrativeLogId,
      hall: persisted.hallNarrativeLogId,
    },
    ledger: persisted.ledger,
    v32_phase: ["gate", "consensus", "arbitrate", "persist"],
  };

  return { kind: "ok", public: publicBody, forensic };
}
