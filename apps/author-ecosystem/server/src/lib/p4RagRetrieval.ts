import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmbedBatchFn } from "./narrative/IngestionService.js";
import { createOpenAIEmbedder } from "./narrative/IngestionService.js";
import type { NarrativeChunkHit } from "./narrative/LibrarianChat.js";
import {
  chunkMatchesManuscriptScope,
  isWikiLockedForRag,
  isWikiSnapshot,
  resolveSeriesRagScope,
  shouldIncludeChunkForP4Rag,
  type SeriesRagScope,
} from "./seriesRagScope.js";
import { isScrappedWiki } from "./wikiEntryHelpers.js";

const EMBEDDING_DIM = 1536;
const SERIES_LOCKED_INJECT_SIM = 0.9;
const MAX_SERIES_LOCKED_INJECT = 28;

function mapRpcRow(r: Record<string, unknown>): NarrativeChunkHit {
  return {
    id: String(r.id),
    content: String(r.content ?? ""),
    source_document: String(r.source_document ?? ""),
    chunk_type: String(r.chunk_type ?? ""),
    chunk_index: Number(r.chunk_index ?? 0),
    metadata: (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as Record<
      string,
      unknown
    >,
    cosine_similarity: Number(r.cosine_similarity ?? 0),
  };
}

function clampTopK(n: number | undefined): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 8;
  return Math.max(1, Math.min(Math.floor(v), 20));
}

async function rpcMatch(
  supabase: SupabaseClient,
  tenantId: string,
  embedding: number[],
  matchCount: number,
  chunkTypes: string[] | null
): Promise<NarrativeChunkHit[]> {
  const { data, error } = await supabase.rpc("match_p4_narrative_library_chunks", {
    p_tenant_id: tenantId,
    p_query_embedding: embedding,
    p_match_count: matchCount,
    p_chunk_types: chunkTypes && chunkTypes.length > 0 ? chunkTypes : null,
  });
  if (error) throw new Error(`match_p4_narrative_library_chunks failed: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => mapRpcRow(row));
}

async function fetchSeriesLockedLore(
  supabase: SupabaseClient,
  scope: SeriesRagScope
): Promise<NarrativeChunkHit[]> {
  if (!scope.isSeries || scope.seriesManuscriptIds.length === 0) return [];

  const { data, error } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, content, source_document, chunk_type, chunk_index, metadata")
    .eq("tenant_id", scope.tenantId)
    .eq("chunk_type", "lore")
    .limit(500);

  if (error) throw new Error(`fetchSeriesLockedLore: ${error.message}`);

  const out: NarrativeChunkHit[] = [];
  for (const row of data ?? []) {
    const meta = (row.metadata && typeof row.metadata === "object"
      ? row.metadata
      : {}) as Record<string, unknown>;
    if (isScrappedWiki(meta)) continue;
    if (!isWikiSnapshot(meta) || !isWikiLockedForRag(meta)) continue;
    if (
      !chunkMatchesManuscriptScope(meta, scope.seriesManuscriptIds, {
        strict: true,
        seriesId: scope.seriesId,
      })
    ) {
      continue;
    }
    out.push({
      id: String(row.id),
      content: String(row.content ?? ""),
      source_document: String(row.source_document ?? ""),
      chunk_type: String(row.chunk_type ?? "lore"),
      chunk_index: Number(row.chunk_index ?? 0),
      metadata: meta,
      cosine_similarity: SERIES_LOCKED_INJECT_SIM,
    });
    if (out.length >= MAX_SERIES_LOCKED_INJECT) break;
  }
  return out;
}

function mergeAndRank(
  vectorHits: NarrativeChunkHit[],
  seriesLocked: NarrativeChunkHit[],
  topK: number
): NarrativeChunkHit[] {
  const byId = new Map<string, NarrativeChunkHit>();
  for (const h of vectorHits) byId.set(h.id, h);
  for (const h of seriesLocked) {
    const prev = byId.get(h.id);
    if (!prev || h.cosine_similarity > prev.cosine_similarity) {
      byId.set(h.id, h);
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.cosine_similarity - a.cosine_similarity)
    .slice(0, topK);
}

export type RetrieveP4NarrativeChunksInput = {
  tenantId: string;
  question: string;
  topK?: number;
  manuscriptId?: string | null;
  includeWikiDrafts?: boolean;
  audience?: "fan" | "author";
  chunkTypes?: Array<"lore" | "plot" | "character">;
  embedBatch?: EmbedBatchFn;
};

/**
 * Vector retrieval over `p4_narrative_library_chunks` with wiki-draft filtering.
 * When the active manuscript belongs to a series, only chunks attributed to manuscripts
 * within that series are kept, and locked wiki lore from every series book is merged in.
 */
export async function retrieveP4NarrativeChunks(
  supabase: SupabaseClient,
  input: RetrieveP4NarrativeChunksInput
): Promise<{ chunks: NarrativeChunkHit[]; scope: SeriesRagScope }> {
  const embedBatch = input.embedBatch ?? createOpenAIEmbedder();
  const q = String(input.question ?? "").trim();
  if (!q) throw new Error("question is required");

  const k = clampTopK(input.topK);
  const audience = input.audience ?? "author";
  const includeWikiDrafts = input.includeWikiDrafts === true;
  const chunkTypes =
    input.chunkTypes && input.chunkTypes.length > 0 ? [...input.chunkTypes] : null;

  const scope = await resolveSeriesRagScope(supabase, input.tenantId, input.manuscriptId);

  const [qVec] = await embedBatch([q]);
  if (!qVec || qVec.length !== EMBEDDING_DIM) {
    throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIM}`);
  }

  const overfetch = scope.isSeries ? Math.min(k * 4, 80) : Math.min(k * 2, 40);
  const rawHits = await rpcMatch(supabase, input.tenantId, qVec, overfetch, chunkTypes);

  const filterOpts = { includeWikiDrafts, audience };
  const filtered = rawHits.filter((h) =>
    shouldIncludeChunkForP4Rag(h.metadata, scope, filterOpts)
  );

  const seriesLocked = await fetchSeriesLockedLore(supabase, scope);
  const chunks = mergeAndRank(filtered, seriesLocked, k);

  return { chunks, scope };
}
