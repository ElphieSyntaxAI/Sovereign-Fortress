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
 * Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
 */
/**
 * Tenant silo filters for `pillar_vectors` and `msgf_rules` — prevents cross-project leakage.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { SovereignViolationError } from "@/lib/errors/sovereign-violation";
import { normalizeTenantId } from "@/lib/services/msgf-metadata-scope";

export type PillarLedgerRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
};

type FilterableQuery = {
  eq: (column: string, value: string) => FilterableQuery;
};

/** PostgREST filter: `metadata.tenant_id` must equal the active tenant silo. */
export function applyPillarVectorsTenantFilter<T extends FilterableQuery>(
  query: T,
  tenantId: string
): T {
  return query.eq("metadata->>tenant_id", normalizeTenantId(tenantId)) as T;
}

/** PostgREST filter: `msgf_rules.tenant_id` column (see migration). */
export function applyMsgfRulesTenantFilter<T extends FilterableQuery>(
  query: T,
  tenantId: string
): T {
  return query.eq("tenant_id", normalizeTenantId(tenantId)) as T;
}

export function resolveTenantIdForQuery(
  tenantId: string | undefined | null,
  fallback?: string
): string {
  const tid = tenantId?.trim() || fallback?.trim();
  if (!tid) {
    throw new SovereignViolationError(
      "tenant_id is required for tenant-scoped database queries."
    );
  }
  return normalizeTenantId(tid);
}

/** Defense-in-depth after reads — drops rows whose metadata lacks matching `tenant_id`. */
export function filterPillarRowsByTenant<T extends { metadata: Record<string, unknown> | null }>(
  rows: T[],
  tenantId: string
): T[] {
  const tid = normalizeTenantId(tenantId);
  return rows.filter((row) => {
    const meta = row.metadata;
    if (!meta || typeof meta !== "object") return false;
    return meta.tenant_id === tid;
  });
}

export function pillarRowBelongsToTenant(
  metadata: Record<string, unknown> | null | undefined,
  tenantId: string
): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return metadata.tenant_id === normalizeTenantId(tenantId);
}

/** PostgREST filter: `state_beats.tenant_id` column. */
export function applyStateBeatsTenantFilter<T extends FilterableQuery>(
  query: T,
  tenantId: string
): T {
  return query.eq("tenant_id", normalizeTenantId(tenantId)) as T;
}

/** PostgREST filter: `msgf_incidents.metadata->>tenant_id`. */
export function applyMsgfIncidentsTenantFilter<T extends FilterableQuery>(
  query: T,
  tenantId: string
): T {
  return query.eq("metadata->>tenant_id", normalizeTenantId(tenantId)) as T;
}

/** Filter entity (human) within a tenant silo on `state_beats`. */
export function applyStateBeatsEntityFilter<T extends FilterableQuery>(
  query: T,
  entityId: string
): T {
  return query.eq("author_id", entityId.trim()) as T;
}
