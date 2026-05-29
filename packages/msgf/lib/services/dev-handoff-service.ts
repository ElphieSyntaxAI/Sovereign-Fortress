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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * Dev handoff — derive dev-cycle signals from active incidents for a tenant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { computeDevHandoff, type DevHandoffDto } from "@/lib/dev-heal-config";

export async function fetchDevHandoffForTenant(
  admin: SupabaseClient,
  tenantId: string
): Promise<DevHandoffDto> {
  const { data, error } = await admin
    .from("p4_active_incidents")
    .select("id, occurrence_count")
    .eq("tenant_id", tenantId)
    .order("occurrence_count", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[dev-handoff] p4_active_incidents query failed", error.message);
    return computeDevHandoff({ max_occurrence_count: 0, incident_id: null });
  }

  if (!data) {
    return computeDevHandoff({ max_occurrence_count: 0, incident_id: null });
  }

  return computeDevHandoff({
    max_occurrence_count: Number(data.occurrence_count ?? 0),
    incident_id: typeof data.id === "string" ? data.id : null,
  });
}
