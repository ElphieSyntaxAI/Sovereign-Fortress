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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
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
import type { SourceHit } from "@/lib/schemas/source-audit";
import {
  applyReputationToHits,
  hitFromLedgerRow,
  loadReputationMap,
} from "@/lib/services/source-audit";

const LINEAGE_INSTANCE = "1.1.1";
const LINEAGE_CATEGORY = "P6";

function overlapScore(a: string, b: string): number {
  const tokenize = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((x) => x.length > 2);
  const at = new Set(tokenize(a));
  const bt = new Set(tokenize(b));
  if (!at.size || !bt.size) return 0;
  let overlap = 0;
  for (const token of at) {
    if (bt.has(token)) overlap++;
  }
  return overlap / Math.max(at.size, bt.size);
}

export type VaultLineageFetchResult = {
  rows: VaultLineageRow[];
  scoredHits: SourceHit[];
  contextHits: SourceHit[];
  prunedHits: SourceHit[];
};

export async function fetchVaultLineage111(
  supabase: SupabaseClient,
  pulseText: string,
  tenantId: string,
  compound?: Omit<CompoundVectorScope, "tenantId">
): Promise<VaultLineageRow[]> {
  const result = await fetchVaultLineage111WithScores(
    supabase,
    pulseText,
    tenantId,
    compound
  );
  return result.rows;
}

/** P7: scored lineage with reputation prune/boost. */
export async function fetchVaultLineage111WithScores(
  supabase: SupabaseClient,
  pulseText: string,
  tenantId: string,
  compound?: Omit<CompoundVectorScope, "tenantId">
): Promise<VaultLineageFetchResult> {
  const tid = resolveTenantIdForQuery(tenantId);
  const scope: CompoundVectorScope = { tenantId: tid, ...compound };

  const seed = pulseText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 8)
    .join(" ");

  if (!seed) {
    return { rows: [], scoredHits: [], contextHits: [], prunedHits: [] };
  }

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

  const rows = [...merged.values()];
  const rawHits = rows.map((row) =>
    hitFromLedgerRow({
      id: String(row.id ?? ""),
      content: row.content || "",
      metadata: row.metadata,
      ledger: "vault",
      score: overlapScore(pulseText, row.content || ""),
    })
  );

  let reputation = new Map<string, number>();
  try {
    reputation = await loadReputationMap(
      supabase,
      tid,
      rawHits.map((h) => h.resource_key)
    );
  } catch {
    reputation = new Map();
  }

  const { contextHits, prunedHits } = applyReputationToHits(rawHits, reputation);
  const scoredHits = [...contextHits, ...prunedHits];

  const contextIds = new Set(
    contextHits.map((h) => h.resource_id).filter((id): id is string => Boolean(id))
  );
  const contextRows =
    contextIds.size > 0 ? rows.filter((r) => contextIds.has(r.id)) : rows;

  return {
    rows: contextRows.length > 0 ? contextRows : rows,
    scoredHits,
    contextHits,
    prunedHits,
  };
}
