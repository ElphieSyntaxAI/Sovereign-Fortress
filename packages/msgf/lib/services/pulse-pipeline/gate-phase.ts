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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
/**
 * V3.2 GATE — pledge, SHARD baseline, DEFEND (gate + CROSS-REF + preFlightCheck).
 */

import type { PulseEngine } from "@/lib/services/PulseEngine";
import type {
  PulseFullPipelineInput,
  PulseFullPipelineResult,
  PulsePipelineContext,
} from "@/lib/services/PulseEngine";
import {
  ensureTenantPillarBaseline,
  isTenantPillarBaselineSet,
} from "@/lib/services/pillar-baseline";
import { assessLogicDrift } from "@/lib/services/logic-drift";
import { getBiometricProfile, calculateBiometricScore } from "@/lib/msgf-consensus";
import { resolveConvergeConsensusRouting } from "@/lib/services/converge-consensus-routing";
import type { ConvergeConsensusRouting } from "@/lib/services/converge-consensus-routing";

export type GatePhaseBaseline = {
  kind: "baseline_required";
  result: PulseFullPipelineResult;
};

export type GatePhaseOk = {
  kind: "ok";
  pulseTraceId: string;
  legalVersion: string;
  defended: PulsePipelineContext;
  logicDrift: ReturnType<typeof assessLogicDrift>;
  convergeRouting: ConvergeConsensusRouting;
  tenantCommercial: Awaited<
    ReturnType<typeof resolveConvergeConsensusRouting>
  >["commercial"];
  forceGlobal: boolean;
};

export type GatePhaseResult = GatePhaseBaseline | GatePhaseOk;

export async function runGatePhase(
  engine: PulseEngine,
  input: PulseFullPipelineInput,
  pulseTraceId: string
): Promise<GatePhaseResult> {
  const pledge = await engine.assertPledgeAndBaseline(
    input.supabase,
    input.tenantId,
    input.entityId,
    input.hotSession
  );

  if (!pledge.ok) {
    return {
      kind: "baseline_required",
      result: {
        kind: "baseline_required",
        public: { ...pledge.body, trace_id: pulseTraceId },
        forensic: {
          kind: "pulse_baseline_required",
          tenant_id: input.tenantId,
          entity_id: input.entityId,
          trace_id: pulseTraceId,
          captured_at: new Date().toISOString(),
        },
      },
    };
  }

  let isPillarBaselineSet = await isTenantPillarBaselineSet(
    input.adminSupabase,
    input.tenantId
  );
  if (!isPillarBaselineSet) {
    await ensureTenantPillarBaseline(input.adminSupabase, input.tenantId);
    isPillarBaselineSet = await isTenantPillarBaselineSet(
      input.adminSupabase,
      input.tenantId
    );
  }

  const defended = await engine.runThroughDefend(input, isPillarBaselineSet);

  const biometricProfile = await getBiometricProfile(input.supabase, input.entityId);
  const biometric = calculateBiometricScore({
    keystrokes: defended.keystrokes,
    profile: biometricProfile,
    authorHal: input.authorHalTelemetry ?? null,
  });

  const logicDrift = assessLogicDrift({
    pulseText: defended.pulseText,
    halScore: biometric.score,
    biometricDeltaOver30: biometric.deltaOver30Percent,
    vaultP2Prioritized: defended.vaultP2Prioritized,
    preflight: defended.preflight,
    escalationThreshold: input.logicDriftEscalationThreshold,
  });

  const forceGlobal =
    defended.humanTieBreakerResolved || Boolean(defended.approvedDelta?.trim());

  const { commercial: tenantCommercial, routing: convergeRouting } =
    await resolveConvergeConsensusRouting({
      adminSupabase: input.adminSupabase,
      tenantId: input.tenantId,
      entityId: input.entityId,
      license: input.license,
      headerGeminiKey: input.byokGeminiKey,
      headerAnthropicKey: input.byokAnthropicKey,
    });

  return {
    kind: "ok",
    pulseTraceId,
    legalVersion: pledge.legalVersion,
    defended,
    logicDrift,
    convergeRouting,
    tenantCommercial,
    forceGlobal,
  };
}
