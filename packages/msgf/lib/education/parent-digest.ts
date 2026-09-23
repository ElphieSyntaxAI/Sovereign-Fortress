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
