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
 * Distribution Build ID: MSGF-463028d-20260519T150411Z-internal
 */
/**
 * Persist full Pulse forensic traces — `admin_vault` is service_role-only (not tenant API keys).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertPulseAdminVaultForensic(params: {
  adminSupabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  kind?: string;
  payload: Record<string, unknown>;
}): Promise<string | null> {
  const tenantId = params.tenantId.trim();
  const entityId = params.entityId.trim();
  if (!tenantId || !entityId) return null;

  const kind = params.kind?.trim() || "pulse_forensic";

  const { data, error } = await params.adminSupabase
    .from("admin_vault")
    .insert({
      tenant_id: tenantId,
      entity_id: entityId,
      kind,
      payload: params.payload as never,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[admin_vault] insert failed:", error.message);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}
