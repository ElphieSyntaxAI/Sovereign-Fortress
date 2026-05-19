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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
/**
 * SWEEP ingestion — re-exports {@link IngestService} and legacy `authorId` alias (= tenantId).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  determineBranch,
  determineCategory,
  ingestService,
  pathToGenealogicalBugIndex,
  type IngestFile,
  type SweepIngestResult,
} from "@/lib/services/IngestService";

export type { IngestFile, SweepIngestResult };
export { determineBranch, determineCategory, pathToGenealogicalBugIndex };

export type SweepIngestOptions = {
  files: IngestFile[];
  /**
   * Tenant / project silo UUID.
   * @deprecated Prefer `tenantId` — this field name is retained for callers that still pass `authorId`.
   */
  authorId?: string;
  tenantId?: string;
  supabase: SupabaseClient;
  projectOrigin?: string;
};

function resolveTenantId(options: SweepIngestOptions): string {
  const tid = options.tenantId?.trim() || options.authorId?.trim();
  if (!tid) {
    throw new Error("sweepAndIngest: tenantId (or authorId) is required");
  }
  return tid;
}

export async function sweepAndIngest(options: SweepIngestOptions): Promise<SweepIngestResult> {
  return ingestService.sweepAndIngest({
    files: options.files,
    tenantId: resolveTenantId(options),
    supabase: options.supabase,
    projectOrigin: options.projectOrigin,
  });
}

/** @deprecated Use {@link sweepAndIngest} with `{ files, tenantId, supabase }`. */
export async function sweepAndIngestLegacy(files: IngestFile[]): Promise<string> {
  const { supabase } = await import("@/lib/supabase");
  const result = await sweepAndIngest({
    files,
    tenantId: "00000000-0000-4000-8000-000000000001",
    supabase,
  });
  return result.auditLog;
}
