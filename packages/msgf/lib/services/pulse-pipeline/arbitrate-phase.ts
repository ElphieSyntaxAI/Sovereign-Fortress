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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import type { RemediationTask } from "@/lib/schemas/heal-queue";
import {
  buildHumanArbitrationPackage,
  buildHumanArbitrationPackagesForTasks,
  resolveHumanArbitrationAction,
  type HumanArbitrationAction,
  type HumanArbitrationComparisonPair,
  type HumanArbitrationPackage,
  type HumanArbitrationRecommendation,
  type HumanArbitrationResolutionResult,
} from "@/lib/services/pulse-pipeline/human-arbitration";

export type ArbitratePhaseInput = {
  remediation_tasks: readonly RemediationTask[];
};

export type ArbitratePhaseResult = {
  pending_human_arbitration: HumanArbitrationPackage[];
  packages_by_path: Record<string, HumanArbitrationPackage>;
};

/**
 * Enrich heal-queue tasks that tripped PENDING_HUMAN_ARBITRATION with strategy comparisons.
 */
export function runArbitratePhase(input: ArbitratePhaseInput): ArbitratePhaseResult {
  const pending_human_arbitration = buildHumanArbitrationPackagesForTasks(
    input.remediation_tasks
  );
  const packages_by_path: Record<string, HumanArbitrationPackage> = {};
  for (const pkg of pending_human_arbitration) {
    packages_by_path[pkg.file_path] = pkg;
  }
  return { pending_human_arbitration, packages_by_path };
}

export {
  buildHumanArbitrationPackage,
  buildHumanArbitrationPackagesForTasks,
  resolveHumanArbitrationAction,
  type HumanArbitrationAction,
  type HumanArbitrationPackage,
  type HumanArbitrationRecommendation,
  type HumanArbitrationComparisonPair,
  type HumanArbitrationResolutionResult,
};
