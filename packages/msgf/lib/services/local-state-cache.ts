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
 * Session-local LogicDelta cache — Redis hot path + `local_state_cache` table fallback.
 */

import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { msgfRedisKey, redisSet, redisGet, redisDel, isRedisConfigured } from "@/lib/redis";
import { isUuidString } from "@/src/lib/tenant-ids";
import type { LogicDelta } from "@/lib/services/global-approval-gate";
import { GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING } from "@/lib/services/global-approval-gate";

const LOCAL_CACHE_TTL_SEC = Number(process.env.MSGF_LOCAL_STATE_CACHE_TTL_SEC ?? 60 * 60 * 24 * 14);

export type LocalStateCacheRecord = {
  id: string;
  tenant_id: string;
  entity_id: string;
  company_id?: string | null;
  delta_payload: Record<string, unknown>;
  promotion_status: string;
  created_at: string;
  expires_at: string | null;
  promoted_at?: string | null;
  promoted_by_actor_id?: string | null;
  vault_narrative_log_id?: string | null;
  admin_promotion_note?: string | null;
  company_validated_at?: string | null;
  company_validated_by_actor_id?: string | null;
};

export type SaveLogicDeltaResult = {
  cacheId: string;
  promotion_status: string;
  storage: "redis" | "postgres" | "redis+postgres";
};

export function localStateCacheRedisKey(
  tenantId: string,
  entityId: string,
  cacheId: string
): string {
  return msgfRedisKey("local_state_cache", tenantId, entityId, cacheId);
}

function cacheKey(tenantId: string, entityId: string, cacheId: string): string {
  return localStateCacheRedisKey(tenantId, entityId, cacheId);
}

function serializeDelta(delta: LogicDelta, cacheId: string): Record<string, unknown> {
  return {
    id: cacheId,
    tenant_id: delta.tenantId,
    entity_id: delta.entityId,
    content: delta.content,
    summary_beat: delta.summaryBeat ?? null,
    bug_index: delta.bugIndex ?? null,
    metadata: delta.metadata ?? {},
    source: delta.source,
    globalize: delta.globalize === true,
    promotion_status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
    saved_at: new Date().toISOString(),
  };
}

/**
 * Persists a LogicDelta for non-admin self-heal / pending global promotion (never vault_core).
 */
export async function saveLogicDeltaToLocalCache(
  adminSupabase: SupabaseClient,
  delta: LogicDelta
): Promise<SaveLogicDeltaResult> {
  const cacheId = randomUUID();
  const payload = serializeDelta(delta, cacheId);
  const expiresAt = new Date(Date.now() + LOCAL_CACHE_TTL_SEC * 1000).toISOString();

  let storage: SaveLogicDeltaResult["storage"] = "postgres";

  if (isRedisConfigured()) {
    const ok = await redisSet(
      cacheKey(delta.tenantId, delta.entityId, cacheId),
      JSON.stringify(payload),
      LOCAL_CACHE_TTL_SEC
    );
    if (ok) storage = "redis";
  }

  const rawCompany = delta.companyId?.trim();
  const companyCol = rawCompany && isUuidString(rawCompany) ? rawCompany : null;

  const { error } = await adminSupabase.from("local_state_cache").insert({
    id: cacheId,
    tenant_id: delta.tenantId,
    entity_id: delta.entityId,
    company_id: companyCol,
    delta_payload: payload,
    promotion_status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`local_state_cache insert failed: ${error.message}`);
  }

  if (storage === "redis") storage = "redis+postgres";

  return {
    cacheId,
    promotion_status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
    storage,
  };
}

export async function getLogicDeltaFromLocalCache(
  adminSupabase: SupabaseClient,
  tenantId: string,
  cacheId: string,
  entityId?: string
): Promise<LocalStateCacheRecord | null> {
  const eid =
    entityId?.trim() ||
    (await adminSupabase
      .from("local_state_cache")
      .select("entity_id")
      .eq("id", cacheId)
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then((r) => (r.data?.entity_id as string | undefined)?.trim())) ||
    "";

  if (isRedisConfigured() && eid) {
    const raw = await redisGet(cacheKey(tenantId, eid, cacheId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return {
          id: cacheId,
          tenant_id: tenantId,
          entity_id: String(parsed.entity_id ?? ""),
          delta_payload: parsed,
          promotion_status: String(
            parsed.promotion_status ?? GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING
          ),
          created_at: String(parsed.saved_at ?? new Date().toISOString()),
          expires_at: null,
        };
      } catch {
        /* fall through to Postgres */
      }
    }
  }

  const { data, error } = await adminSupabase
    .from("local_state_cache")
    .select("*")
    .eq("id", cacheId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  return data as LocalStateCacheRecord;
}

/**
 * - `vault_promotion`: GLOBAL queue — company-scoped rows only after COMPANY_ADMIN validation; null company_id still allowed (legacy).
 * - `company_validation`: COMPANY inbox — rows awaiting company validation.
 */
export type LocalStateCacheListQueue = "vault_promotion" | "company_validation";

export async function listPendingLocalStateCache(
  adminSupabase: SupabaseClient,
  options?: {
    limit?: number;
    tenantId?: string;
    companyId?: string;
    queue?: LocalStateCacheListQueue;
  }
): Promise<LocalStateCacheRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const queue = options?.queue ?? "vault_promotion";

  let q = adminSupabase
    .from("local_state_cache")
    .select(
      "id, tenant_id, entity_id, promotion_status, created_at, expires_at, delta_payload, promoted_at, promoted_by_actor_id, vault_narrative_log_id, admin_promotion_note, company_id, company_validated_at, company_validated_by_actor_id"
    )
    .eq("promotion_status", GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING)
    .order("created_at", { ascending: false })
    .limit(limit);

  const tid = options?.tenantId?.trim();
  if (tid) {
    q = q.eq("tenant_id", tid);
  }

  const cid = options?.companyId?.trim();

  if (queue === "company_validation") {
    if (!cid) {
      throw new Error("listPendingLocalStateCache: company_validation queue requires companyId.");
    }
    q = q.eq("company_id", cid).is("company_validated_at", null);
  } else {
    q = q.or("company_id.is.null,company_validated_at.not.is.null");
    if (cid) {
      q = q.eq("company_id", cid);
    }
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(`local_state_cache list pending: ${error.message}`);
  }

  return (data ?? []) as LocalStateCacheRecord[];
}

/**
 * COMPANY_ADMIN: marks a LogicDelta as validated so it appears on the global vault promotion queue.
 */
export async function markLocalStateCacheCompanyValidated(
  adminSupabase: SupabaseClient,
  params: {
    cacheId: string;
    tenantId: string;
    companyId: string;
    validatorActorId: string;
  }
): Promise<void> {
  const cid = params.companyId.trim();
  const cacheId = params.cacheId.trim();
  const tid = params.tenantId.trim();
  const actor = params.validatorActorId.trim();
  if (!cid || !cacheId || !tid || !actor) {
    throw new Error("markLocalStateCacheCompanyValidated: cacheId, tenantId, companyId, validatorActorId required.");
  }

  const now = new Date().toISOString();

  const { data: row, error: loadErr } = await adminSupabase
    .from("local_state_cache")
    .select("id, company_id, promotion_status, company_validated_at")
    .eq("id", cacheId)
    .eq("tenant_id", tid)
    .maybeSingle();

  if (loadErr) {
    throw new Error(`local_state_cache read: ${loadErr.message}`);
  }
  if (!row) {
    throw new Error("LogicDelta row not found.");
  }
  if (row.promotion_status !== GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING) {
    throw new Error("Row is not pending promotion.");
  }
  if (!row.company_id || String(row.company_id) !== cid) {
    throw new Error("LogicDelta is outside your company scope.");
  }
  if (row.company_validated_at) {
    throw new Error("LogicDelta was already validated by a company admin.");
  }

  const { error: updErr } = await adminSupabase
    .from("local_state_cache")
    .update({
      company_validated_at: now,
      company_validated_by_actor_id: actor,
    })
    .eq("id", cacheId)
    .eq("tenant_id", tid)
    .eq("promotion_status", GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING)
    .is("company_validated_at", null);

  if (updErr) {
    throw new Error(`local_state_cache company validate: ${updErr.message}`);
  }
}

export async function invalidateLocalStateCacheRedis(
  tenantId: string,
  entityId: string,
  cacheId: string
): Promise<void> {
  if (!isRedisConfigured()) return;
  await redisDel(cacheKey(tenantId, entityId.trim(), cacheId));
}
