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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Dead-letter path for LLM abort / recursion-cap failures — Hall + loud console (no infinite retry).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import { persistToHall } from "@/lib/services/constraint-ledger";

function alertCostRunawayConsole(params: {
  traceId?: string | null;
  operation?: string;
  error: unknown;
}): void {
  const detail =
    params.error instanceof Error ? `${params.error.name}: ${params.error.message}` : String(params.error);
  console.error("[MSGF COST RUNAWAY — DEAD LETTER]", {
    operation: params.operation ?? "(unknown)",
    trace_id: params.traceId ?? null,
    detail,
  });
}

/**
 * Writes a Hall row when guardrails trip; never throws (avoid masking original failure).
 */
export async function recordCostRunawayDeadLetterSafe(params: {
  adminSupabase: SupabaseClient | undefined | null;
  tenantId: string | undefined | null;
  entityId: string | undefined | null;
  traceId?: string | null;
  operation?: string;
  error: unknown;
}): Promise<void> {
  alertCostRunawayConsole({
    traceId: params.traceId,
    operation: params.operation,
    error: params.error,
  });

  if (!params.adminSupabase || !params.tenantId?.trim() || !params.entityId?.trim()) {
    console.error("[MSGF COST RUNAWAY — DEAD LETTER] skipped Hall persist (missing adminSupabase/tenant/entity)");
    return;
  }

  const reasonRaw =
    params.error instanceof Error ? `${params.error.name}: ${params.error.message}` : String(params.error);
  const reason = [
    params.operation ? `[${params.operation}]` : "[cost_runaway]",
    reasonRaw,
    params.traceId ? `trace_id=${params.traceId}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    await persistToHall({
      supabase: params.adminSupabase,
      tenantId: params.tenantId.trim(),
      entityId: params.entityId.trim(),
      content: `cost_runaway_dead_letter:${params.operation ?? "unknown"}`,
      bugIndex: PULSE_BUG_INDEX.hallCostRunawayDeadLetter,
      reason: reason.slice(0, 4000),
      tier: "RED",
      actionType: "PULSE_HALL_COST_RUNAWAY_DEAD_LETTER",
      severity: "Violation",
      narrativeExtra: {
        cost_runaway_dead_letter: true,
        trace_id: params.traceId ?? null,
        operation: params.operation ?? null,
      },
    });
  } catch (e) {
    console.error("[MSGF COST RUNAWAY — DEAD LETTER] persistToHall failed:", e);
  }
}
