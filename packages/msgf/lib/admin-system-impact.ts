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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
import type { AdminRemediationStrategy } from "@/lib/admin-browser-api";

/** Explains roadmap / Brain impact when an operator applies a remediation strategy. */
export function buildSystemImpact(strategy: AdminRemediationStrategy): string {
  const pillar = strategy.pillar;
  const lines: string[] = [
    `If applied, Pulse will accept the operator override at the ${pillar} gate and attempt to complete PERSIST with the approved delta.`,
  ];

  switch (pillar) {
    case "SWEEP":
    case "SHARD":
      lines.push(
        "Telemetry and rhythm shards are re-validated; downstream DEFEND/CONVERGE gates run again on the same session slice."
      );
      break;
    case "DEFEND":
      lines.push(
        "The Hall shadow verdict is bypassed for this pulse only. Vault lineage is not auto-purged, but new writes must align with MSGF 1.0 (no legacy monolith rollback)."
      );
      break;
    case "CROSS-REF":
      lines.push(
        "Vault cross-reference is re-scored against the P2 Roadmap; contradictory historical fixes are deprioritized in favor of the canonical pipeline."
      );
      break;
    case "CONVERGE":
      lines.push(
        "Dual-model disagreement is collapsed to a single human-approved path. The Brain resumes CONVERGE → ARBITRATE → PERSIST without opening another LOM recursion loop."
      );
      break;
    case "ARBITRATE":
      lines.push(
        "The ARBITRATE queue entry is cleared; Hall metadata reflects human tie-break. Author session may continue once Pulse returns human_tiebreaker_resolved."
      );
      break;
    case "PERSIST":
      lines.push(
        "A truncated or simplified delta may persist to Vault (positive ledger) instead of Hall. Minor narrative loss is accepted to restore pipeline forward motion."
      );
      break;
    default:
      lines.push("The modular PulseEngine pipeline advances to the next P2 gate per Roadmap SSOT.");
  }

  lines.push(`Consequence watch: ${strategy.consequence} (risk score ${strategy.riskScore}/100).`);

  return lines.join(" ");
}

export function riskScoreTier(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}
