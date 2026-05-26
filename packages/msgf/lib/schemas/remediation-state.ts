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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
/** Max consecutive remediation failures before PENDING_HUMAN_ARBITRATION. */
export const REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS = 3;

export const REMEDIATION_STATE = {
  ACTIVE: "ACTIVE",
  SCHEDULED: "SCHEDULED",
  PENDING_HUMAN_ARBITRATION: "PENDING_HUMAN_ARBITRATION",
  RESOLVED: "RESOLVED",
} as const;

export type RemediationStateValue =
  (typeof REMEDIATION_STATE)[keyof typeof REMEDIATION_STATE];

export function isCircuitBreakerTrippedState(
  state: string | null | undefined
): boolean {
  return state === REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION;
}
