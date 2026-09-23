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

import type { VaultLineageRow } from "@/lib/services/p2-flow-roadmap";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import {
  applyPillarVectorsCompoundScopeFilter,
  filterPillarRowsByCompoundScope,
  resolveTenantIdForQuery,
  type CompoundVectorScope,
} from "@/lib/services/tenant-query-scope";
import { filterVaultRowsForRetrieval } from "@/lib/services/vault-quarantine";
import { generateEmbedding } from "@/lib/ai-utils";
import { scoreMemoryMatch } from "@/lib/gateway/memory-similarity";
import type { SourceHit } from "@/lib/schemas/source-audit";
import {
  applyReputationToHits,
  hitFromLedgerRow,
  loadReputationMap,
} from "@/lib/services/source-audit";

const LINEAGE_INSTANCE = "1.1.1";
const LINEAGE_CATEGORY = "P6";

function asEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const nums = value.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    return nums.length ? nums : null;
  }
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      return asEmbedding(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  return null;
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
      .select("id, content, metadata, embedding")
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
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await generateEmbedding(pulseText);
  } catch {
    queryEmbedding = null;
  }
  const scoredRows = rows
    .map((row) => {
      const embedding = asEmbedding((row as { embedding?: unknown }).embedding);
      const score = scoreMemoryMatch({
        queryText: pulseText,
        rowText: row.content || "",
        queryEmbedding,
        rowEmbedding: embedding,
      });
      return { row, score };
    })
    .filter((item): item is { row: VaultLineageRow; score: number } => item.score != null);
  const rawHits = scoredRows.map(({ row, score }) =>
    hitFromLedgerRow({
      id: String(row.id ?? ""),
      content: row.content || "",
      metadata: row.metadata,
      ledger: "vault",
      score,
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
  const matchedRows = scoredRows.map((item) => item.row);
  const contextRows =
    contextIds.size > 0 ? matchedRows.filter((r) => contextIds.has(r.id)) : matchedRows;

  return {
    rows: contextRows,
    scoredHits,
    contextHits,
    prunedHits,
  };
}
