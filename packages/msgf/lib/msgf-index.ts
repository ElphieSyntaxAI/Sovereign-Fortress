import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface LogicLineageRequest {
  queryText: string;
  /**
   * Optional precomputed embedding for pgvector search.
   * If omitted, this module attempts to create one via text-embedding-004.
   */
  queryEmbedding?: number[];
  matchCount?: number;
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
  matchCount: number
): Promise<PillarVectorRow[]> {
  // Requires a SQL RPC function in Supabase, e.g.:
  // match_pillar_vectors(query_embedding vector, match_count int, filter jsonb)
  const { data, error } = await supabase.rpc("match_pillar_vectors", {
    query_embedding: embedding,
    match_count: matchCount,
    filter: {
      pillar: "P6",
      index_type: "genealogical_bug_index",
      instance: "1.1.1",
      ledger: "vault",
    },
  });

  if (error) throw error;
  return (data ?? []) as PillarVectorRow[];
}

async function lexicalFallbackScan(
  supabase: SupabaseClient,
  queryText: string,
  matchCount: number
): Promise<PillarVectorRow[]> {
  const { data, error } = await supabase
    .from("pillar_vectors")
    .select("content, metadata")
    .eq("metadata->>pillar", "P6")
    .eq("metadata->>index_type", "genealogical_bug_index")
    .eq("metadata->>instance", "1.1.1")
    .eq("metadata->>ledger", "vault")
    .limit(Math.max(20, matchCount * 3));

  if (error) throw error;

  return ((data ?? []) as PillarVectorRow[])
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

  if (embedding?.length) {
    try {
      rows = await vectorScan(supabase, embedding, matchCount);
    } catch {
      // Fallback to lexical if pgvector RPC is not present yet.
      rows = await lexicalFallbackScan(supabase, queryText, matchCount);
    }
  } else {
    rows = await lexicalFallbackScan(supabase, queryText, matchCount);
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

