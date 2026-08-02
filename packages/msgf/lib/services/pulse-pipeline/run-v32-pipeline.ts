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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * V3.2-ULTRA Pulse orchestrator — GATE → CONSENSUS → ARBITRATE → PERSIST.
 */

import { randomUUID } from "crypto";

import type { PulseEngine } from "@/lib/services/PulseEngine";
import type {
  PulseFullPipelineInput,
  PulseFullPipelineResult,
} from "@/lib/services/PulseEngine";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import { isCostRunawayError } from "@/lib/services/cost-runaway-guard";
import { recordCostRunawayDeadLetterSafe } from "@/lib/services/llm-dead-letter";
import { runGatePhase } from "@/lib/services/pulse-pipeline/gate-phase";
import { runConsensusPhase } from "@/lib/services/pulse-pipeline/consensus-phase";
import { runPersistPhase } from "@/lib/services/pulse-pipeline/persist-phase";

export async function runV32PulsePipeline(
  engine: PulseEngine,
  input: PulseFullPipelineInput
): Promise<PulseFullPipelineResult> {
  const pulseTraceId = input.traceId?.trim() || randomUUID();

  try {
    const gateResult = await runGatePhase(engine, input, pulseTraceId, {
      forcedConvergeTier: input.forcedConvergeTier ?? null,
    });
    if (gateResult.kind === "baseline_required") {
      return gateResult.result;
    }

    const consensusResult = await runConsensusPhase(engine, input, gateResult);
    if (consensusResult.kind === "local") {
      return consensusResult.result;
    }

    return runPersistPhase(
      engine,
      input,
      gateResult,
      consensusResult.converged,
      consensusResult.convergeRouting
    );
  } catch (e: unknown) {
    if (isCostRunawayError(e)) {
      await recordCostRunawayDeadLetterSafe({
        adminSupabase: input.adminSupabase,
        tenantId: input.tenantId,
        entityId: input.entityId,
        traceId: pulseTraceId,
        operation: "pulse.v32_pipeline",
        error: e,
      });
      throw new PulseHttpError(503, {
        error: "MSGF cost-runaway guard tripped (timeout or AI recursion cap).",
        code: "COST_RUNAWAY_GUARD",
        trace_id: pulseTraceId,
      });
    }
    throw e;
  }
}
