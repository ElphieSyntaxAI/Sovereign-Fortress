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
 * Socratic Tutor Assistant — RAG + Vault strengths + P1-gated dual-model CONVERGE.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { generateEmbedding } from "@/lib/ai-utils";
import {
  getAssignmentResource,
  getAssignmentResourceForAssignment,
} from "@/lib/education/assignment-resources";
import {
  retrieveCurriculumShards,
  type CurriculumResourceScopeFilter,
} from "@/lib/education/education-curriculum-rag";
import { assertAiAllowanceForSocraticTutor } from "@/lib/education/p1-static-ledger";
import { assertUtahDisclosureAccepted } from "@/lib/education/utah-disclosure";
import { routeLlmPromptChain } from "@/lib/education/workspace/llm-routing-controller";
import {
  getAssignmentAllowanceLevel,
  getStudentGradeCohort,
} from "@/lib/education/workspace/workspace-assignment-store";
import {
  buildSocraticRepairPrompt,
  buildSocraticTutorPrompt,
} from "@/lib/education/socratic-tutor-prompt";
import {
  detectP1SocraticViolation,
  fallbackSocraticRefusal,
  learningBreakdownForTutorViolation,
  runSocraticTutorConsensus,
  type SocraticConsensusResult,
} from "@/lib/education/socratic-tutor-consensus";
import { retrieveStudentVaultStrengths } from "@/lib/education/student-vault-strengths";
import { GenealogicalBugIndexSchema } from "@/lib/schemas/vault-hall-metadata";

export const SocraticTutorAskBodySchema = z
  .object({
    question: z.string().min(1).max(4000),
    assignmentId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    subjectDomain: z
      .enum(["ela", "history", "math", "science", "general"])
      .optional()
      .default("general"),
    /** Active 1.1.1 learning breakdown from P4/P6 (friction point). */
    learningBreakdown: GenealogicalBugIndexSchema.optional(),
    draftExcerpt: z.string().max(8000).optional(),
    gradeCohort: z.string().optional(),
    aiAllowanceLevel: z.number().int().min(0).max(4).optional(),
    curriculumMatchCount: z.number().int().min(1).max(12).optional(),
    strengthMatchCount: z.number().int().min(1).max(8).optional(),
    /**
     * Socratic Boundary Sync (masterdoc §4.3). When the student's assignment has a
     * teacher-chopped slice (`resource_context_id`), the RAG query is locked to
     * shards inside that slice. May be passed explicitly; otherwise it is resolved
     * from `assignmentId` via `education_assignment_resources`.
     */
    resourceContextId: z.string().uuid().optional(),
  })
  .strict();

export type SocraticTutorAskBody = z.infer<typeof SocraticTutorAskBodySchema>;

export type SocraticTutorAskInput = {
  supabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  body: SocraticTutorAskBody;
};

export type SocraticTutorAskResult = {
  reply: string;
  scaffoldQuestions: string[];
  consensus: Pick<
    SocraticConsensusResult,
    "agreementScore" | "selectedModel" | "p1Violation" | "p1ViolationReason"
  >;
  curriculumShardIds: string[];
  strengthIds: string[];
  lineageFilter?: {
    level_1_category?: string;
    level_1_1_branch?: string;
    level_1_1_1_instance?: string;
  };
  /** Echoed boundary filter so callers can show "Locked to Ch. 4, §2" badges. */
  resourceScope?: CurriculumResourceScopeFilter;
  suggestedHallIndex?: ReturnType<typeof learningBreakdownForTutorViolation>;
};

export async function askSocraticTutor(
  input: SocraticTutorAskInput
): Promise<SocraticTutorAskResult> {
  const body = SocraticTutorAskBodySchema.parse(input.body);

  const { createAdminClient } = await import("@/utils/supabase/admin");
  await assertUtahDisclosureAccepted({
    admin: createAdminClient(),
    tenantId: input.tenantId,
    entityToken: input.entityId,
  });

  const gradeCohort =
    body.gradeCohort ??
    (await getStudentGradeCohort(input.supabase, input.entityId, input.tenantId));

  const aiAllowanceLevel =
    body.aiAllowanceLevel ??
    (body.assignmentId
      ? await getAssignmentAllowanceLevel(input.supabase, body.assignmentId)
      : 3);

  const routed = routeLlmPromptChain({
    gradeCohort,
    aiAllowanceLevel,
    userPrompt: body.question,
  });

  if (!routed.decision.allowed) {
    return {
      reply:
        routed.decision.haltMessage ??
        "AI tutor is not available at the current allowance level.",
      scaffoldQuestions: [],
      consensus: {
        agreementScore: 0,
        selectedModel: "consensus",
        p1Violation: true,
        p1ViolationReason: routed.decision.haltCode,
      },
      curriculumShardIds: [],
      strengthIds: [],
      lineageFilter: body.learningBreakdown,
      resourceScope: body.resourceContextId
        ? { resourceContextId: body.resourceContextId }
        : undefined,
    };
  }

  assertAiAllowanceForSocraticTutor(aiAllowanceLevel);

  const queryEmbedding = await generateEmbedding(body.question);

  const lineage = body.learningBreakdown
    ? {
        level_1_category: body.learningBreakdown.level_1_category,
        level_1_1_branch: body.learningBreakdown.level_1_1_branch,
        level_1_1_1_instance: body.learningBreakdown.level_1_1_1_instance,
      }
    : undefined;

  const resourceScope = await resolveResourceScope({
    supabase: input.supabase,
    tenantId: input.tenantId,
    entityId: input.entityId,
    resourceContextId: body.resourceContextId,
    assignmentId: body.assignmentId,
  });

  const [curriculumShards, vaultStrengths] = await Promise.all([
    retrieveCurriculumShards({
      supabase: input.supabase,
      tenantId: input.tenantId,
      queryText: body.question,
      matchCount: body.curriculumMatchCount ?? 6,
      lineage,
      subjectDomain: body.subjectDomain,
      queryEmbedding,
      resourceScope,
    }),
    retrieveStudentVaultStrengths({
      supabase: input.supabase,
      tenantId: input.tenantId,
      entityId: input.entityId,
      queryText: body.question,
      subjectDomain: body.subjectDomain,
      matchCount: body.strengthMatchCount ?? 5,
      queryEmbedding,
    }),
  ]);

  const promptInput = {
    studentQuestion: routed.prompt || body.question,
    curriculumShards,
    vaultStrengths,
    frictionBreakdown: body.learningBreakdown,
    assignmentId: body.assignmentId,
    subjectDomain: body.subjectDomain,
    draftExcerpt: body.draftExcerpt,
  };

  let prompt = buildSocraticTutorPrompt(promptInput);
  let consensus = await runSocraticTutorConsensus(prompt);

  let violation = detectP1SocraticViolation(consensus.reply);
  let selectedModel = consensus.selectedModel;
  let p1Violation = Boolean(violation);

  if (violation) {
    prompt = buildSocraticRepairPrompt(promptInput, violation);
    const repair = await runSocraticTutorConsensus(prompt);
    consensus = { ...repair, selectedModel: "repair" };
    selectedModel = "repair";
    violation = detectP1SocraticViolation(consensus.reply);
    p1Violation = Boolean(violation);
  }

  let reply = consensus.reply;
  if (violation) {
    reply = fallbackSocraticRefusal(violation);
    p1Violation = true;
  }

  return {
    reply,
    scaffoldQuestions: consensus.scaffoldQuestions,
    consensus: {
      agreementScore: consensus.agreementScore,
      selectedModel,
      p1Violation,
      p1ViolationReason: violation ?? undefined,
    },
    curriculumShardIds: curriculumShards.map((s) => s.id),
    strengthIds: vaultStrengths.map((s) => s.id),
    lineageFilter: lineage,
    resourceScope,
    suggestedHallIndex: p1Violation
      ? learningBreakdownForTutorViolation()
      : undefined,
  };
}

/**
 * Resolve the active resource scope for this tutor turn.
 *
 * Order of preference:
 *   1. `resourceContextId` on the request body (workspace canvas explicitly bound).
 *   2. Latest `assignment_resources` row for the student's `assignmentId`.
 *
 * If neither is present we return `undefined` — the RAG query falls back to the
 * district-wide curriculum corpus filtered by 1.1.1 lineage only.
 */
async function resolveResourceScope(params: {
  supabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  resourceContextId?: string;
  assignmentId?: string;
}): Promise<CurriculumResourceScopeFilter | undefined> {
  try {
    if (params.resourceContextId) {
      const row = await getAssignmentResource({
        admin: params.supabase,
        resourceContextId: params.resourceContextId,
        entityId: params.entityId,
        refreshSignedLink: false,
      });
      if (row) return assignmentResourceToScope(row);
    }
    if (params.assignmentId) {
      const row = await getAssignmentResourceForAssignment({
        admin: params.supabase,
        assignmentId: params.assignmentId,
        entityId: params.entityId,
      });
      if (row) return assignmentResourceToScope(row);
    }
  } catch (e) {
    console.warn("[socratic-tutor] resource scope resolve failed:", e);
  }
  return undefined;
}

function assignmentResourceToScope(row: {
  resource_context_id: string;
  catalog_id: string;
  slice: { unitIds: string[]; chapterIds: string[]; sectionIds: string[] };
  page_start: number | null;
  page_end: number | null;
}): CurriculumResourceScopeFilter {
  return {
    resourceContextId: row.resource_context_id,
    catalogId: row.catalog_id,
    unitIds: row.slice.unitIds,
    chapterIds: row.slice.chapterIds,
    sectionIds: row.slice.sectionIds,
    pageStart: row.page_start ?? undefined,
    pageEnd: row.page_end ?? undefined,
  };
}

export const socraticTutorController = {
  ask: askSocraticTutor,
} as const;
