/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Parent digest — resilience / friction summary (Phase 2; no raw keystrokes).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  summarizeParentAssignmentRows,
  type ParentDigestSummary,
} from "@/lib/education/parent-digest-aggregate";

export type { ParentDigestSummary };

export async function buildParentDigest(params: {
  admin: SupabaseClient;
  tenantId: string;
  entityToken: string;
}): Promise<ParentDigestSummary> {
  const { data, error } = await params.admin
    .from("education_assignment_instances")
    .select("current_state, hal_lite_metrics, entity_token")
    .eq("tenant_id", params.tenantId)
    .eq("entity_token", params.entityToken)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error) throw new Error(`parent digest: ${error.message}`);
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  return summarizeParentAssignmentRows({
    entityToken: params.entityToken,
    rows,
  });
}
