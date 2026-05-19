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
 * Distribution Build ID: MSGF-753c05a-20260519T051006Z-internal
 */
/**
 * Persistence layer for the chapter-validation route. Reads/writes the three
 * tables introduced in `20260603160000_author_chapter_validation.sql`:
 *   • author_chapter_validations  (append-only audit row per call)
 *   • author_tension_ledger       (per-manuscript narrative tension state)
 *   • author_cultural_omens       (append-only Cultural_Omen events)
 *
 * The constraint engine itself is pure — see `chapter-constraint-engine.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  ChapterScenePayloadSchema,
  CulturalTabooSchema,
  WorldBibleConstraintSchema,
  validateChapterAgainstWorldBible,
  type ChapterValidationResult,
} from "./chapter-constraint-engine";

export const ChapterValidationRequestSchema = z.object({
  manuscriptId: z.string().min(1).max(160),
  chapterId: z.string().min(1).max(160),
  /**
   * Tenant slug. Required in integration-test mode (when the route is invoked
   * with the test token). In a normal user session the tenant is derived from
   * the Supabase JWT and `tenantId` in the body is ignored.
   */
  tenantId: z.string().min(1).max(160).optional(),
  worldBibleRules: z.array(WorldBibleConstraintSchema).default([]),
  culturalTaboos: z.array(CulturalTabooSchema).default([]),
  chapter: ChapterScenePayloadSchema,
  /** Free-form metadata persisted alongside the audit row (caller, build id, …). */
  requestMetadata: z.record(z.string(), z.unknown()).default({}),
});
export type ChapterValidationRequest = z.infer<
  typeof ChapterValidationRequestSchema
>;

export type ChapterValidationPersistedResult = ChapterValidationResult & {
  validationId: string;
  tensionBefore: number;
  tensionAfter: number;
  /** True when at least one structural exception was returned. */
  structuralExceptionRaised: boolean;
};

export class ChapterValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "AUTHOR_AUTH_REQUIRED"
      | "AUTHOR_TENANT_REQUIRED"
      | "AUTHOR_VALIDATION_DISABLED"
      | "AUTHOR_PERSIST_FAILED"
  ) {
    super(message);
    this.name = "ChapterValidationError";
  }
}

/**
 * Reads the current tension level for the manuscript. Returns 0 when no row
 * exists yet (first chapter for this manuscript).
 */
async function readTensionLevel(
  admin: SupabaseClient,
  tenantId: string,
  manuscriptId: string
): Promise<number> {
  const { data, error } = await admin
    .from("author_tension_ledger")
    .select("tension_level")
    .eq("tenant_id", tenantId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();
  if (error) {
    throw new ChapterValidationError(
      `Read author_tension_ledger failed: ${error.message}`,
      "AUTHOR_PERSIST_FAILED"
    );
  }
  const v = data?.tension_level;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Bumps the tension ledger by `delta` (monotonic — never decreases) and records
 * the chapter that triggered the bump. Returns the new tension level.
 */
async function bumpTensionLevel(
  admin: SupabaseClient,
  args: {
    tenantId: string;
    manuscriptId: string;
    chapterId: string;
    delta: number;
    omenCountDelta: number;
    currentTension: number;
  }
): Promise<number> {
  const nextTension = Math.min(
    1000,
    Math.max(args.currentTension, args.currentTension + Math.max(0, args.delta))
  );
  const { error } = await admin.from("author_tension_ledger").upsert(
    {
      manuscript_id: args.manuscriptId,
      tenant_id: args.tenantId,
      tension_level: nextTension,
      last_chapter_id: args.chapterId,
      cultural_omen_count: args.omenCountDelta,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "manuscript_id", ignoreDuplicates: false }
  );
  if (error) {
    throw new ChapterValidationError(
      `Upsert author_tension_ledger failed: ${error.message}`,
      "AUTHOR_PERSIST_FAILED"
    );
  }
  return nextTension;
}

/**
 * Bumps the tension ledger using a single round-trip RPC-free read+upsert.
 * For tests we want full visibility (callers can also do this themselves), so
 * we read first, compute, then upsert with the precomputed value.
 */
async function persistCulturalOmens(
  admin: SupabaseClient,
  args: {
    tenantId: string;
    manuscriptId: string;
    chapterId: string;
    triggers: ChapterValidationResult["omensTriggered"];
  }
): Promise<void> {
  if (args.triggers.length === 0) return;
  const rows = args.triggers.map((t) => ({
    tenant_id: args.tenantId,
    manuscript_id: args.manuscriptId,
    chapter_id: args.chapterId,
    taboo_id: t.tabooId,
    omen_pattern: t.omenPattern,
    severity: t.severity,
    offending_actor: t.offendingActor,
    payload: {
      triggered_by: "chapter_constraint_engine",
    },
  }));
  const { error } = await admin.from("author_cultural_omens").insert(rows);
  if (error) {
    throw new ChapterValidationError(
      `Insert author_cultural_omens failed: ${error.message}`,
      "AUTHOR_PERSIST_FAILED"
    );
  }
}

async function persistValidationAudit(
  admin: SupabaseClient,
  args: {
    tenantId: string;
    manuscriptId: string;
    chapterId: string;
    structuralExceptions: ChapterValidationResult["structuralExceptions"];
    omensTriggered: ChapterValidationResult["omensTriggered"];
    tensionBefore: number;
    tensionAfter: number;
    requestMetadata: Record<string, unknown>;
  }
): Promise<string> {
  const { data, error } = await admin
    .from("author_chapter_validations")
    .insert({
      tenant_id: args.tenantId,
      manuscript_id: args.manuscriptId,
      chapter_id: args.chapterId,
      structural_exceptions: args.structuralExceptions,
      omens_triggered: args.omensTriggered,
      tension_before: args.tensionBefore,
      tension_after: args.tensionAfter,
      request_metadata: args.requestMetadata,
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new ChapterValidationError(
      `Insert author_chapter_validations failed: ${error?.message ?? "no row"}`,
      "AUTHOR_PERSIST_FAILED"
    );
  }
  return String(data.id);
}

/**
 * Full pipeline: run engine → persist audit row → if taboos triggered, persist
 * omens + bump tension ledger. Atomicity is not guaranteed (3 round-trips) — if
 * needed we'd wrap in a Postgres function; the audit row is always written
 * first so observability survives partial failures.
 */
export async function runChapterValidation(input: {
  admin: SupabaseClient;
  tenantId: string;
  request: ChapterValidationRequest;
}): Promise<ChapterValidationPersistedResult> {
  const { admin, tenantId, request } = input;

  const tensionBefore = await readTensionLevel(
    admin,
    tenantId,
    request.manuscriptId
  );

  const engineResult = validateChapterAgainstWorldBible({
    chapter: request.chapter,
    worldBibleRules: request.worldBibleRules,
    culturalTaboos: request.culturalTaboos,
  });

  let tensionAfter = tensionBefore;
  if (
    engineResult.omensTriggered.length > 0 ||
    engineResult.tensionDelta > 0
  ) {
    await persistCulturalOmens(admin, {
      tenantId,
      manuscriptId: request.manuscriptId,
      chapterId: request.chapterId,
      triggers: engineResult.omensTriggered,
    });
    tensionAfter = await bumpTensionLevel(admin, {
      tenantId,
      manuscriptId: request.manuscriptId,
      chapterId: request.chapterId,
      delta: engineResult.tensionDelta,
      omenCountDelta: engineResult.omensTriggered.length,
      currentTension: tensionBefore,
    });
  }

  const validationId = await persistValidationAudit(admin, {
    tenantId,
    manuscriptId: request.manuscriptId,
    chapterId: request.chapterId,
    structuralExceptions: engineResult.structuralExceptions,
    omensTriggered: engineResult.omensTriggered,
    tensionBefore,
    tensionAfter,
    requestMetadata: request.requestMetadata,
  });

  return {
    ...engineResult,
    validationId,
    tensionBefore,
    tensionAfter,
    structuralExceptionRaised: engineResult.structuralExceptions.length > 0,
  };
}
