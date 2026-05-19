/**
 * Socratic Tutor Assistant — RAG + Vault strengths + P1-gated dual-model CONVERGE.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { generateEmbedding } from "@/lib/ai-utils";
import { retrieveCurriculumShards } from "@/lib/education/education-curriculum-rag";
import {
  assertAiAllowanceForSocraticTutor,
  type EducationAiAllowanceLevel,
} from "@/lib/education/p1-static-ledger";
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
    aiAllowanceLevel: z
      .enum(["L1_DICTIONARY", "L2_SOCRATIC", "L3_FORBIDDEN"])
      .optional(),
    curriculumMatchCount: z.number().int().min(1).max(12).optional(),
    strengthMatchCount: z.number().int().min(1).max(8).optional(),
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
  suggestedHallIndex?: ReturnType<typeof learningBreakdownForTutorViolation>;
};

export async function askSocraticTutor(
  input: SocraticTutorAskInput
): Promise<SocraticTutorAskResult> {
  const body = SocraticTutorAskBodySchema.parse(input.body);

  assertAiAllowanceForSocraticTutor(
    body.aiAllowanceLevel as EducationAiAllowanceLevel | undefined
  );

  const queryEmbedding = await generateEmbedding(body.question);

  const lineage = body.learningBreakdown
    ? {
        level_1_category: body.learningBreakdown.level_1_category,
        level_1_1_branch: body.learningBreakdown.level_1_1_branch,
        level_1_1_1_instance: body.learningBreakdown.level_1_1_1_instance,
      }
    : undefined;

  const [curriculumShards, vaultStrengths] = await Promise.all([
    retrieveCurriculumShards({
      supabase: input.supabase,
      tenantId: input.tenantId,
      queryText: body.question,
      matchCount: body.curriculumMatchCount ?? 6,
      lineage,
      subjectDomain: body.subjectDomain,
      queryEmbedding,
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
    studentQuestion: body.question,
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
    suggestedHallIndex: p1Violation
      ? learningBreakdownForTutorViolation()
      : undefined,
  };
}

export const socraticTutorController = {
  ask: askSocraticTutor,
} as const;
