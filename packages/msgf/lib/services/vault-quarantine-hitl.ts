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
import type { SupabaseClient } from "@supabase/supabase-js";

import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import { persistToHall } from "@/lib/services/constraint-ledger";
import { appendVaultLog } from "@/lib/services/tenant-onboarding-vault";
import { hitFromVaultId, writeLiveP7 } from "@/lib/services/p7-observe";

export type QuarantinedVaultRow = {
  id: string;
  content: string | null;
  quarantine_status: string | null;
  quarantine_reason: string | null;
  quarantine_sentry_issue_id: string | null;
  quarantine_at: string | null;
  metadata: Record<string, unknown> | null;
};

export type VaultQuarantineHitlAction = "DEMOTE_TO_HALL" | "RESTORE_TO_VAULT";

export async function listQuarantinedVaultRows(
  admin: SupabaseClient,
  opts?: { companyId?: string | null; limit?: number }
): Promise<QuarantinedVaultRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  let query = admin
    .from("pillar_vectors")
    .select(
      "id, content, quarantine_status, quarantine_reason, quarantine_sentry_issue_id, quarantine_at, metadata"
    )
    .eq("quarantine_status", "QUARANTINED")
    .order("quarantine_at", { ascending: false })
    .limit(limit);

  if (opts?.companyId?.trim()) {
    query = query.eq("metadata->>company_id", opts.companyId.trim()) as typeof query;
  }

  const { data, error } = await query;
  if (error) throw new Error(`listQuarantinedVaultRows: ${error.message}`);
  return (data ?? []) as QuarantinedVaultRow[];
}

export async function applyVaultQuarantineHitl(
  admin: SupabaseClient,
  params: {
    vectorId: string;
    action: VaultQuarantineHitlAction;
    operatorUserId: string;
    note?: string | null;
  }
): Promise<{ ok: true; status: string; hall_narrative_log_id?: string } | { ok: false; error: string }> {
  const { data: row, error: readErr } = await admin
    .from("pillar_vectors")
    .select(
      "id, content, quarantine_status, quarantine_reason, quarantine_sentry_issue_id, quarantine_at, metadata"
    )
    .eq("id", params.vectorId)
    .maybeSingle();

  if (readErr || !row) {
    return { ok: false, error: "Vector not found." };
  }

  const current = (row as QuarantinedVaultRow).quarantine_status ?? "NONE";
  const md = ((row as QuarantinedVaultRow).metadata ?? {}) as Record<string, unknown>;
  const companyId = typeof md.company_id === "string" ? md.company_id : null;
  const tenantId =
    (typeof md.tenant_id === "string" && md.tenant_id) ||
    (typeof md.entity_id === "string" && md.entity_id) ||
    "system";
  const entityId =
    (typeof md.entity_id === "string" && md.entity_id) || params.operatorUserId;

  const now = new Date().toISOString();
  const note = params.note?.trim() || null;

  if (params.action === "RESTORE_TO_VAULT") {
    if (current !== "QUARANTINED" && current !== "DEMOTED_HALL") {
      return { ok: false, error: `Cannot restore from status ${current}.` };
    }

    const { error } = await admin
      .from("pillar_vectors")
      .update({
        quarantine_status: "RESTORED",
        quarantine_reason: null,
        quarantine_sentry_issue_id: null,
        quarantine_at: null,
      })
      .eq("id", params.vectorId);

    if (error) return { ok: false, error: error.message };

    writeLiveP7({
      admin,
      tenantId,
      entityId,
      traceId: `vault_hitl_restore_${params.vectorId}`,
      promoteHits: [hitFromVaultId(params.vectorId, false)],
      outcome: "persist_vault",
      decisionKind: "arbitrate",
      routing: "hitl_restore",
    });

    if (companyId) {
      await appendVaultLog(admin, companyId, "vault_quarantine_restored", {
        vector_id: params.vectorId,
        operator_user_id: params.operatorUserId,
        previous_status: current,
        note,
        at: now,
      }).catch(() => undefined);
    }

    return { ok: true, status: "RESTORED" };
  }

  // DEMOTE_TO_HALL
  if (current !== "QUARANTINED") {
    return { ok: false, error: `Demote requires QUARANTINED (got ${current}).` };
  }

  const content =
    ((row as QuarantinedVaultRow).content ?? "").trim() ||
    `Demoted quarantined Vault win ${params.vectorId}`;
  const reason =
    note ||
    (row as QuarantinedVaultRow).quarantine_reason ||
    `HITL demote of quarantined Vault win (Sentry ${(row as QuarantinedVaultRow).quarantine_sentry_issue_id ?? "n/a"})`;

  const hall = await persistToHall({
    supabase: admin,
    entityId,
    tenantId,
    content,
    bugIndex: PULSE_BUG_INDEX.hallHitlRequired,
    reason,
    tier: "RED",
    actionType: "VAULT_QUARANTINE_DEMOTE",
    severity: "Violation",
    narrativeExtra: {
      source_vector_id: params.vectorId,
      quarantine_sentry_issue_id: (row as QuarantinedVaultRow).quarantine_sentry_issue_id,
      operator_user_id: params.operatorUserId,
      project_origin: md.project_origin ?? null,
      company_id: companyId,
    },
  });

  const { error: updErr } = await admin
    .from("pillar_vectors")
    .update({
      quarantine_status: "DEMOTED_HALL",
      quarantine_reason: reason.slice(0, 500),
      quarantine_at: now,
    })
    .eq("id", params.vectorId);

  if (updErr) return { ok: false, error: updErr.message };

  writeLiveP7({
    admin,
    tenantId,
    entityId,
    traceId: `vault_hitl_demote_${params.vectorId}`,
    blockHits: [hitFromVaultId(params.vectorId, true)],
    outcome: "persist_hall",
    decisionKind: "arbitrate",
    routing: "hitl_demote",
    highDrift: true,
  });

  if (companyId) {
    await appendVaultLog(admin, companyId, "vault_quarantine_demoted", {
      vector_id: params.vectorId,
      operator_user_id: params.operatorUserId,
      hall_narrative_log_id: hall.narrativeLogId ?? null,
      note,
      at: now,
    }).catch(() => undefined);
  }

  return {
    ok: true,
    status: "DEMOTED_HALL",
    hall_narrative_log_id: hall.narrativeLogId,
  };
}
