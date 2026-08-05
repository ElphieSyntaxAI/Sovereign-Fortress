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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { VaultLineageRow } from "@/lib/services/p2-flow-roadmap";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import {
  applyPillarVectorsCompoundScopeFilter,
  filterPillarRowsByCompoundScope,
  resolveTenantIdForQuery,
  type CompoundVectorScope,
} from "@/lib/services/tenant-query-scope";
import { filterVaultRowsForRetrieval } from "@/lib/services/vault-quarantine";

const LINEAGE_INSTANCE = "1.1.1";
const LINEAGE_CATEGORY = "P6";

export async function fetchVaultLineage111(
  supabase: SupabaseClient,
  pulseText: string,
  tenantId: string,
  compound?: Omit<CompoundVectorScope, "tenantId">
): Promise<VaultLineageRow[]> {
  const tid = resolveTenantIdForQuery(tenantId);
  const scope: CompoundVectorScope = { tenantId: tid, ...compound };

  const seed = pulseText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 8)
    .join(" ");

  if (!seed) return [];

  const tokens = seed.split(/\s+/).filter((t) => t.length > 3);
  const patterns = [seed, ...tokens].filter(
    (value, index, arr) => arr.indexOf(value) === index
  );

  const merged = new Map<string, VaultLineageRow>();

  for (const pattern of patterns) {
    type FilterEq = { eq: (column: string, value: string) => FilterEq };

    let query: FilterEq = fromPillarVectors(supabase, tid)
      .select("id, content, metadata")
      .eq("metadata->>pillar", LINEAGE_CATEGORY)
      .eq("metadata->>ledger", "vault")
      .eq("metadata->>instance", LINEAGE_INSTANCE)
      .ilike("content", `%${pattern}%`)
      .order("id", { ascending: false })
      .limit(50) as unknown as FilterEq;

    query = applyPillarVectorsCompoundScopeFilter(query, scope);

    const { data, error } = await (query as unknown as Promise<{
      data: VaultLineageRow[] | null;
      error: { message: string } | null;
    }>);

    if (error) {
      console.warn("[vault-lineage-111] query failed:", error.message);
      continue;
    }

    for (const row of filterVaultRowsForRetrieval(
      filterPillarRowsByCompoundScope((data ?? []) as VaultLineageRow[], scope)
    )) {
      merged.set(row.id, row);
    }
    if (merged.size >= 15) break;
  }

  return [...merged.values()];
}
