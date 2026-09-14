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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { isDevTestTenant } from "@/lib/msgf-tenant-governance";
import {
  applyPillarVectorsCompoundScopeFilter,
  filterPillarRowsByCompoundScope,
  resolveTenantIdForQuery,
  type CompoundVectorScope,
} from "@/lib/services/tenant-query-scope";
import { filterVaultRowsForRetrieval } from "@/lib/services/vault-quarantine";

export interface LogicLineageRequest {
  queryText: string;
  /** Required — Vault lineage scan is limited to this tenant silo. */
  tenantId: string;
  /**
   * Optional precomputed embedding for pgvector search.
   * If omitted, this module attempts to create one via text-embedding-004.
   */
  queryEmbedding?: number[];
  matchCount?: number;
  /** A4 compound scope — applied when IDE sends project + path. */
  projectOrigin?: string | null;
  companyId?: string | null;
  filePath?: string | null;
  dirPrefix?: string | null;
}

export interface LogicLineageScan {
  category: string;
  branch: string;
  instance: string;
  fixDelta: string;
  similarity?: number;
}

export interface LogicLineageResult {
  lineageScan: LogicLineageScan | null;
  candidates: LogicLineageScan[];
  positiveReinforcement: string;
}

interface PillarVectorRow {
  content: string;
  metadata: Record<string, unknown> | null;
  similarity?: number;
}

function toText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function mapRowToScan(row: PillarVectorRow): LogicLineageScan {
  const md = row.metadata ?? {};
  return {
    category: toText(md["category"], "Unknown Category"),
    branch: toText(md["branch"], "Unknown Branch"),
    instance: toText(md["instance"], "1.1.1"),
    fixDelta: row.content || toText(md["fix_delta"], "No fix delta text available."),
    similarity: row.similarity,
  };
}

function lexicalScore(query: string, content: string): number {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  const c = content.toLowerCase();
  if (!q.length) return 0;
  let hits = 0;
  for (const token of q) {
    if (token.length > 2 && c.includes(token)) hits++;
  }
  return hits / q.length;
}

async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = process.env.GCP_API_KEY;
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values ?? null;
  } catch {
    return null;
  }
}

async function vectorScan(
  supabase: SupabaseClient,
  embedding: number[],
  matchCount: number,
  scope: CompoundVectorScope
): Promise<PillarVectorRow[]> {
  const filter: Record<string, string> = {
    tenant_id: scope.tenantId,
    pillar: "P6",
    index_type: "genealogical_bug_index",
    instance: "1.1.1",
    ledger: "vault",
  };
  if (scope.projectOrigin?.trim()) {
    filter.project_origin = scope.projectOrigin.trim();
  }
  if (scope.companyId?.trim()) {
    filter.company_id = scope.companyId.trim();
  }

  const { data, error } = await supabase.rpc("match_pillar_vectors", {
    query_embedding: embedding,
    match_count: matchCount,
    filter,
  });

  if (error) throw error;
  return filterVaultRowsForRetrieval(
    filterPillarRowsByCompoundScope((data ?? []) as PillarVectorRow[], scope)
  );
}

async function lexicalFallbackScan(
  supabase: SupabaseClient,
  queryText: string,
  matchCount: number,
  scope: CompoundVectorScope
): Promise<PillarVectorRow[]> {
  /** Avoid TS2589 from deep PostgREST filter generics on `pillar_vectors`. */
  type FilterEq = { eq: (column: string, value: string) => FilterEq };

  let query: FilterEq = fromPillarVectors(supabase, scope.tenantId)
    .select("content, metadata")
    .eq("metadata->>pillar", "P6")
    .eq("metadata->>index_type", "genealogical_bug_index")
    .eq("metadata->>instance", "1.1.1")
    .eq("metadata->>ledger", "vault")
    .limit(Math.max(20, matchCount * 3)) as unknown as FilterEq;

  query = applyPillarVectorsCompoundScopeFilter(query, scope);

  const { data, error } = await (query as unknown as Promise<{
    data: PillarVectorRow[] | null;
    error: { message: string } | null;
  }>);

  if (error) throw error;

  return filterVaultRowsForRetrieval(
    filterPillarRowsByCompoundScope((data ?? []) as PillarVectorRow[], scope)
  )
    .map((row) => ({
      ...row,
      similarity: lexicalScore(queryText, row.content || ""),
    }))
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, matchCount);
}

/**
 * Semantic lookup across the 1.1.1 Genealogical Bug Index (Vault)
 * to produce lineage reinforcement for Claude/Gemini consensus.
 */
export async function getLogicLineage(
  supabase: SupabaseClient,
  request: LogicLineageRequest
): Promise<LogicLineageResult> {
  const tenantId = resolveTenantIdForQuery(request.tenantId);
  const scope: CompoundVectorScope = {
    tenantId,
    projectOrigin: request.projectOrigin,
    companyId: request.companyId,
    filePath: request.filePath,
    dirPrefix: request.dirPrefix,
  };
  const queryText = request.queryText?.trim() ?? "";
  const matchCount = request.matchCount ?? 5;
  if (!queryText) {
    return {
      lineageScan: null,
      candidates: [],
      positiveReinforcement: "No query text supplied; lineage scan skipped.",
    };
  }

  const embedding = request.queryEmbedding ?? (await embedQuery(queryText));
  let rows: PillarVectorRow[] = [];

  if (embedding?.length && !isDevTestTenant(tenantId)) {
    try {
      rows = await vectorScan(supabase, embedding, matchCount, scope);
    } catch {
      // Fallback to lexical if pgvector RPC is not present yet.
      rows = await lexicalFallbackScan(supabase, queryText, matchCount, scope);
    }
  } else {
    rows = await lexicalFallbackScan(supabase, queryText, matchCount, scope);
  }

  const candidates = rows.map(mapRowToScan);
  const lineageScan = candidates[0] ?? null;

  const positiveReinforcement = lineageScan
    ? `Positive Reinforcement: reuse proven fix delta from ${lineageScan.category} > ${lineageScan.branch} > ${lineageScan.instance}.`
    : "No 1.1.1 lineage match found; consensus should proceed with caution.";

  return {
    lineageScan,
    candidates,
    positiveReinforcement,
  };
}

