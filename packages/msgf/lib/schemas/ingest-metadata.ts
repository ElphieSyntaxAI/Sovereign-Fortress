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
 * Strict Zod contracts for POST /api/msgf/ingest — rejected before cold-layer writes.
 */

import { z } from "zod";

import {
  GenealogicalBugIndexSchema,
  MsgfGovernancePillarSchema,
  VaultHallMetadataObjectSchema,
  type GenealogicalBugIndex,
  type MsgfGovernancePillar,
} from "@/lib/schemas/vault-hall-metadata";

/** Max files per SWEEP batch (abuse guard). */
export const INGEST_MAX_FILES = 100;

/** Max UTF-8 bytes per file body (approximate via string length). */
export const INGEST_MAX_FILE_CONTENT_CHARS = 512_000;

const isoTimestampSchema = z
  .string()
  .min(10)
  .max(64)
  .refine((s) => !Number.isNaN(Date.parse(s)), "must be a valid ISO-8601 timestamp");

/**
 * Per-file ingest input. Only `path`, `content`, and optional `bug_index` are allowed.
 * Reject weak `metadata` blobs at the edge — cold rows are built server-side.
 */
export const IngestFileInputSchema = z
  .object({
    path: z.string().min(1).max(512),
    content: z.string().max(INGEST_MAX_FILE_CONTENT_CHARS),
    bug_index: GenealogicalBugIndexSchema.optional(),
  })
  .strict();

export type IngestFileInput = z.infer<typeof IngestFileInputSchema>;

export const IngestRequestBodySchema = z
  .object({
    tenant_id: z.string().min(1).max(128).optional(),
    project_origin: z.string().min(1).max(256).optional(),
    files: z.array(IngestFileInputSchema).max(INGEST_MAX_FILES).optional(),
  })
  .strict();

export type IngestRequestBody = z.infer<typeof IngestRequestBodySchema>;

/** Response / audit lineage row — canonical 1.1.1 (not legacy `category_1_0` strings). */
export const IngestLineageMapEntrySchema = z
  .object({
    path: z.string().min(1).max(512),
    bug_index: GenealogicalBugIndexSchema,
    governance_pillar: MsgfGovernancePillarSchema,
  })
  .strict();

export type IngestLineageMapEntry = z.infer<typeof IngestLineageMapEntrySchema>;

export const IngestLineageMapSchema = z.array(IngestLineageMapEntrySchema);

/**
 * Final `pillar_vectors.metadata` for SWEEP shards — Vault contract + governance pillar + silo tags.
 * Typed columns (`governance_pillar`, `constraint_ledger`, level_* ) mirror this via
 * `pillarVectorCrossRefColumnsFromMetadata`; Postgres trigger enforces on insert.
 */
export const SweepPillarVectorMetadataSchema = VaultHallMetadataObjectSchema.extend({
  pillar: MsgfGovernancePillarSchema,
  governance_pillar: MsgfGovernancePillarSchema,
  is_baseline: z.literal(true),
  ingest_source: z.literal("sweep"),
  original_path: z.string().min(1).max(512),
  ingested_at: isoTimestampSchema,
  project_origin: z.string().min(1).max(256).optional(),
})
  .strict()
  .superRefine((meta, ctx) => {
    if (meta.category !== meta.bug_index.level_1_category) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "category must equal bug_index.level_1_category",
        path: ["category"],
      });
    }
    if (meta.branch !== meta.bug_index.level_1_1_branch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "branch must equal bug_index.level_1_1_branch",
        path: ["branch"],
      });
    }
    if (meta.instance_slug !== meta.bug_index.level_1_1_1_instance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "instance_slug must equal bug_index.level_1_1_1_instance",
        path: ["instance_slug"],
      });
    }
    if (meta.governance_pillar !== meta.pillar) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "governance_pillar must equal pillar on SWEEP rows",
        path: ["governance_pillar"],
      });
    }
  });

export type SweepPillarVectorMetadata = z.infer<typeof SweepPillarVectorMetadataSchema>;

export type IngestValidationIssue = {
  path: string;
  message: string;
};

export class IngestValidationError extends Error {
  readonly status = 400;
  readonly code = "INGEST_VALIDATION_ERROR" as const;
  readonly issues: IngestValidationIssue[];

  constructor(issues: IngestValidationIssue[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join("; ") || "Invalid ingest payload.");
    this.name = "IngestValidationError";
    this.issues = issues;
  }
}

function zodIssuesToIngestIssues(error: z.ZodError): IngestValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

export function parseIngestRequestBody(raw: unknown): IngestRequestBody {
  const parsed = IngestRequestBodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new IngestValidationError(zodIssuesToIngestIssues(parsed.error));
  }
  return parsed.data;
}

export function parseSweepPillarVectorMetadata(raw: unknown): SweepPillarVectorMetadata {
  const parsed = SweepPillarVectorMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new IngestValidationError(zodIssuesToIngestIssues(parsed.error));
  }
  return parsed.data;
}

export function buildIngestLineageEntry(input: {
  path: string;
  bugIndex: GenealogicalBugIndex;
  governancePillar: MsgfGovernancePillar;
}): IngestLineageMapEntry {
  return IngestLineageMapEntrySchema.parse({
    path: input.path,
    bug_index: input.bugIndex,
    governance_pillar: input.governancePillar,
  });
}
