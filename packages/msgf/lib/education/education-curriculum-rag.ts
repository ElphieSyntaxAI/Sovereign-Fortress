/**
 * Syntax Education — curriculum RAG pipeline (P6 pgvector cold layer, 1.1.1 routing).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/ai-utils";
import {
  CURRICULUM_INDEX_TYPE,
  subjectDomainToLevel1Category,
} from "@/lib/education/curriculum-metadata";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import {
  applyPillarVectorsTenantFilter,
  filterPillarRowsByTenant,
  resolveTenantIdForQuery,
} from "@/lib/services/tenant-query-scope";

export type CurriculumShardHit = {
  id: string;
  content: string;
  similarity: number;
  bugIndex?: GenealogicalBugIndex;
  sourceDocument?: string;
  shardIndex?: number;
  subjectDomain?: string;
};

export type CurriculumRagRequest = {
  supabase: SupabaseClient;
  tenantId: string;
  queryText: string;
  matchCount?: number;
  /** Optional 1.1.1 genealogical filters (category / branch / instance). */
  lineage?: Partial<GenealogicalBugIndex>;
  subjectDomain?: string;
  queryEmbedding?: number[];
};

function mapShardRow(row: {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  cosine_similarity?: number;
  similarity?: number;
}): CurriculumShardHit {
  const md = row.metadata ?? {};
  const bug = md.bug_index as GenealogicalBugIndex | undefined;
  return {
    id: row.id,
    content: row.content,
    similarity: row.cosine_similarity ?? row.similarity ?? 0,
    bugIndex: bug,
    sourceDocument:
      typeof md.source_document === "string" ? md.source_document : undefined,
    shardIndex: typeof md.shard_index === "number" ? md.shard_index : undefined,
    subjectDomain:
      typeof md.subject_domain === "string" ? md.subject_domain : undefined,
  };
}

function lexicalScore(query: string, content: string): number {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (!tokens.length) return 0;
  const c = content.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (c.includes(t)) hits++;
  }
  return hits / tokens.length;
}

async function vectorCurriculumScan(
  supabase: SupabaseClient,
  tenantId: string,
  embedding: number[],
  matchCount: number,
  lineage?: Partial<GenealogicalBugIndex>
): Promise<CurriculumShardHit[]> {
  const { data, error } = await supabase.rpc("match_education_curriculum_shards", {
    p_tenant_id: tenantId,
    p_query_embedding: embedding,
    p_match_count: matchCount,
    p_level_1_category: lineage?.level_1_category ?? null,
    p_level_1_1_branch: lineage?.level_1_1_branch ?? null,
    p_level_1_1_1_instance: lineage?.level_1_1_1_instance ?? null,
  });

  if (error) throw error;

  return filterPillarRowsByTenant(
    (data ?? []) as { id: string; content: string; metadata: Record<string, unknown>; cosine_similarity: number }[],
    tenantId
  ).map(mapShardRow);
}

async function lexicalCurriculumFallback(
  supabase: SupabaseClient,
  tenantId: string,
  queryText: string,
  matchCount: number,
  lineage?: Partial<GenealogicalBugIndex>,
  subjectDomain?: string
): Promise<CurriculumShardHit[]> {
  type FilterEq = { eq: (column: string, value: string) => FilterEq };

  let query: FilterEq = fromPillarVectors(supabase, tenantId)
    .select("id, content, metadata")
    .eq("metadata->>pillar", "P6")
    .eq("metadata->>index_type", CURRICULUM_INDEX_TYPE)
    .limit(Math.max(24, matchCount * 4)) as unknown as FilterEq;

  query = applyPillarVectorsTenantFilter(query, tenantId);

  if (lineage?.level_1_category) {
    query = query.eq(
      "metadata->bug_index->>level_1_category",
      lineage.level_1_category
    );
  } else if (subjectDomain) {
    const l1 = subjectDomainToLevel1Category(subjectDomain);
    if (l1) {
      query = query.eq("metadata->bug_index->>level_1_category", l1);
    }
  }

  const { data, error } = await (query as unknown as Promise<{
    data: { id: string; content: string; metadata: Record<string, unknown> }[] | null;
    error: { message: string } | null;
  }>);

  if (error) throw error;

  return filterPillarRowsByTenant(data ?? [], tenantId)
    .map((row) => ({
      ...mapShardRow(row),
      similarity: lexicalScore(queryText, row.content),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}

/**
 * Infer a coarse 1.1.1 L1 category from the student question when no breakdown is supplied.
 */
export function inferLineageFromQuestion(
  question: string,
  subjectDomain?: string
): Partial<GenealogicalBugIndex> {
  const l1FromSubject = subjectDomainToLevel1Category(subjectDomain);
  if (l1FromSubject) {
    return { level_1_category: l1FromSubject };
  }

  const q = question.toLowerCase();
  if (/\b(fraction|equation|algebra|variable|solve|graph)\b/.test(q)) {
    return { level_1_category: "1.0_MATH" };
  }
  if (/\b(hypothesis|lab|experiment|conclusion|data)\b/.test(q)) {
    return { level_1_category: "1.0_SCIENCE" };
  }
  if (/\b(thesis|paragraph|essay|hook|evidence|outline)\b/.test(q)) {
    return { level_1_category: "1.0_ELA" };
  }
  if (/\b(civil war|revolution|primary source|histor)\b/.test(q)) {
    return { level_1_category: "1.0_HISTORY" };
  }
  return {};
}

/**
 * Retrieve district curriculum shards scoped by tenant + optional 1.1.1 genealogical path.
 */
export async function retrieveCurriculumShards(
  request: CurriculumRagRequest
): Promise<CurriculumShardHit[]> {
  const tenantId = resolveTenantIdForQuery(request.tenantId);
  const queryText = request.queryText.trim();
  const matchCount = request.matchCount ?? 6;

  if (!queryText) return [];

  const lineage =
    request.lineage ??
    (request.subjectDomain
      ? { level_1_category: subjectDomainToLevel1Category(request.subjectDomain) }
      : inferLineageFromQuestion(queryText, request.subjectDomain));

  const embedding =
    request.queryEmbedding ?? (await generateEmbedding(queryText));

  try {
    if (embedding.length >= 128) {
      return await vectorCurriculumScan(
        request.supabase,
        tenantId,
        embedding,
        matchCount,
        lineage
      );
    }
  } catch {
    // RPC may be missing until migration is applied — fall through.
  }

  return lexicalCurriculumFallback(
    request.supabase,
    tenantId,
    queryText,
    matchCount,
    lineage,
    request.subjectDomain
  );
}
