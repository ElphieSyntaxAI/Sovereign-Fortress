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
 * Tenant silo filters for `pillar_vectors` and `msgf_rules` — prevents cross-project leakage.
 * A4: optional compound scope company_id + project_origin + subpath_hash (app-layer mandatory
 * on service_role Pulse paths — see docs/msgf/technical-specs/MSGF_TENANT_ISOLATION.md).
 */

import { SovereignViolationError } from "@/lib/errors/sovereign-violation";
import { normalizeTenantId } from "@/lib/services/msgf-metadata-scope";
import { resolveSubpathHash } from "@/lib/services/vector-scope-key";

export type PillarLedgerRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
};

export type CompoundVectorScope = {
  tenantId: string;
  companyId?: string | null;
  projectOrigin?: string | null;
  /** File or dir — hashed when subpathHash omitted. */
  filePath?: string | null;
  dirPrefix?: string | null;
  subpathHash?: string | null;
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

/**
 * Tenant filter + optional company / project_origin / subpath_hash.
 * Only applies extra eqs when those fields are present (backward compatible).
 */
export function applyPillarVectorsCompoundScopeFilter<T extends FilterableQuery>(
  query: T,
  scope: CompoundVectorScope
): T {
  let q = applyPillarVectorsTenantFilter(query, scope.tenantId);
  const companyId = scope.companyId?.trim();
  if (companyId) {
    q = q.eq("metadata->>company_id", companyId) as T;
  }
  const projectOrigin = scope.projectOrigin?.trim();
  if (projectOrigin) {
    q = q.eq("metadata->>project_origin", projectOrigin.slice(0, 256)) as T;
  }
  const subpathHash = resolveSubpathHash({
    filePath: scope.filePath,
    dirPrefix: scope.dirPrefix,
    explicitHash: scope.subpathHash,
  });
  if (subpathHash) {
    q = q.eq("metadata->>subpath_hash", subpathHash) as T;
  }
  return q;
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

/**
 * Defense-in-depth after reads for compound scope (service_role Pulse invariant).
 * - tenant_id always required
 * - company_id: if filter set, row must match OR lack company_id (legacy)
 * - project_origin / subpath_hash: if filter set, row must match exactly
 */
export function filterPillarRowsByCompoundScope<
  T extends { metadata: Record<string, unknown> | null },
>(rows: T[], scope: CompoundVectorScope): T[] {
  const tid = normalizeTenantId(scope.tenantId);
  const companyId = scope.companyId?.trim() || null;
  const projectOrigin = scope.projectOrigin?.trim() || null;
  const subpathHash = resolveSubpathHash({
    filePath: scope.filePath,
    dirPrefix: scope.dirPrefix,
    explicitHash: scope.subpathHash,
  });

  return rows.filter((row) => {
    const meta = row.metadata;
    if (!meta || typeof meta !== "object") return false;
    if (meta.tenant_id !== tid) return false;

    if (companyId) {
      const rowCo = typeof meta.company_id === "string" ? meta.company_id.trim() : "";
      if (rowCo && rowCo !== companyId) return false;
    }

    if (projectOrigin) {
      const rowPo =
        typeof meta.project_origin === "string" ? meta.project_origin.trim() : "";
      if (rowPo !== projectOrigin) return false;
    }

    if (subpathHash) {
      const rowHash =
        typeof meta.subpath_hash === "string" ? meta.subpath_hash.trim().toLowerCase() : "";
      if (rowHash !== subpathHash) return false;
    }

    return true;
  });
}

export function pillarRowBelongsToTenant(
  metadata: Record<string, unknown> | null | undefined,
  tenantId: string
): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return metadata.tenant_id === normalizeTenantId(tenantId);
}

export function pillarRowMatchesCompoundScope(
  metadata: Record<string, unknown> | null | undefined,
  scope: CompoundVectorScope
): boolean {
  return filterPillarRowsByCompoundScope([{ metadata: metadata ?? null }], scope).length === 1;
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
