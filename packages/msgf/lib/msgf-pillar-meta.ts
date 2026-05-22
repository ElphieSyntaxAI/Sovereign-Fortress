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
/** Hierarchical lineage labels aligned with P6 DEFEND / constraint ledger 1.1.1. */
export function pillarGateMeta(pillar: "P6") {
  if (pillar === "P6") {
    return {
      pillar: "P6" as const,
      lineageLabel: "MSGF_V3_STRICT.constraint_ledger.1.1.1",
      violationCode: "P6_DEFEND_LOM_VIOLATION",
    };
  }
  throw new Error(`pillarGateMeta: unsupported pillar ${String(pillar)}`);
}
