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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
/**
 * V3.2 CONVERGE — routing, dual-model gateway, global converge with bounded wall clock.
 */

import type { PulseEngine, PulseConvergeContext } from "@/lib/services/PulseEngine";
import type { PulseFullPipelineInput } from "@/lib/services/PulseEngine";
import { shouldEscalateToGlobalBrain } from "@/lib/services/logic-drift";
import {
  isConvergeEscalationBypassOrDegraded,
  usesPlatformMasterConvergeCredentials,
} from "@/lib/services/converge-consensus-routing";
import {
  isCostRunawayError,
  runWithLlmTimeoutSimple,
} from "@/lib/services/cost-runaway-guard";
import { recordPerpetualPlatformConvergeSlice } from "@/lib/services/paid-individual-usage";
import type { GatePhaseOk } from "@/lib/services/pulse-pipeline/gate-phase";
import {
  maybeRunLocalDualModelGateway,
  runLocalGatewayPhase,
} from "@/lib/services/pulse-pipeline/local-gateway-phase";
import {
  resolvePulseConvergeTimeoutMs,
  shouldGracefulDegradeConvergeOnTimeout,
} from "@/lib/services/pulse-pipeline/converge-timeout";
import type { PulseFullPipelineOk } from "@/lib/services/PulseEngine";

export type ConsensusPhaseLocal = {
  kind: "local";
  result: PulseFullPipelineOk;
};

export type ConsensusPhaseGlobal = {
  kind: "global";
  converged: PulseConvergeContext;
  convergeRouting: GatePhaseOk["convergeRouting"];
};

export type ConsensusPhaseResult = ConsensusPhaseLocal | ConsensusPhaseGlobal;

export async function runConsensusPhase(
  engine: PulseEngine,
  input: PulseFullPipelineInput,
  gate: GatePhaseOk
): Promise<ConsensusPhaseResult> {
  const { defended, logicDrift, convergeRouting, forceGlobal } = gate;

  if (!shouldEscalateToGlobalBrain(logicDrift, { forceGlobal })) {
    const dualModelGateway = await maybeRunLocalDualModelGateway(input, gate);
    return {
      kind: "local",
      result: await runLocalGatewayPhase({
        input,
        gate,
        routing: "local_gateway",
        convergeRouting,
        dualModelGateway,
      }),
    };
  }

  if (isConvergeEscalationBypassOrDegraded(convergeRouting)) {
    const routing =
      convergeRouting.action === "soft_cap_exceeded_ide_degraded"
        ? "converge_soft_cap_degraded"
        : "converge_bypass";
    return {
      kind: "local",
      result: await runLocalGatewayPhase({
        input,
        gate,
        routing,
        convergeRouting,
        beatLabel: routing,
        convergeBypass: routing !== "converge_soft_cap_degraded",
      }),
    };
  }

  const byokConverge =
    convergeRouting.action === "run_byok_converge"
      ? {
          geminiKey: convergeRouting.byok.gemini!,
          anthropicKey: convergeRouting.byok.anthropic!,
        }
      : undefined;

  const corporateVaultByok =
    convergeRouting.action === "run_corporate_system_converge" &&
    convergeRouting.enterpriseVaultConfigured
      ? {
          geminiKey: convergeRouting.byok.gemini!,
          anthropicKey: convergeRouting.byok.anthropic!,
        }
      : undefined;

  const convergeByok = byokConverge ?? corporateVaultByok;
  const platformMaster = usesPlatformMasterConvergeCredentials(convergeRouting);

  const convergeCtx = {
    ...defended,
    supabase: input.supabase,
    adminSupabase: input.adminSupabase,
    legalVersion: gate.legalVersion,
    geminiModelId: input.geminiModelId,
    license: input.license,
    convergeCredentialMode: platformMaster
      ? convergeRouting.segment === "individual_perpetual"
        ? ("individual_perpetual_platform" as const)
        : ("corporate_system" as const)
      : ("individual_byok" as const),
    byokGeminiKey: convergeByok?.geminiKey,
    byokAnthropicKey: convergeByok?.anthropicKey,
  };

  const timeoutMs = resolvePulseConvergeTimeoutMs({
    isIdePulse: input.isIdePulse,
    license: input.license,
  });
  const gracefulTimeout = shouldGracefulDegradeConvergeOnTimeout({
    isIdePulse: input.isIdePulse,
    license: input.license,
  });

  let converged: PulseConvergeContext;
  try {
    converged = await runWithLlmTimeoutSimple(
      "pulse.v32.converge",
      () => engine.converge(convergeCtx),
      timeoutMs
    );
  } catch (e) {
    if (gracefulTimeout && isCostRunawayError(e)) {
      return {
        kind: "local",
        result: await runLocalGatewayPhase({
          input,
          gate,
          routing: "converge_timeout_degraded",
          convergeRouting,
          beatLabel: "converge_timeout_degraded",
          convergeTimeout: true,
        }),
      };
    }
    throw e;
  }

  if (convergeRouting.action === "run_perpetual_platform_converge") {
    await recordPerpetualPlatformConvergeSlice({
      adminSupabase: input.adminSupabase,
      entityId: input.entityId,
      tenantId: input.tenantId,
      idempotencyKey: gate.pulseTraceId,
      traceId: gate.pulseTraceId,
    });
  }

  return { kind: "global", converged, convergeRouting };
}
