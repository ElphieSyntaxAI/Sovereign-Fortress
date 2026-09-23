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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Read-only compliance export — narrative logs + active incidents (P4 CEO).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ComplianceExportRow = {
  source: "narrative" | "incident";
  id: string;
  created_at: string;
  tenant_id: string;
  action_type: string | null;
  message: string;
  severity: string | null;
  metadata: Record<string, unknown>;
};

export async function fetchComplianceExport(
  admin: SupabaseClient,
  params: {
    tenant_id: string;
    from?: string;
    to?: string;
    limit?: number;
  }
): Promise<ComplianceExportRow[]> {
  const limit = Math.min(params.limit ?? 500, 2000);
  const rows: ComplianceExportRow[] = [];

  let narrativeQuery = admin
    .from("p4_narrative_logs")
    .select("id, created_at, tenant_id, action_type, message, severity, metadata")
    .eq("tenant_id", params.tenant_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params.from) narrativeQuery = narrativeQuery.gte("created_at", params.from);
  if (params.to) narrativeQuery = narrativeQuery.lte("created_at", params.to);

  const { data: narratives } = await narrativeQuery;
  for (const n of narratives ?? []) {
    rows.push({
      source: "narrative",
      id: n.id,
      created_at: n.created_at,
      tenant_id: n.tenant_id,
      action_type: n.action_type,
      message: n.message,
      severity: n.severity,
      metadata: (n.metadata as Record<string, unknown>) ?? {},
    });
  }

  let incidentQuery = admin
    .from("p4_active_incidents")
    .select("id, last_seen, tenant_id, error_message, severity, occurrence_count, location")
    .eq("tenant_id", params.tenant_id)
    .order("last_seen", { ascending: false })
    .limit(Math.min(limit, 200));

  if (params.from) incidentQuery = incidentQuery.gte("last_seen", params.from);
  if (params.to) incidentQuery = incidentQuery.lte("last_seen", params.to);

  const { data: incidents } = await incidentQuery;
  for (const i of incidents ?? []) {
    rows.push({
      source: "incident",
      id: i.id,
      created_at: i.last_seen,
      tenant_id: i.tenant_id,
      action_type: "ACTIVE_INCIDENT",
      message: i.error_message,
      severity: i.severity,
      metadata: {
        occurrence_count: i.occurrence_count,
        location: i.location,
      },
    });
  }

  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return rows.slice(0, limit);
}
