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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
/**
 * Admin read of `p4_narrative_logs` for ARBITRATE / HITL ops (service-role only).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { applyPillarVectorsTenantFilter } from "@/lib/services/tenant-query-scope";

export type AdminNarrativeLogRow = {
  id: string;
  created_at: string;
  tenant_id: string;
  actor_id: string | null;
  action_type: string | null;
  message: string;
  severity: string | null;
  metadata: Record<string, unknown> | null;
};

export type AdminNarrativeLogView = AdminNarrativeLogRow & {
  keystrokes_plain_text: string | null;
  models_disagree: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function extractModelsDisagreeBlob(
  metadata: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!metadata) return null;

  const direct = asRecord(metadata.models_disagree);
  if (direct) return direct;

  const consensus = asRecord(metadata.consensus_summary);
  if (consensus) {
    return {
      gemini: consensus.gemini,
      claude: consensus.claude,
      models_disagree: consensus.models_disagree,
      all_human_confirmed: consensus.all_human_confirmed,
    };
  }

  if (typeof metadata.models_disagree === "boolean") {
    return { flag: metadata.models_disagree };
  }

  return null;
}

function extractKeystrokesPlainText(
  metadata: Record<string, unknown> | null,
  pillarContent: string | null
): string | null {
  if (metadata && typeof metadata.keystrokes_plain_text === "string") {
    const t = metadata.keystrokes_plain_text.trim();
    if (t) return metadata.keystrokes_plain_text;
  }
  if (pillarContent?.trim()) return pillarContent;
  return null;
}

async function fetchPillarContentFallback(
  admin: SupabaseClient,
  tenantId: string | null,
  bugIndex: GenealogicalBugIndex | null
): Promise<string | null> {
  if (!tenantId || !bugIndex) return null;

  type FilterEq = { eq: (column: string, value: string) => FilterEq };

  let query: FilterEq = fromPillarVectors(admin, tenantId)
    .select("content, metadata")
    .eq("metadata->>instance_slug", bugIndex.level_1_1_1_instance)
    .order("metadata->>persisted_at", { ascending: false })
    .limit(1) as unknown as FilterEq;

  query = applyPillarVectorsTenantFilter(query, tenantId);

  const { data, error } = await (
    query as unknown as {
      maybeSingle: () => Promise<{
        data: { content?: unknown } | null;
        error: { message: string } | null;
      }>;
    }
  ).maybeSingle();

  if (error || !data?.content) return null;
  return typeof data.content === "string" ? data.content : null;
}

function bugIndexFromMetadata(metadata: Record<string, unknown> | null): GenealogicalBugIndex | null {
  const idx = metadata?.bug_index;
  if (!idx || typeof idx !== "object" || Array.isArray(idx)) return null;
  const o = idx as Record<string, unknown>;
  if (
    typeof o.level_1_category === "string" &&
    typeof o.level_1_1_branch === "string" &&
    typeof o.level_1_1_1_instance === "string"
  ) {
    return {
      level_1_category: o.level_1_category,
      level_1_1_branch: o.level_1_1_branch,
      level_1_1_1_instance: o.level_1_1_1_instance,
    };
  }
  return null;
}

export type ListAdminNarrativeLogsParams = {
  adminSupabase: SupabaseClient;
  tenantId?: string;
  /** Filter `metadata.project_origin` (repo tag from SWEEP ingest). */
  projectOrigin?: string;
  limit?: number;
};

export async function listAdminNarrativeLogs(
  params: ListAdminNarrativeLogsParams
): Promise<AdminNarrativeLogRow[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

  let query = params.adminSupabase
    .from("p4_narrative_logs")
    .select("id, created_at, tenant_id, actor_id, action_type, message, severity, metadata")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params.tenantId?.trim()) {
    query = query.eq("tenant_id", params.tenantId.trim());
  }

  if (params.projectOrigin?.trim()) {
    query = query.eq("metadata->>project_origin", params.projectOrigin.trim());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`p4_narrative_logs list: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...(row as AdminNarrativeLogRow),
    metadata: asRecord((row as AdminNarrativeLogRow).metadata),
  }));
}

export async function getAdminNarrativeLogById(params: {
  adminSupabase: SupabaseClient;
  id: string;
}): Promise<AdminNarrativeLogView | null> {
  const { data, error } = await params.adminSupabase
    .from("p4_narrative_logs")
    .select("id, created_at, tenant_id, actor_id, action_type, message, severity, metadata")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    throw new Error(`p4_narrative_logs read: ${error.message}`);
  }
  if (!data) return null;

  const row = data as AdminNarrativeLogRow;
  const metadata = asRecord(row.metadata);
  const bugIndex = bugIndexFromMetadata(metadata);

  const pillarContent = await fetchPillarContentFallback(
    params.adminSupabase,
    row.tenant_id || row.actor_id,
    bugIndex
  );

  return {
    ...row,
    metadata,
    keystrokes_plain_text: extractKeystrokesPlainText(metadata, pillarContent),
    models_disagree: extractModelsDisagreeBlob(metadata),
  };
}
