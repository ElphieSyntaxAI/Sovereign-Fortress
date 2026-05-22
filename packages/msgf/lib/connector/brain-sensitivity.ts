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
 * Client-safe Brain sensitivity clamp — mirrors pulse route header parsing without server imports.
 */

export const LOGIC_DRIFT_ESCALATION_THRESHOLD = 0.3;
export const LOGIC_DRIFT_THRESHOLD_MIN = 0.1;
export const LOGIC_DRIFT_THRESHOLD_MAX = 0.5;

/** Sent on {@link MsgfBridge.dispatch} as `x-msgf-brain-sensitivity`. */
export const MSGF_BRAIN_SENSITIVITY_HEADER = "x-msgf-brain-sensitivity";

export function resolveBrainSensitivityHeader(
  value?: string | number | null
): number {
  if (value == null || value === "") {
    return LOGIC_DRIFT_ESCALATION_THRESHOLD;
  }

  const n = typeof value === "number" ? value : Number.parseFloat(String(value).trim());
  if (!Number.isFinite(n)) {
    return LOGIC_DRIFT_ESCALATION_THRESHOLD;
  }

  return Math.max(
    LOGIC_DRIFT_THRESHOLD_MIN,
    Math.min(LOGIC_DRIFT_THRESHOLD_MAX, Math.round(n * 1000) / 1000)
  );
}
