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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
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
  resourceScope?: {
    resourceContextId?: string;
    catalogId?: string;
    unitId?: string;
    chapterId?: string;
    sectionId?: string;
    pageStart?: number;
    pageEnd?: number;
  };
};

/**
 * Resource scope filter — Socratic Boundary Sync (masterdoc §4.3).
 * Each non-empty field tightens the RAG query to teacher-chopped pages so the tutor
 * cannot cite text outside the assigned slice.
 */
export type CurriculumResourceScopeFilter = {
  resourceContextId?: string;
  catalogId?: string;
  unitIds?: string[];
  chapterIds?: string[];
  sectionIds?: string[];
  pageStart?: number;
  pageEnd?: number;
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
  /** Boundary sync — lock RAG to the teacher's selected slice. */
  resourceScope?: CurriculumResourceScopeFilter;
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
  const scope = md.resource_scope as
    | {
        resource_context_id?: string;
        catalog_id?: string;
        unit_id?: string;
        chapter_id?: string;
        section_id?: string;
        page_start?: number;
        page_end?: number;
      }
    | undefined;
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
    resourceScope: scope
      ? {
          resourceContextId: scope.resource_context_id,
          catalogId: scope.catalog_id,
          unitId: scope.unit_id,
          chapterId: scope.chapter_id,
          sectionId: scope.section_id,
          pageStart: scope.page_start,
          pageEnd: scope.page_end,
        }
      : undefined,
  };
}

/**
 * Final defense-in-depth filter — the SQL RPC already enforces the resource scope,
 * but the lexical fallback path may run when pgvector / RPC is unavailable. This
 * function trims any row whose `resource_scope` falls outside the allowed slice so
 * the Socratic Tutor cannot accidentally cite an unassigned chapter.
 */
export function enforceResourceScope(
  rows: CurriculumShardHit[],
  scope?: CurriculumResourceScopeFilter
): CurriculumShardHit[] {
  if (!scope) return rows;
  const allowedUnits = scope.unitIds && scope.unitIds.length > 0 ? new Set(scope.unitIds) : null;
  const allowedChapters =
    scope.chapterIds && scope.chapterIds.length > 0 ? new Set(scope.chapterIds) : null;
  const allowedSections =
    scope.sectionIds && scope.sectionIds.length > 0 ? new Set(scope.sectionIds) : null;
  const hasAnyScope =
    !!scope.resourceContextId ||
    !!scope.catalogId ||
    allowedUnits ||
    allowedChapters ||
    allowedSections ||
    scope.pageStart != null ||
    scope.pageEnd != null;
  if (!hasAnyScope) return rows;

  return rows.filter((row) => {
    const rs = row.resourceScope;
    if (!rs) return false;
    if (scope.resourceContextId && rs.resourceContextId !== scope.resourceContextId) {
      return false;
    }
    if (scope.catalogId && rs.catalogId !== scope.catalogId) return false;
    if (allowedUnits && (!rs.unitId || !allowedUnits.has(rs.unitId))) return false;
    if (allowedChapters && (!rs.chapterId || !allowedChapters.has(rs.chapterId))) return false;
    if (allowedSections && (!rs.sectionId || !allowedSections.has(rs.sectionId))) return false;
    if (scope.pageStart != null && (rs.pageEnd ?? 0) < scope.pageStart) return false;
    if (scope.pageEnd != null && (rs.pageStart ?? Number.POSITIVE_INFINITY) > scope.pageEnd) {
      return false;
    }
    return true;
  });
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
  lineage?: Partial<GenealogicalBugIndex>,
  scope?: CurriculumResourceScopeFilter
): Promise<CurriculumShardHit[]> {
  const { data, error } = await supabase.rpc("match_education_curriculum_shards", {
    p_tenant_id: tenantId,
    p_query_embedding: embedding,
    p_match_count: matchCount,
    p_level_1_category: lineage?.level_1_category ?? null,
    p_level_1_1_branch: lineage?.level_1_1_branch ?? null,
    p_level_1_1_1_instance: lineage?.level_1_1_1_instance ?? null,
    p_resource_context_id: scope?.resourceContextId ?? null,
    p_catalog_id: scope?.catalogId ?? null,
    p_allowed_unit_ids: scope?.unitIds && scope.unitIds.length > 0 ? scope.unitIds : null,
    p_allowed_chapter_ids:
      scope?.chapterIds && scope.chapterIds.length > 0 ? scope.chapterIds : null,
    p_allowed_section_ids:
      scope?.sectionIds && scope.sectionIds.length > 0 ? scope.sectionIds : null,
    p_page_start: scope?.pageStart ?? null,
    p_page_end: scope?.pageEnd ?? null,
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
      const hits = await vectorCurriculumScan(
        request.supabase,
        tenantId,
        embedding,
        matchCount,
        lineage,
        request.resourceScope
      );
      return enforceResourceScope(hits, request.resourceScope);
    }
  } catch {
    // RPC may be missing until migration is applied — fall through.
  }

  const fallback = await lexicalCurriculumFallback(
    request.supabase,
    tenantId,
    queryText,
    matchCount,
    lineage,
    request.subjectDomain
  );
  return enforceResourceScope(fallback, request.resourceScope);
}
