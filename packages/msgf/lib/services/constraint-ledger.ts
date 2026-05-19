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
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
/**
 * V3.2 differential state: Vault (positive) vs Hall of Hallucinations (negative).
 * Every write inserts `pillar_vectors` and mirrors `p4_narrative_logs` with genealogical `bug_index`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildNarrativeLogMetadata,
  buildVaultHallMetadata,
  type GenealogicalBugIndex,
  type VaultHallMetadata,
} from "@/lib/schemas/vault-hall-metadata";
import { fromPillarVectors, pillarTableForTenant } from "@/lib/msgf-pillar-table";
import { tenantIdForNarrativeLog } from "@/src/lib/tenant-ids";

export type ConstraintLedgerPersistResult = {
  narrativeLogId?: string;
};

export type PersistVaultInput = {
  supabase: SupabaseClient;
  entityId: string;
  tenantId: string;
  content: string;
  bugIndex: GenealogicalBugIndex;
  summaryBeat: string;
  legalVersion: string;
  halScore: number;
  actionType?: string;
  /** Merged into `p4_narrative_logs.metadata` (e.g. human_reasoning, final_fix_applied). */
  narrativeExtra?: Record<string, unknown>;
};

export type PersistHallInput = {
  supabase: SupabaseClient;
  entityId: string;
  tenantId: string;
  content: string;
  bugIndex: GenealogicalBugIndex;
  reason: string;
  tier?: "RED" | "YELLOW" | "GREEN";
  lomAttempts?: number;
  testForceMismatch?: boolean;
  actionType?: string;
  severity?: "Warning" | "Violation";
  /** Merged into `p4_narrative_logs.metadata` (e.g. keystrokes_plain_text, consensus_summary). */
  narrativeExtra?: Record<string, unknown>;
};

async function insertPillarVector(
  supabase: SupabaseClient,
  tenantId: string,
  content: string,
  metadata: VaultHallMetadata
): Promise<void> {
  const tableName = pillarTableForTenant(tenantId);
  const { error } = await fromPillarVectors(supabase, tenantId).insert({
    content,
    metadata,
  });
  if (error) {
    throw new Error(`${tableName} insert (${metadata.ledger}): ${error.message}`);
  }
}

async function insertNarrativeLog(params: {
  supabase: SupabaseClient;
  tenantId: string;
  actorId: string;
  message: string;
  severity: "Info" | "Warning" | "Violation";
  actionType: string;
  ledger: "vault" | "hall";
  bugIndex: GenealogicalBugIndex;
  vaultHallMeta: VaultHallMetadata;
  narrativeExtra?: Record<string, unknown>;
}): Promise<string | undefined> {
  const narrativeMeta = buildNarrativeLogMetadata({
    ledger: params.ledger,
    bugIndex: params.bugIndex,
    extra: {
      vault_hall: params.vaultHallMeta,
      action_type_detail: params.actionType,
      ...(params.narrativeExtra ?? {}),
    },
  });

  const { data, error } = await params.supabase
    .from("p4_narrative_logs")
    .insert({
      tenant_id: tenantIdForNarrativeLog(params.tenantId),
      actor_id: params.actorId,
      action_type: params.actionType,
      message: params.message,
      severity: params.severity,
      metadata: narrativeMeta,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[constraint-ledger] p4_narrative_logs insert failed:", error.message);
    return undefined;
  }

  return data?.id as string | undefined;
}

/**
 * Successful consensus / approved delta → **The Vault** (positive index).
 */
export async function persistToVault(
  input: PersistVaultInput
): Promise<ConstraintLedgerPersistResult> {
  const metadata = buildVaultHallMetadata({
    ledger: "vault",
    bugIndex: input.bugIndex,
    entityId: input.entityId,
    tenantId: input.tenantId,
    legalVersion: input.legalVersion,
    halScore: input.halScore,
    summary: input.summaryBeat,
  });

  await insertPillarVector(input.supabase, input.tenantId, input.content, metadata);

  const logId = await insertNarrativeLog({
    supabase: input.supabase,
    tenantId: input.tenantId,
    actorId: input.entityId,
    message: `Vault: ${input.summaryBeat}`,
    severity: "Info",
    actionType: input.actionType ?? "PULSE_VAULT_PERSIST",
    ledger: "vault",
    bugIndex: input.bugIndex,
    vaultHallMeta: metadata,
    narrativeExtra: input.narrativeExtra,
  });

  return { narrativeLogId: logId };
}

/**
 * LOM disagreement, shadow RED, or rejected logic → **Hall of Hallucinations** (negative index).
 */
export async function persistToHall(
  input: PersistHallInput
): Promise<ConstraintLedgerPersistResult> {
  const metadata = buildVaultHallMetadata({
    ledger: "hall",
    bugIndex: input.bugIndex,
    entityId: input.entityId,
    tenantId: input.tenantId,
    summary: input.reason.slice(0, 2000),
    tier: input.tier ?? "RED",
    reason: input.reason,
    lomAttempts: input.lomAttempts,
    testForceMismatch: input.testForceMismatch,
  });

  await insertPillarVector(input.supabase, input.tenantId, input.content, metadata);

  const logId = await insertNarrativeLog({
    supabase: input.supabase,
    tenantId: input.tenantId,
    actorId: input.entityId,
    message: `Hall: ${input.reason}`,
    severity: input.severity ?? "Violation",
    actionType: input.actionType ?? "PULSE_HALL_REJECT",
    ledger: "hall",
    bugIndex: input.bugIndex,
    vaultHallMeta: metadata,
    narrativeExtra: input.narrativeExtra,
  });

  return { narrativeLogId: logId };
}
