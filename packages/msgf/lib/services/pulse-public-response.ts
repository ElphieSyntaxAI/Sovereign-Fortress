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
 * Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
 */
/**
 * Pulse HTTP **public** body — Glass Box `data` vs secret forensic (admin_vault only).
 */

import type { StateBeatRow } from "@/lib/P4";

export type PulseGlassBoxData = {
  driftScore: number;
  pillarStatus: {
    preflightTier: string;
    routing: string;
    humanTiebreakerRequired: boolean;
    halScore: number;
    ledger: string | null;
    consensusAllHuman: boolean | null;
    modelsDisagree: boolean | null;
  };
  remediationSummary: string;
};

/** Tenant-safe beat — strips metadata that may contain LOM / HAL subscores or halt-state text. */
export function stripPublicBeat(beat: StateBeatRow): Record<string, unknown> {
  return {
    id: beat.id,
    author_id: beat.author_id,
    tenant_id: beat.tenant_id ?? null,
    beat_text: beat.beat_text,
    sequence_index: beat.sequence_index,
    label: beat.label,
    legal_version: beat.legal_version,
    created_at: beat.created_at,
  };
}

export function buildPulseRemediationSummaryLocal(): string {
  return "Pulse completed on the local gateway. Session checks stayed within your project boundary—no full dual-model chain was invoked for this request.";
}

export function buildPulseRemediationSummaryGlobal(params: {
  ledger: "vault" | "hall" | null;
  humanTiebreakerRequired: boolean;
  allHumanConfirmed: boolean;
  modelsDisagree: boolean;
}): string {
  if (params.humanTiebreakerRequired) {
    return "Manual tie-breaker may be required. Check your dashboard if remediation steps appear. Underlying model reasoning is not exposed here.";
  }
  if (params.ledger === "vault" && params.allHumanConfirmed && !params.modelsDisagree) {
    return "Consensus path succeeded. Your pulse was recorded to the vault ledger.";
  }
  if (params.ledger === "hall") {
    return "This pulse was routed to the constraint ledger for review—follow any in-product guidance.";
  }
  return "Pulse processing finished. See pillar status for whether additional review is suggested.";
}

export function buildPulseGlassBoxData(params: {
  driftScore: number;
  preflightTier: string;
  routing: string;
  humanTiebreakerRequired: boolean;
  halScore: number;
  ledger: string | null;
  consensusAllHuman: boolean | null;
  modelsDisagree: boolean | null;
  remediationSummary: string;
}): PulseGlassBoxData {
  return {
    driftScore: params.driftScore,
    pillarStatus: {
      preflightTier: params.preflightTier,
      routing: params.routing,
      humanTiebreakerRequired: params.humanTiebreakerRequired,
      halScore: params.halScore,
      ledger: params.ledger,
      consensusAllHuman: params.consensusAllHuman,
      modelsDisagree: params.modelsDisagree,
    },
    remediationSummary: params.remediationSummary,
  };
}
