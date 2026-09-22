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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Split heal-queue responses: Small Brain tasks for users, Big Brain arbitration for admins.
 */

import type { HealQueueGetResponse, RemediationTask } from "@/lib/schemas/heal-queue";
import { REMEDIATION_STATE } from "@/lib/schemas/remediation-state";
import type { BrainAudience } from "@/lib/services/brain-routing-policy";

function isBigBrainRemediationTask(
  task: Pick<RemediationTask, "remediation_state" | "circuit_breaker_open">
): boolean {
  return (
    task.remediation_state === REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION ||
    task.circuit_breaker_open === true
  );
}

export function countBigBrainHealQueueItems(payload: {
  remediation_tasks: HealQueueGetResponse["remediation_tasks"];
  human_arbitration_packages: HealQueueGetResponse["human_arbitration_packages"];
}): number {
  const taskCount = payload.remediation_tasks.filter(isBigBrainRemediationTask).length;
  return taskCount + payload.human_arbitration_packages.length;
}

/**
 * User dashboard: actionable Small Brain heals only; Big Brain items summarized as pending admin review.
 */
export function applyHealQueueAudienceScope(
  payload: HealQueueGetResponse,
  audience: BrainAudience
): HealQueueGetResponse & {
  audience_scope: BrainAudience;
  big_brain_escalations_pending?: number;
} {
  if (audience === "admin") {
    return {
      ...payload,
      audience_scope: "admin",
      big_brain_escalations_pending: countBigBrainHealQueueItems(payload),
    };
  }

  const big_brain_escalations_pending = countBigBrainHealQueueItems(payload);

  return {
    ...payload,
    audience_scope: "user",
    big_brain_escalations_pending,
    remediation_tasks: payload.remediation_tasks.filter((t) => !isBigBrainRemediationTask(t)),
    human_arbitration_packages: [],
  };
}
