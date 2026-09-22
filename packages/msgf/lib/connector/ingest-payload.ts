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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * MsgfBridge SWEEP ingest contract — shared between connector and API route.
 */

export type IngestFilePayload = {
  path: string;
  content: string;
};

export type IngestPayload = {
  /** Tenant / project silo (`pillar_vectors.metadata.tenant_id`). Defaults to bridge `tenantId`. */
  tenantId?: string;
  /** Optional codebase shards; omit or pass `[]` for pillar-only bootstrap. */
  files?: IngestFilePayload[];
  /** Repo tag for dashboard filters (e.g. `packages/msgf`); derived from paths when omitted. */
  projectOrigin?: string;
  /** Override API key (defaults to bridge `licenseKey`). */
  apiKey?: string;
};

export type IngestResult = {
  ok: boolean;
  /** 0–100; 100 when six pillars are set and baseline training is complete. */
  readiness_score: number;
  brain_fully_initialized: boolean;
  is_pillar_baseline_set: boolean;
  pillars_present: number;
  pillars_required: number;
  missing_pillars: string[];
  baseline_training_required: boolean;
  baseline_training_remaining: number;
  pledge_signed: boolean;
  ingested_count: number;
  skipped_baseline_creation: boolean;
  pillars_created: string[];
  message: string | null;
  tenant_id: string | null;
  project_origin: string | null;
  raw: Record<string, unknown>;
};

export function parseIngestApiResponse(raw: Record<string, unknown>): IngestResult {
  const missing = raw.missing_pillars;
  const created = raw.pillars_created;

  return {
    ok: raw.ok === true,
    readiness_score:
      typeof raw.readiness_score === "number"
        ? Math.max(0, Math.min(100, Math.round(raw.readiness_score)))
        : 0,
    brain_fully_initialized: raw.brain_fully_initialized === true,
    is_pillar_baseline_set: raw.is_pillar_baseline_set === true,
    pillars_present: typeof raw.pillars_present === "number" ? raw.pillars_present : 0,
    pillars_required: typeof raw.pillars_required === "number" ? raw.pillars_required : 6,
    missing_pillars: Array.isArray(missing)
      ? missing.filter((p): p is string => typeof p === "string")
      : [],
    baseline_training_required: raw.baseline_training_required === true,
    baseline_training_remaining:
      typeof raw.baseline_training_remaining === "number"
        ? raw.baseline_training_remaining
        : 0,
    pledge_signed: raw.pledge_signed === true,
    ingested_count: typeof raw.ingested_count === "number" ? raw.ingested_count : 0,
    skipped_baseline_creation: raw.skipped_baseline_creation === true,
    pillars_created: Array.isArray(created)
      ? created.filter((p): p is string => typeof p === "string")
      : [],
    message: typeof raw.message === "string" ? raw.message : null,
    tenant_id: typeof raw.tenant_id === "string" ? raw.tenant_id : null,
    project_origin: typeof raw.project_origin === "string" ? raw.project_origin : null,
    raw,
  };
}
