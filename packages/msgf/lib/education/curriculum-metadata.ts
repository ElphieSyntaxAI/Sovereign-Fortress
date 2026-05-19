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
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
/**
 * P6 cold-layer metadata for district curriculum shards (Syntax Education).
 * Reuses the 1.1.1 genealogical index wire format for hierarchical routing.
 */
import { z } from "zod";

import {
  GenealogicalBugIndexSchema,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";
import { withMsgfMetadataScope, type MsgfMetadataScope } from "@/lib/services/msgf-metadata-scope";

export const EDUCATION_P6_PILLAR = "P6" as const;
export const CURRICULUM_INDEX_TYPE = "curriculum_shard" as const;
export const STUDENT_STRENGTH_INDEX_TYPE = "student_strength" as const;

/**
 * Resource scope — addresses the slice of the approved catalog (masterdoc §4.2 / §4.3).
 * Shards carry the leaf position they belong to; the Socratic Boundary Sync RPC filters
 * by `resource_context_id` + (catalog_id, unit_id, chapter_id, section_id, page range).
 */
export const CurriculumResourceScopeSchema = z
  .object({
    resource_context_id: z.string().uuid().optional(),
    catalog_id: z.string().uuid(),
    unit_id: z.string().min(1).max(64).optional(),
    chapter_id: z.string().min(1).max(96).optional(),
    section_id: z.string().min(1).max(128).optional(),
    page_start: z.number().int().min(0).optional(),
    page_end: z.number().int().min(0).optional(),
  })
  .strict();

export type CurriculumResourceScope = z.infer<typeof CurriculumResourceScopeSchema>;

export const CurriculumShardMetadataSchema = z
  .object({
    pillar: z.literal(EDUCATION_P6_PILLAR),
    index_type: z.literal(CURRICULUM_INDEX_TYPE),
    bug_index: GenealogicalBugIndexSchema,
    instance: z.literal("1.1.1"),
    category: z.string(),
    branch: z.string(),
    instance_slug: z.string(),
    source_document: z.string().max(512),
    shard_index: z.number().int().min(0),
    subject_domain: z
      .enum(["ela", "history", "math", "science", "general"])
      .optional(),
    assignment_id: z.string().uuid().optional(),
    resource_scope: CurriculumResourceScopeSchema.optional(),
    ingested_at: z.string().optional(),
  })
  .passthrough();

export type CurriculumShardMetadata = z.infer<typeof CurriculumShardMetadataSchema>;

export const StudentStrengthMetadataSchema = z
  .object({
    pillar: z.literal(EDUCATION_P6_PILLAR),
    index_type: z.literal(STUDENT_STRENGTH_INDEX_TYPE),
    ledger: z.literal("vault"),
    bug_index: GenealogicalBugIndexSchema.optional(),
    strength_label: z.string().max(256),
    subject_domain: z
      .enum(["ela", "history", "math", "science", "general"])
      .optional(),
    hal_score: z.number().finite().optional(),
    summary: z.string().max(2000).optional(),
    persisted_at: z.string().optional(),
  })
  .passthrough();

export type StudentStrengthMetadata = z.infer<typeof StudentStrengthMetadataSchema>;

export function buildCurriculumShardMetadata(input: {
  bugIndex: GenealogicalBugIndex;
  sourceDocument: string;
  shardIndex: number;
  subjectDomain?: "ela" | "history" | "math" | "science" | "general";
  assignmentId?: string;
  /** Resource scope so Socratic RAG can lock to teacher-chopped pages (masterdoc §4.3). */
  resourceScope?: CurriculumResourceScope;
  scope: MsgfMetadataScope;
}): CurriculumShardMetadata {
  const base = {
    pillar: EDUCATION_P6_PILLAR,
    index_type: CURRICULUM_INDEX_TYPE,
    bug_index: input.bugIndex,
    instance: "1.1.1" as const,
    category: input.bugIndex.level_1_category,
    branch: input.bugIndex.level_1_1_branch,
    instance_slug: input.bugIndex.level_1_1_1_instance,
    source_document: input.sourceDocument.slice(0, 512),
    shard_index: input.shardIndex,
    ...(input.subjectDomain ? { subject_domain: input.subjectDomain } : {}),
    ...(input.assignmentId ? { assignment_id: input.assignmentId } : {}),
    ...(input.resourceScope ? { resource_scope: input.resourceScope } : {}),
    ingested_at: new Date().toISOString(),
  };

  return CurriculumShardMetadataSchema.parse(
    withMsgfMetadataScope(base, input.scope)
  );
}

export function buildStudentStrengthMetadata(input: {
  strengthLabel: string;
  summary: string;
  scope: MsgfMetadataScope;
  bugIndex?: GenealogicalBugIndex;
  subjectDomain?: "ela" | "history" | "math" | "science" | "general";
  halScore?: number;
}): StudentStrengthMetadata {
  const base = {
    pillar: EDUCATION_P6_PILLAR,
    index_type: STUDENT_STRENGTH_INDEX_TYPE,
    ledger: "vault" as const,
    strength_label: input.strengthLabel.slice(0, 256),
    summary: input.summary.slice(0, 2000),
    ...(input.bugIndex ? { bug_index: input.bugIndex } : {}),
    ...(input.subjectDomain ? { subject_domain: input.subjectDomain } : {}),
    ...(input.halScore != null ? { hal_score: input.halScore } : {}),
    persisted_at: new Date().toISOString(),
  };

  return StudentStrengthMetadataSchema.parse(
    withMsgfMetadataScope(base, input.scope)
  );
}

/** Maps sandbox subject tags to genealogical L1 categories for RAG filters. */
export function subjectDomainToLevel1Category(
  subject: string | undefined
): string | undefined {
  switch (subject?.toLowerCase()) {
    case "ela":
      return "1.0_ELA";
    case "history":
      return "1.0_HISTORY";
    case "math":
      return "1.0_MATH";
    case "science":
      return "1.0_SCIENCE";
    default:
      return undefined;
  }
}
