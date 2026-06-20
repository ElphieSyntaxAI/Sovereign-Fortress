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
 * Syntax Education — P2 Reading Dependency Trigger (pillars §2.2.1).
 *
 * Persists a `reading_gate_satisfied` instructional beat in P4 `state_beats` so the
 * student workspace can unlock composition / lab tooling. This is the canonical
 * server-side acknowledgement of a verified focus block on the embedded reader pane.
 *
 * The client-side `ResourceReaderPane` measures the focus block locally; this
 * endpoint accepts that measurement, validates it against the slice's configured
 * `min_focus_block_ms`, and writes the beat.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getAssignmentResource } from "@/lib/education/assignment-resources";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";
import { appendP4InstructionalBeat } from "@/lib/services/p4-state-ledger-controller";

export const ReadingGateRequestSchema = z
  .object({
    resourceContextId: z.string().uuid(),
    focusBlockMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
    surface: z.string().max(64).optional(),
    sessionId: z.string().uuid().optional(),
  })
  .strict();

export type ReadingGateRequest = z.infer<typeof ReadingGateRequestSchema>;

export type ReadingGateResult = {
  gateSatisfied: boolean;
  minFocusBlockMs: number;
  focusBlockMs: number;
  resourceContextId: string;
  assignmentId: string;
  beatPersisted: boolean;
};

export async function evaluateReadingGate(params: {
  admin: SupabaseClient;
  tenantId: string;
  entityId: string;
  body: unknown;
}): Promise<ReadingGateResult> {
  const parsed = ReadingGateRequestSchema.parse(params.body);

  const row = await getAssignmentResource({
    admin: params.admin,
    resourceContextId: parsed.resourceContextId,
    entityId: params.entityId,
    refreshSignedLink: false,
  });
  if (!row) {
    throw new EducationPolicyHaltError(
      `No assignment resource bound to resource_context_id ${parsed.resourceContextId}.`,
      "EDU_RESOURCE_NOT_FOUND"
    );
  }
  if (row.tenant_id !== params.tenantId) {
    throw new EducationPolicyHaltError(
      "Cross-tenant reading gate evaluation denied.",
      "P1_CATALOG_GOVERNANCE"
    );
  }

  const minMs = row.min_focus_block_ms;
  const gateSatisfied = parsed.focusBlockMs >= minMs;
  let beatPersisted = false;

  if (gateSatisfied) {
    try {
      await appendP4InstructionalBeat({
        supabase: params.admin,
        tenantId: params.tenantId,
        entityId: params.entityId,
        beatText: `Reading dependency satisfied — focus block ${parsed.focusBlockMs} ms on ${row.catalog.title}.`,
        label: "reading_gate_satisfied",
        metadata: {
          pillar_extension: "P2_READING_GATE",
          resource_context_id: row.resource_context_id,
          assignment_id: row.assignment_id,
          catalog_id: row.catalog_id,
          focus_block_ms: parsed.focusBlockMs,
          min_focus_block_ms: minMs,
          surface: parsed.surface ?? "embedded_reader_pane",
          session_id: parsed.sessionId,
          page_start: row.page_start,
          page_end: row.page_end,
        },
      });
      beatPersisted = true;
    } catch (e) {
      console.warn("[reading-gate] beat persistence failed:", e);
    }
  }

  return {
    gateSatisfied,
    minFocusBlockMs: minMs,
    focusBlockMs: parsed.focusBlockMs,
    resourceContextId: row.resource_context_id,
    assignmentId: row.assignment_id,
    beatPersisted,
  };
}

/**
 * Server-side check the workspace controller can call before exposing the editor.
 * Returns the most recent `reading_gate_satisfied` beat (if any) for an
 * (entity, resource_context_id) pair.
 */
export async function loadReadingGateStatus(params: {
  admin: SupabaseClient;
  tenantId: string;
  entityId: string;
  resourceContextId: string;
}): Promise<{
  satisfied: boolean;
  satisfiedAt: string | null;
  focusBlockMs: number | null;
}> {
  const { data, error } = await params.admin
    .from("state_beats")
    .select("created_at, metadata")
    .eq("tenant_id", params.tenantId)
    .eq("entity_id", params.entityId)
    .eq("label", "reading_gate_satisfied")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.warn("[reading-gate] status read failed:", error.message);
    return { satisfied: false, satisfiedAt: null, focusBlockMs: null };
  }

  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (meta.resource_context_id === params.resourceContextId) {
      const focus =
        typeof meta.focus_block_ms === "number" ? (meta.focus_block_ms as number) : null;
      return {
        satisfied: true,
        satisfiedAt: String(row.created_at),
        focusBlockMs: focus,
      };
    }
  }
  return { satisfied: false, satisfiedAt: null, focusBlockMs: null };
}
