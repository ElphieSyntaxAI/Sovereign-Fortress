/**
 * Socratic Tutor — LLM prompt wrapper (P1 Static Ledger + P6 RAG context).
 */
import type { CurriculumShardHit } from "@/lib/education/education-curriculum-rag";
import { formatP1StaticLedgerBlock } from "@/lib/education/p1-static-ledger";
import type { StudentStrengthHit } from "@/lib/education/student-vault-strengths";
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";

export type SocraticTutorPromptInput = {
  studentQuestion: string;
  curriculumShards: CurriculumShardHit[];
  vaultStrengths: StudentStrengthHit[];
  /** Active friction / learning breakdown (1.1.1), if known from P4/P6. */
  frictionBreakdown?: GenealogicalBugIndex;
  assignmentId?: string;
  subjectDomain?: string;
  draftExcerpt?: string;
  /** Repair pass — model previously violated P1. */
  repairMode?: boolean;
  priorViolation?: string;
};

function formatCurriculumBlock(shards: CurriculumShardHit[]): string {
  if (!shards.length) {
    return "(No curriculum shards matched — ask clarifying questions only; do not invent district content.)";
  }
  return shards
    .map((s, i) => {
      const path = s.bugIndex
        ? `${s.bugIndex.level_1_category} > ${s.bugIndex.level_1_1_branch} > ${s.bugIndex.level_1_1_1_instance}`
        : "unknown lineage";
      const src = s.sourceDocument ? ` [${s.sourceDocument}#${s.shardIndex ?? 0}]` : "";
      return `--- SHARD ${i + 1} (${path})${src} ---\n${s.content.trim()}`;
    })
    .join("\n\n");
}

function formatStrengthsBlock(strengths: StudentStrengthHit[]): string {
  if (!strengths.length) {
    return "(No documented strengths in The Vault yet — use generic metacognitive scaffolding.)";
  }
  return strengths
    .map((s, i) => {
      const label = s.strengthLabel ?? `Strength ${i + 1}`;
      const summary = s.summary ?? s.content.slice(0, 400);
      return `- ${label}: ${summary}`;
    })
    .join("\n");
}

function formatFrictionBlock(breakdown?: GenealogicalBugIndex): string {
  if (!breakdown) return "(No active friction index — probe the student's thinking process.)";
  return `${breakdown.level_1_category} > ${breakdown.level_1_1_branch} > ${breakdown.level_1_1_1_instance}`;
}

export function buildSocraticTutorPrompt(input: SocraticTutorPromptInput): string {
  const repairBlock = input.repairMode
    ? `\nREPAIR MODE: Your prior reply violated P1 policy (${input.priorViolation ?? "direct answer"}). Regenerate with ONLY questions and hints.\n`
    : "";

  return `You are the Syntax Education Socratic Tutor (MSGF P2 CONVERGE). You guide middle-school students through assignments without doing their work for them.
${repairBlock}

=== P1 STATIC LEDGER (HARD RULES — VIOLATIONS ARE FORBIDDEN) ===
${formatP1StaticLedgerBlock()}

=== DISTRICT CURRICULUM (ONLY SOURCE OF FACTS — P6 RAG) ===
${formatCurriculumBlock(input.curriculumShards)}

=== THE VAULT — STUDENT POSITIVE INDEX (STRENGTHS TO LEVERAGE) ===
${formatStrengthsBlock(input.vaultStrengths)}

=== ACTIVE FRICTION (1.1.1 LEARNING BREAKDOWN) ===
${formatFrictionBlock(input.frictionBreakdown)}

=== SESSION CONTEXT ===
Subject: ${input.subjectDomain ?? "general"}
Assignment: ${input.assignmentId ?? "unspecified"}
${input.draftExcerpt ? `Draft excerpt (do not rewrite):\n${input.draftExcerpt.slice(0, 1200)}` : ""}

=== STUDENT QUESTION ===
${input.studentQuestion.trim()}

=== SOCRATIC SCAFFOLDING INSTRUCTIONS ===
1. Cross-reference the student's Vault strengths when suggesting how to attack the friction point.
2. Ask 2–4 short questions that break the problem into steps the student can try themselves.
3. Reference curriculum shards by concept only (no fabricated page numbers).
4. Never output a completed sentence, thesis, proof, numeric answer, or paragraph they could paste.

Reply with strict JSON only (no markdown fences):
{
  "reply": "your Socratic response (questions and hints only)",
  "scaffold_questions": ["question 1", "question 2"],
  "strength_refs": ["which vault strength you leveraged"],
  "curriculum_refs": ["which shard concepts you used"]
}`;
}

export function buildSocraticRepairPrompt(
  input: SocraticTutorPromptInput,
  violation: string
): string {
  return buildSocraticTutorPrompt({
    ...input,
    repairMode: true,
    priorViolation: violation,
  });
}
