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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Quantifies logic drift for Sentinel diagnostic snapshots (routes self-heal vs LOM).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { runDefendPreflight as preFlightCheck } from "@/lib/defend-preflight";
import type { DiagnosticSnapshot } from "@/lib/schemas/diagnostic-snapshot";
import {
  assessLogicDrift,
  type LogicDriftAssessment,
} from "@/lib/services/logic-drift";
import type { PrioritizedVaultLineage } from "@/lib/services/p2-flow-roadmap";
import { resolvePrioritizedVaultLineageForP2 } from "@/lib/services/vault-lineage-p2-cache";

export type SentinelDriftAssessment = LogicDriftAssessment & {
  pulseText: string;
  vaultP2Prioritized: PrioritizedVaultLineage;
  halScore: number;
  preflightTier: string;
};

function buildPulseTextFromSnapshot(snapshot: DiagnosticSnapshot): string {
  const editor = snapshot.editor ?? {};
  const parts = [
    snapshot.operator_note?.trim() ?? "",
    typeof editor.editor_text_excerpt === "string" ? editor.editor_text_excerpt : "",
    typeof editor.wiki_notes_excerpt === "string" ? editor.wiki_notes_excerpt : "",
    typeof editor.manuscript_title === "string" ? editor.manuscript_title : "",
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, 8000);
}

function estimateHalFromSnapshot(snapshot: DiagnosticSnapshot): number {
  const keys = snapshot.keystrokes_last_10 ?? [];
  if (!keys.length) return 78;
  const backspaces = keys.filter((k) => k.isBackspace).length;
  const pastes = keys.filter((k) => k.isSystemEvent).length;
  let score = 88;
  if (backspaces > 4) score -= 12;
  if (pastes > 0) score -= 8;
  return Math.max(55, Math.min(100, score));
}

function keystrokesSuggestBiometricDrift(snapshot: DiagnosticSnapshot): boolean {
  const bio = snapshot.biometric_telemetry;
  if (bio && typeof bio === "object" && bio.biometric_drift_suspected === true) {
    return true;
  }

  const keys = snapshot.keystrokes_last_10 ?? [];
  const flights = keys
    .map((k) => k.flightTime)
    .filter((f): f is number => typeof f === "number" && f > 0);
  if (flights.length < 4) return false;
  const avg = flights.reduce((a, b) => a + b, 0) / flights.length;
  return flights.some((f) => Math.abs(f - avg) / avg > 0.35);
}

export class LogicDriftService {
  /**
   * Score snapshot text against Vault lineage + P2 Roadmap + DEFEND preflight.
   */
  async assessFromDiagnosticSnapshot(params: {
    adminSupabase: SupabaseClient;
    snapshot: DiagnosticSnapshot;
    tenantId: string;
    entityId?: string;
    documentId?: string;
  }): Promise<SentinelDriftAssessment> {
    const pulseText = buildPulseTextFromSnapshot(params.snapshot);
    const editor = params.snapshot.editor ?? {};
    const manuscriptId =
      params.documentId ??
      (typeof editor.manuscript_id === "string" ? editor.manuscript_id : undefined);

    const lineage = await resolvePrioritizedVaultLineageForP2({
      supabase: params.adminSupabase,
      tenantId: params.tenantId,
      pulseText,
      documentId: manuscriptId,
    });
    const p2Roadmap = lineage.p2Roadmap;
    const vaultP2Prioritized = lineage.prioritized;

    const preflight = await preFlightCheck(
      params.adminSupabase,
      {
        text: pulseText,
        contextTag: "user_sentinel_self_heal",
      },
      { tenantId: params.tenantId }
    );

    const halScore = estimateHalFromSnapshot(params.snapshot);
    const assessment = assessLogicDrift({
      pulseText,
      halScore,
      vaultP2Prioritized,
      preflight,
      biometricDeltaOver30: keystrokesSuggestBiometricDrift(params.snapshot),
    });

    return {
      ...assessment,
      pulseText,
      vaultP2Prioritized,
      halScore,
      preflightTier: preflight.tier,
    };
  }
}

export const logicDriftService = new LogicDriftService();
