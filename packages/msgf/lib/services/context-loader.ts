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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/**
 * Pulse context — dual **Law Books** for Vault lineage:
 *
 * - **Book 1 (Global / `global_vault`)**: read-only core logic stored under {@link MSGF_VAULT_CORE_TENANT_ID}.
 * - **Book 2 (Local / `tenant_vault`)**: editable business logic under the active tenant silo.
 *
 * **Conflict policy**: if a Local row targets the same law key as a **Global Security** row from Book 1,
 * the global law **preempts** (local row is dropped from the merged set).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { MSGF_VAULT_CORE_TENANT_ID } from "@/lib/services/global-approval-gate";
import { normalizeTenantId } from "@/lib/services/msgf-metadata-scope";
import type { VaultLineageRow } from "@/lib/services/p2-flow-roadmap";
import {
  applyPillarVectorsTenantFilter,
  filterPillarRowsByTenant,
  resolveTenantIdForQuery,
} from "@/lib/services/tenant-query-scope";
import { fetchVaultLineage111 } from "@/lib/services/vault-lineage-111";

/** Book 1 — system Hall / global vault tenant. */
export const LAW_BOOK_GLOBAL_VAULT = "global_vault" as const;
/** Book 2 — customer / project tenant vault. */
export const LAW_BOOK_TENANT_VAULT = "tenant_vault" as const;

export type LawBookId = typeof LAW_BOOK_GLOBAL_VAULT | typeof LAW_BOOK_TENANT_VAULT;

/** Set on merged rows' metadata as `law_book` for observability (in-memory; not persisted). */
export function annotateLawBook(row: VaultLineageRow, book: LawBookId): VaultLineageRow {
  const meta =
    row.metadata && typeof row.metadata === "object"
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  return {
    ...row,
    metadata: {
      ...meta,
      law_book: book,
    },
  };
}

/**
 * Global Security laws are non-overridable by tenant-local vault rows with the same {@link lawConflictKey}.
 * Ingestion should set `metadata.law_kind` to `SECURITY` or `GLOBAL_SECURITY`, or `metadata.global_security`.
 */
export function isGlobalSecurityLaw(row: VaultLineageRow): boolean {
  const m = row.metadata;
  if (!m || typeof m !== "object") return false;
  const rec = m as Record<string, unknown>;
  const kind = rec.law_kind;
  if (kind === "SECURITY" || kind === "GLOBAL_SECURITY") return true;
  if (rec.global_security === true) return true;
  if (rec.global_security === "true") return true;
  return false;
}

/**
 * Stable key for preempt: prefer genealogical / bug index instance when present.
 */
export function lawConflictKey(row: VaultLineageRow): string {
  const m = row.metadata;
  if (m && typeof m === "object") {
    const rec = m as Record<string, unknown>;
    const inst = rec.bug_index_instance;
    if (typeof inst === "string" && inst.trim()) return inst.trim().toLowerCase();
    const bio = rec.bug_index;
    if (bio && typeof bio === "object") {
      const b = bio as Record<string, unknown>;
      const l = b.level_1_1_1_instance;
      if (typeof l === "string" && l.trim()) return l.trim().toLowerCase();
    }
  }
  return row.id;
}

/**
 * After merge, Book 1 rows precede Book 2. Local rows that conflict with a Book 1 **security** law are removed.
 */
export function mergeLawBooksWithGlobalSecurityPreempt(
  globalVaultRows: VaultLineageRow[],
  tenantVaultRows: VaultLineageRow[]
): VaultLineageRow[] {
  const securityKeys = new Set<string>();
  for (const row of globalVaultRows) {
    if (isGlobalSecurityLaw(row)) {
      securityKeys.add(lawConflictKey(row));
    }
  }

  const filteredLocal = tenantVaultRows.filter((row) => !securityKeys.has(lawConflictKey(row)));

  const book1 = globalVaultRows.map((r) => annotateLawBook(r, LAW_BOOK_GLOBAL_VAULT));
  const book2 = filteredLocal.map((r) => annotateLawBook(r, LAW_BOOK_TENANT_VAULT));

  return [...book1, ...book2];
}

/**
 * Parallel load of both Law Books + security-aware merge (used by Pulse Cross-Ref lineage).
 */
export async function loadMergedPulseVaultLineage111(
  supabase: SupabaseClient,
  pulseText: string,
  tenantId: string
): Promise<VaultLineageRow[]> {
  const tid = resolveTenantIdForQuery(tenantId);
  const globalTid = MSGF_VAULT_CORE_TENANT_ID.trim();
  if (!globalTid) {
    throw new Error("context-loader: MSGF_VAULT_CORE_TENANT_ID is not configured.");
  }

  const [globalBook, localBook] = await Promise.all([
    fetchVaultLineage111(supabase, pulseText, globalTid),
    fetchVaultLineage111(supabase, pulseText, tid),
  ]);

  return mergeLawBooksWithGlobalSecurityPreempt(globalBook, localBook);
}

export type LawBookExcerpt = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  law_book: LawBookId;
};

/**
 * Admin / dashboard: recent vault ledger excerpts (no pulse-token gating).
 */
export async function listVaultLawBookExcerpts(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { limit?: number }
): Promise<LawBookExcerpt[]> {
  const tid = resolveTenantIdForQuery(tenantId);
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
  const book: LawBookId =
    normalizeTenantId(tid) === normalizeTenantId(MSGF_VAULT_CORE_TENANT_ID)
      ? LAW_BOOK_GLOBAL_VAULT
      : LAW_BOOK_TENANT_VAULT;

  type FilterEq = { eq: (column: string, value: string) => FilterEq };

  let query: FilterEq = fromPillarVectors(supabase, tid)
    .select("id, content, metadata")
    .eq("metadata->>ledger", "vault")
    .order("id", { ascending: false })
    .limit(limit) as unknown as FilterEq;

  query = applyPillarVectorsTenantFilter(query, tid);
  const { data, error } = await (query as unknown as Promise<{
    data: VaultLineageRow[] | null;
    error: { message: string } | null;
  }>);
  if (error) {
    throw new Error(`listVaultLawBookExcerpts: ${error.message}`);
  }

  return filterPillarRowsByTenant((data ?? []) as VaultLineageRow[], tid).map((row) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    law_book: book,
  }));
}
