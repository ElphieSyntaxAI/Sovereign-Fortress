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
 * Syntax Education — Positive Index (The Vault) strength retrieval for Socratic scaffolding.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/ai-utils";
import { STUDENT_STRENGTH_INDEX_TYPE } from "@/lib/education/curriculum-metadata";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import {
  applyPillarVectorsTenantFilter,
  filterPillarRowsByTenant,
  resolveTenantIdForQuery,
} from "@/lib/services/tenant-query-scope";

export type StudentStrengthHit = {
  id: string;
  content: string;
  similarity: number;
  strengthLabel?: string;
  summary?: string;
  subjectDomain?: string;
  halScore?: number;
};

export type StudentStrengthsRequest = {
  supabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  queryText: string;
  subjectDomain?: string;
  matchCount?: number;
  queryEmbedding?: number[];
};

function mapStrengthRow(row: {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  cosine_similarity?: number;
}): StudentStrengthHit {
  const md = row.metadata ?? {};
  return {
    id: row.id,
    content: row.content,
    similarity: row.cosine_similarity ?? 0,
    strengthLabel:
      typeof md.strength_label === "string" ? md.strength_label : undefined,
    summary: typeof md.summary === "string" ? md.summary : undefined,
    subjectDomain:
      typeof md.subject_domain === "string" ? md.subject_domain : undefined,
    halScore:
      typeof md.hal_score === "number"
        ? md.hal_score
        : typeof md.hal_score === "string"
          ? Number(md.hal_score)
          : undefined,
  };
}

async function vectorStrengthScan(
  supabase: SupabaseClient,
  tenantId: string,
  entityId: string,
  embedding: number[],
  matchCount: number,
  subjectDomain?: string
): Promise<StudentStrengthHit[]> {
  const { data, error } = await supabase.rpc("match_student_vault_strengths", {
    p_tenant_id: tenantId,
    p_entity_id: entityId,
    p_query_embedding: embedding,
    p_match_count: matchCount,
    p_subject_domain: subjectDomain ?? null,
  });

  if (error) throw error;

  return filterPillarRowsByTenant(
    (data ?? []) as {
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      cosine_similarity: number;
    }[],
    tenantId
  ).map(mapStrengthRow);
}

async function lexicalStrengthFallback(
  supabase: SupabaseClient,
  tenantId: string,
  entityId: string,
  matchCount: number,
  subjectDomain?: string
): Promise<StudentStrengthHit[]> {
  type FilterEq = { eq: (column: string, value: string) => FilterEq };

  let query: FilterEq = fromPillarVectors(supabase, tenantId)
    .select("id, content, metadata")
    .eq("metadata->>pillar", "P6")
    .eq("metadata->>index_type", STUDENT_STRENGTH_INDEX_TYPE)
    .order("id", { ascending: false })
    .limit(40) as unknown as FilterEq;

  query = applyPillarVectorsTenantFilter(query, tenantId);

  const { data, error } = await (query as unknown as Promise<{
    data: { id: string; content: string; metadata: Record<string, unknown> }[] | null;
    error: { message: string } | null;
  }>);

  if (error) {
    console.warn("[student-vault-strengths] fallback query failed:", error.message);
    return [];
  }

  const entityNorm = entityId.trim();
  return filterPillarRowsByTenant(data ?? [], tenantId)
    .filter((row) => {
      const md = row.metadata ?? {};
      const eid =
        typeof md.entity_id === "string"
          ? md.entity_id
          : typeof md.author_id === "string"
            ? md.author_id
            : "";
      if (eid !== entityNorm) return false;
      if (subjectDomain && md.subject_domain && md.subject_domain !== subjectDomain) {
        return false;
      }
      const hal =
        typeof md.hal_score === "number"
          ? md.hal_score
          : Number(md.hal_score ?? 0);
      if (
        md.index_type === "genealogical_bug_index" &&
        md.ledger === "vault" &&
        hal < 70
      ) {
        return false;
      }
      return true;
    })
    .slice(0, matchCount)
    .map((row) => ({
      ...mapStrengthRow(row),
      similarity: 0.5,
    }));
}

/**
 * Fetch historic strengths from The Vault (Positive Index) for strength-based scaffolding.
 */
export async function retrieveStudentVaultStrengths(
  request: StudentStrengthsRequest
): Promise<StudentStrengthHit[]> {
  const tenantId = resolveTenantIdForQuery(request.tenantId);
  const entityId = request.entityId.trim();
  const matchCount = request.matchCount ?? 5;
  const queryText = request.queryText.trim();

  if (!entityId) return [];

  const embedding =
    request.queryEmbedding ?? (queryText ? await generateEmbedding(queryText) : null);

  try {
    if (embedding && embedding.length >= 128) {
      return await vectorStrengthScan(
        request.supabase,
        tenantId,
        entityId,
        embedding,
        matchCount,
        request.subjectDomain
      );
    }
  } catch {
    // RPC not deployed yet.
  }

  return lexicalStrengthFallback(
    request.supabase,
    tenantId,
    entityId,
    matchCount,
    request.subjectDomain
  );
}
