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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/** Resolution note helpers for admin incident PATCH (Decision Portal). */

export const REMEDIATION_STRATEGY_LABEL_KEY = "remediation_strategy_label";

/**
 * Ensures `resolution_note` includes `remediation_strategy_label: …` for audit / Hall traceability.
 */
export function appendRemediationStrategyLabel(
  resolutionNote: string | null | undefined,
  remediationStrategyLabel: string | null | undefined
): string | null {
  const base = resolutionNote?.trim() ?? "";
  const label = remediationStrategyLabel?.trim();
  if (!label && !base) return null;
  if (!label) return base;

  const tag = `${REMEDIATION_STRATEGY_LABEL_KEY}: ${label}`;
  if (base.includes(tag)) return base;
  return base ? `${base}\n${tag}` : tag;
}
