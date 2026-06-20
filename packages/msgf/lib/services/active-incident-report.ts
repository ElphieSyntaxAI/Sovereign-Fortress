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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Upsert p4_active_incidents via RPC (shared by incidents/report and report-issue).
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActiveIncidentUpsertResult = {
  ok: true;
  dedupe_hash: string;
  occurrence_count: number;
  deduplicated: boolean;
  id: string | null;
};

export function buildIncidentDedupeHash(message: string, location: string): string {
  return createHash("sha256").update(`${message}\n${location}`, "utf8").digest("hex");
}

export async function upsertActiveIncidentReport(
  supabase: SupabaseClient,
  params: {
    message: string;
    location: string;
    tenantId: string;
    severity?: "Red" | "Yellow" | "Green";
  }
): Promise<ActiveIncidentUpsertResult | { ok: false; error: string; detail?: string }> {
  const dedupeHash = buildIncidentDedupeHash(params.message, params.location);

  const { data: rpcData, error: rpcError } = await supabase.rpc("p4_upsert_active_incident", {
    p_dedupe_hash: dedupeHash,
    p_tenant_id: params.tenantId,
    p_error_message: params.message,
    p_location: params.location,
    p_severity: params.severity ?? "Yellow",
  });

  if (rpcError) {
    return {
      ok: false,
      error:
        "Database rejected the report. Apply migration 20260506203000_p4_active_incidents.sql if this table is missing.",
      detail: rpcError.message,
    };
  }

  let row = rpcData as unknown;
  if (typeof row === "string") {
    try {
      row = JSON.parse(row) as Record<string, unknown>;
    } catch {
      row = null;
    }
  }
  const out = row as {
    id?: string;
    occurrence_count?: number;
    deduplicated?: boolean;
  } | null;

  return {
    ok: true,
    dedupe_hash: dedupeHash,
    occurrence_count: out?.occurrence_count ?? 1,
    deduplicated: Boolean(out?.deduplicated),
    id: out?.id ?? null,
  };
}
