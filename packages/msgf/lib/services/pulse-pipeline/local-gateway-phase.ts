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
 * V3.2 local / bypass CONVERGE paths — fast responses without global dual-model wall clock.
 */

import { HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS, setActiveSlice } from "@/lib/msgf-hot-layer";
import { processLocalGateway } from "@/lib/services/local-state-gateway";
import {
  isDualModelLocalGatewayEnabled,
  runTenantDualModelConsensusGateway,
  type DualModelGatewaySnapshot,
} from "@/lib/services/dual-model-consensus-gateway";
import {
  buildConvergePublicResponseFields,
  shouldRunLocalDualModelGateway,
  type ConvergeConsensusRouting,
} from "@/lib/services/converge-consensus-routing";
import {
  buildPulseGlassBoxData,
  buildPulseRemediationSummaryLocal,
  stripPublicBeat,
} from "@/lib/services/pulse-public-response";
import type { GatePhaseOk } from "@/lib/services/pulse-pipeline/gate-phase";
import type { PulseFullPipelineInput, PulseFullPipelineOk } from "@/lib/services/PulseEngine";
import {
  estimatePulseRoutingTokenSavings,
  recordPulseEcoSavings,
} from "@/lib/services/pulse-eco-savings";
import { recordPulseRoutingOutcome } from "@/lib/services/pulse-routing-stats";

export type LocalGatewayPhaseParams = {
  input: PulseFullPipelineInput;
  gate: GatePhaseOk;
  routing: "local_gateway" | "converge_bypass" | "converge_soft_cap_degraded" | "converge_timeout_degraded";
  convergeRouting: ConvergeConsensusRouting;
  beatLabel?: string;
  convergeBypass?: boolean;
  dualModelGateway?: DualModelGatewaySnapshot;
  convergeTimeout?: boolean;
};

export async function runLocalGatewayPhase(
  params: LocalGatewayPhaseParams
): Promise<PulseFullPipelineOk> {
  const { input, gate } = params;
  const { defended, logicDrift, tenantCommercial, convergeRouting } = gate;
  const pulseTraceId = gate.pulseTraceId;

  const beatLabel =
    params.beatLabel ??
    (params.routing === "converge_soft_cap_degraded"
      ? "converge_soft_cap_degraded"
      : params.routing === "converge_timeout_degraded"
        ? "converge_timeout_degraded"
        : params.routing === "converge_bypass"
          ? "converge_bypass"
          : undefined);

  const local = await processLocalGateway({
    supabase: input.supabase,
    tenantId: input.tenantId,
    entityId: input.entityId,
    legalVersion: gate.legalVersion,
    pulseText: defended.pulseText,
    keystrokes: defended.keystrokes,
    logicDrift,
    isPillarBaselineSet: defended.isPillarBaselineSet,
    defendPreflightTier: defended.preflight.tier,
    pulseTraceId,
    beatLabel,
    convergeBypass: params.convergeBypass,
  });

  await setActiveSlice({
    entityId: input.entityId,
    previousBeats: [...defended.previousBeats, local.storedBeat].slice(-32),
    previousRetryCount: defended.previousRetryCount,
  });

  const remediationSummary = buildPulseRemediationSummaryLocal();
  const glass = buildPulseGlassBoxData({
    driftScore: logicDrift.score,
    preflightTier: String(defended.preflight.tier),
    routing: params.routing,
    humanTiebreakerRequired: false,
    halScore: logicDrift.score,
    ledger: null,
    consensusAllHuman: null,
    modelsDisagree: null,
    remediationSummary,
  });

  const publicBody: Record<string, unknown> = {
    ok: true,
    trace_id: pulseTraceId,
    data: glass,
    routing: params.routing,
    logic_drift_score: logicDrift.score,
    logic_drift_escalation_threshold: logicDrift.escalation_threshold,
    contradicts_p2_roadmap: logicDrift.contradictsP2Roadmap,
    is_pillar_baseline_set: defended.isPillarBaselineSet,
    beat: stripPublicBeat(local.storedBeat),
    hal_score: logicDrift.score,
    retry_count: defended.previousRetryCount,
    tie_breaker_protocol_triggered: false,
    human_tiebreaker_required: false,
    human_tiebreaker_resolved: false,
    block_user: false,
    active_slice_ttl_seconds: HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
    hot_layer_hit: defended.hotLayerHit,
    lineage_redis_hit: defended.lineageRedisHit,
    vault_narrative_log_id: null,
    hall_narrative_log_id: null,
    ledger: null,
    license_tenant: input.license.tenantId,
    license_tier: input.license.tierId,
    defend_preflight_tier: defended.preflight.tier,
    vault_lineage_hits: defended.vaultLineage.length,
    vault_p2_aligned: defended.vaultP2Prioritized.aligned.length,
    vault_p2_contradicts_roadmap: defended.vaultP2Prioritized.contradicts.length,
    p2_roadmap_version: defended.p2Roadmap.version,
    momentum_increased: false,
    tenant_commercial_segment: tenantCommercial.segment,
    converge_routing_action: convergeRouting.action,
    ...(params.convergeTimeout ? { converge_timed_out: true, converge_degraded: true } : {}),
    ...(params.dualModelGateway
      ? {
          dual_model_tenant_agreement_score: params.dualModelGateway.tenant_agreement_score,
          dual_model_sovereign_escalated: params.dualModelGateway.sovereign_escalated,
          dual_model_sovereign_agreement_score: params.dualModelGateway.sovereign_agreement_score,
        }
      : {}),
    ...buildConvergePublicResponseFields(convergeRouting),
  };

  const forensicKind =
    params.routing === "converge_timeout_degraded"
      ? "pulse_converge_timeout_degraded"
      : params.routing === "converge_soft_cap_degraded"
        ? "pulse_converge_soft_cap_degraded"
        : params.routing === "converge_bypass"
          ? "pulse_converge_bypass"
          : "pulse_local_gateway";

  const forensic: Record<string, unknown> = {
    kind: forensicKind,
    trace_id: pulseTraceId,
    captured_at: new Date().toISOString(),
    tenant_id: input.tenantId,
    entity_id: input.entityId,
    pulse_text: defended.pulseText,
    keystrokes: defended.keystrokes,
    logic_drift: logicDrift,
    stored_beat_row: local.storedBeat,
    defend_preflight: defended.preflight,
    tenant_commercial_segment: tenantCommercial.segment,
    converge_routing: convergeRouting,
    dual_model_gateway: params.dualModelGateway ?? null,
  };

  const authorHalTrusted = Boolean(input.authorHalTelemetry);
  const savings = estimatePulseRoutingTokenSavings({
    routing: params.routing,
    contentChars: defended.pulseText.length,
    keystrokeCount: defended.keystrokes.length,
    authorHalTrusted,
  });

  recordPulseEcoSavings({
    tenantId: input.tenantId,
    entityId: input.entityId,
    routing: params.routing,
    pulseText: defended.pulseText,
    keystrokeCount: defended.keystrokes.length,
    authorHalTrusted,
    rawBody: input.rawBody,
  });

  void recordPulseRoutingOutcome(input.tenantId, params.routing, savings.tokens_saved);

  return { kind: "ok", public: publicBody, forensic };
}

export async function maybeRunLocalDualModelGateway(
  input: PulseFullPipelineInput,
  gate: GatePhaseOk
): Promise<DualModelGatewaySnapshot | undefined> {
  if (!isDualModelLocalGatewayEnabled()) return undefined;
  if (!shouldRunLocalDualModelGateway(gate.convergeRouting)) return undefined;

  const { defended, convergeRouting } = gate;
  return runTenantDualModelConsensusGateway({
    adminSupabase: input.adminSupabase,
    tenantId: input.tenantId,
    pulseText: defended.pulseText,
    keystrokes: defended.keystrokes,
    beatsContext: defended.beatsContext,
    p2FlowDirective: defended.p2FlowDirective,
    vaultCrossRefContext: defended.vaultCrossRefContext,
    defendConstraints: defended.defendConstraints,
    geminiModelId: input.geminiModelId,
    byokGeminiKey:
      convergeRouting.action === "run_byok_converge"
        ? convergeRouting.byok.gemini
        : convergeRouting.byok.gemini ?? input.byokGeminiKey,
    byokAnthropicKey:
      convergeRouting.action === "run_byok_converge"
        ? convergeRouting.byok.anthropic
        : convergeRouting.byok.anthropic ?? input.byokAnthropicKey,
    skipTenantCredentialAssert:
      convergeRouting.segment === "corporate_paid" ||
      convergeRouting.action === "run_perpetual_platform_converge",
  });
}
