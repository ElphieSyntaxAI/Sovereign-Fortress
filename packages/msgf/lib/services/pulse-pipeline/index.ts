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
export { runV32PulsePipeline } from "@/lib/services/pulse-pipeline/run-v32-pipeline";
export { runGatePhase } from "@/lib/services/pulse-pipeline/gate-phase";
export { runConsensusPhase } from "@/lib/services/pulse-pipeline/consensus-phase";
export {
  runArbitratePhase,
  buildHumanArbitrationPackage,
  buildHumanArbitrationPackagesForTasks,
  resolveHumanArbitrationAction,
  type ArbitratePhaseInput,
  type ArbitratePhaseResult,
  type HumanArbitrationAction,
  type HumanArbitrationPackage,
  type HumanArbitrationRecommendation,
  type HumanArbitrationComparisonPair,
  type HumanArbitrationResolutionResult,
} from "@/lib/services/pulse-pipeline/arbitrate-phase";
export { runPersistPhase } from "@/lib/services/pulse-pipeline/persist-phase";
export {
  resolvePulseConvergeTimeoutMs,
  shouldGracefulDegradeConvergeOnTimeout,
  PULSE_CONVERGE_TIMEOUT_MS_IDE,
  PULSE_CONVERGE_TIMEOUT_MS_DEFAULT,
} from "@/lib/services/pulse-pipeline/converge-timeout";
