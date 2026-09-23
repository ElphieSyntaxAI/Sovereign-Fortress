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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Admin-only promotion: `local_state_cache` → `vault_core` (MSGF_VAULT_CORE_TENANT_ID pillar_vectors).
 * Audit: suggested_by = dev entity; promoted_by = operator id (header or body).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import {
  GenealogicalBugIndexSchema,
  PULSE_BUG_INDEX,
} from "@/lib/schemas/vault-hall-metadata";
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import { persistToVault } from "@/lib/services/constraint-ledger";
import {
  GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
  GLOBAL_PROMOTION_STATUS_PROMOTED_TO_VAULT_CORE,
  MSGF_VAULT_CORE_TENANT_ID,
} from "@/lib/services/global-approval-gate";
import type { LocalStateCacheListQueue } from "@/lib/services/local-state-cache";
import {
  invalidateLocalStateCacheRedis,
  listPendingLocalStateCache,
  type LocalStateCacheRecord,
} from "@/lib/services/local-state-cache";
import {
  extractGlobalSafeVaultContent,
  redactProjectSensitiveText,
  sanitizeGenealogicalBugIndexForGlobal,
  sanitizeMetadataForGlobalAudit,
} from "@/lib/services/logic-pattern-sanitize";
import { invalidateTenantLineageCache } from "@/lib/services/vault-lineage-p2-cache";

export type ListPendingGlobalPromotionsParams = {
  adminSupabase: SupabaseClient;
  limit?: number;
  tenantId?: string;
  companyId?: string;
  queue?: LocalStateCacheListQueue;
};

export type PromoteLocalCacheToVaultCoreParams = {
  adminSupabase: SupabaseClient;
  /** PK of `local_state_cache`. */
  cacheId: string;
  /** Originating dev / project silo (must match row.tenant_id). */
  originatingTenantId: string;
  /** Operator user id (audit) — who clicked Approve. */
  promotedByActorId: string;
  adminNote?: string;
};

export type PromoteLocalCacheToVaultCoreResult = {
  ok: true;
  local_cache_id: string;
  vault_narrative_log_id: string | null;
  vault_core_tenant_id: string;
  /** Dev (human) who proposed the fix — improves Brain attribution. */
  suggested_by_entity_id: string;
  /** Project silo where the fix was validated locally. */
  suggested_by_tenant_id: string;
  promoted_by_actor_id: string;
  lineage_keys_invalidated: number;
};

function parseBugIndex(raw: unknown): GenealogicalBugIndex {
  const parsed = GenealogicalBugIndexSchema.safeParse(raw);
  return parsed.success ? parsed.data : PULSE_BUG_INDEX.globalPromotionVault;
}

export async function listPendingGlobalPromotions(
  params: ListPendingGlobalPromotionsParams
): Promise<LocalStateCacheRecord[]> {
  return listPendingLocalStateCache(params.adminSupabase, {
    limit: params.limit,
    tenantId: params.tenantId,
    companyId: params.companyId,
    queue: params.queue ?? "vault_promotion",
  });
}

/**
 * Moves a pending LogicDelta into global vault_core so all tenants inherit it on Cross-Ref / DEFEND.
 */
export async function promoteLocalCacheToVaultCore(
  params: PromoteLocalCacheToVaultCoreParams
): Promise<PromoteLocalCacheToVaultCoreResult> {
  const tid = params.originatingTenantId.trim();
  const cid = params.cacheId.trim();
  if (!tid || !cid) {
    throw new Error("promoteLocalCacheToVaultCore: cache_id and originating_tenant_id are required.");
  }

  const promotedBy = params.promotedByActorId.trim() || "msgf_service_admin";

  const { data: row, error: loadErr } = await params.adminSupabase
    .from("local_state_cache")
    .select("*")
    .eq("id", cid)
    .eq("tenant_id", tid)
    .maybeSingle();

  if (loadErr) {
    throw new Error(`local_state_cache read: ${loadErr.message}`);
  }

  const record = row as LocalStateCacheRecord | null;
  if (!record) {
    throw new Error("Pending promotion not found (check cache_id and tenant_id).");
  }

  if (record.promotion_status !== GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING) {
    throw new Error(
      `Row is not pending promotion (status=${record.promotion_status}).`
    );
  }

  if (record.company_id && !record.company_validated_at) {
    throw new Error(
      "Cannot promote: company-scoped LogicDelta must be validated by a COMPANY_ADMIN first."
    );
  }

  const payload =
    record.delta_payload && typeof record.delta_payload === "object"
      ? (record.delta_payload as Record<string, unknown>)
      : {};

  const { content, summaryBeat } = extractGlobalSafeVaultContent(payload);

  if (!content.trim()) {
    throw new Error("Cached LogicDelta has no promotable logic pattern; cannot promote.");
  }

  const bugIndex = sanitizeGenealogicalBugIndexForGlobal(parseBugIndex(payload.bug_index));

  const promotedAt = new Date().toISOString();

  const safeMeta = sanitizeMetadataForGlobalAudit(payload.metadata);

  const vaultResult = await persistToVault({
    supabase: params.adminSupabase,
    entityId: record.entity_id,
    tenantId: MSGF_VAULT_CORE_TENANT_ID,
    content,
    bugIndex,
    summaryBeat,
    legalVersion: CURRENT_LEGAL_VERSION,
    halScore: 100,
    actionType: "GLOBAL_PROMOTION_VAULT",
    narrativeExtra: {
      beat_kind: "global_promotion_vault",
      local_cache_id: record.id,
      originating_tenant_id: record.tenant_id,
      suggested_by_entity_id: record.entity_id,
      suggested_by_tenant_id: record.tenant_id,
      promoted_by_actor_id: promotedBy,
      promoted_at: promotedAt,
      admin_promotion_note: params.adminNote?.trim() ?? null,
      original_delta_source:
        typeof payload.source === "string"
          ? redactProjectSensitiveText(payload.source).slice(0, 500)
          : null,
      logic_pattern_audit_metadata: safeMeta,
    },
  });

  const { error: updErr } = await params.adminSupabase
    .from("local_state_cache")
    .update({
      promotion_status: GLOBAL_PROMOTION_STATUS_PROMOTED_TO_VAULT_CORE,
      promoted_at: promotedAt,
      promoted_by_actor_id: promotedBy,
      vault_narrative_log_id: vaultResult.narrativeLogId ?? null,
      admin_promotion_note: params.adminNote?.trim() ?? null,
    })
    .eq("id", cid)
    .eq("tenant_id", tid);

  if (updErr) {
    throw new Error(`local_state_cache promote update failed: ${updErr.message}`);
  }

  await invalidateLocalStateCacheRedis(record.tenant_id, record.entity_id, record.id);

  const lineage_keys_invalidated = await invalidateTenantLineageCache(
    MSGF_VAULT_CORE_TENANT_ID,
    {}
  );

  return {
    ok: true,
    local_cache_id: record.id,
    vault_narrative_log_id: vaultResult.narrativeLogId ?? null,
    vault_core_tenant_id: MSGF_VAULT_CORE_TENANT_ID,
    suggested_by_entity_id: record.entity_id,
    suggested_by_tenant_id: record.tenant_id,
    promoted_by_actor_id: promotedBy,
    lineage_keys_invalidated,
  };
}
