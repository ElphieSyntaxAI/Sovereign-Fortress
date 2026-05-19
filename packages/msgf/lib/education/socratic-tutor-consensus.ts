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
 * Distribution Build ID: MSGF-463028d-20260519T150411Z-internal
 */
/**
 * Socratic Tutor — Gemini + Claude consensus (Vertex publishers, P2 CONVERGE).
 */
import { v1beta1 } from "@google-cloud/aiplatform";

import {
  getGcpProjectId,
  SERVICE_ACCOUNT_PATH,
} from "@/lib/msgf-vertex";
import { computeConsensusAgreementScore } from "@/lib/services/consensus-output-comparison";
import {
  executeAiWave,
  runWithLlmTimeoutSimple,
} from "@/lib/services/cost-runaway-guard";
import { LEARNING_BREAKDOWN_INDEX } from "@/lib/education/learning-breakdown-index";

const VERTEX_LOCATION = process.env.GCP_LOCATION || "us-central1";
const GEMINI_MODEL_ID = process.env.MSGF_VERTEX_MODEL || "gemini-2.5-flash";
const CLAUDE_MODEL_ID = process.env.MSGF_CLAUDE_MODEL || "claude-4.6-sonnet";

export const SOCRATIC_CONSENSUS_THRESHOLD = 0.72;

export type SocraticModelPayload = {
  reply: string;
  scaffoldQuestions: string[];
  strengthRefs: string[];
  curriculumRefs: string[];
  raw: string;
};

export type SocraticConsensusResult = {
  gemini: SocraticModelPayload;
  claude: SocraticModelPayload;
  agreementScore: number;
  /** Merged student-facing reply after consensus + P1 guard. */
  reply: string;
  scaffoldQuestions: string[];
  p1Violation: boolean;
  p1ViolationReason?: string;
  selectedModel: "consensus" | "gemini" | "claude" | "repair";
};

const DIRECT_ANSWER_PATTERNS = [
  /\bthe answer is\b/i,
  /\bhere(?:'s| is) the solution\b/i,
  /\bstep\s*\d+\s*[:.)]\s*[a-z0-9]/i,
  /\btherefore[,]?\s+the\b/i,
  /\bin conclusion[,]?\s/i,
  /\bwrite this (?:sentence|paragraph|thesis)\b/i,
  /\bcompleted (?:essay|paragraph|thesis)\b/i,
];

function parseSocraticJson(text: string): SocraticModelPayload {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const jsonCandidate = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
  try {
    const parsed = JSON.parse(jsonCandidate) as {
      reply?: string;
      scaffold_questions?: string[];
      strength_refs?: string[];
      curriculum_refs?: string[];
    };
    return {
      reply: String(parsed.reply ?? "").trim(),
      scaffoldQuestions: Array.isArray(parsed.scaffold_questions)
        ? parsed.scaffold_questions.map(String)
        : [],
      strengthRefs: Array.isArray(parsed.strength_refs)
        ? parsed.strength_refs.map(String)
        : [],
      curriculumRefs: Array.isArray(parsed.curriculum_refs)
        ? parsed.curriculum_refs.map(String)
        : [],
      raw: text,
    };
  } catch {
    return {
      reply: cleaned.slice(0, 2000),
      scaffoldQuestions: [],
      strengthRefs: [],
      curriculumRefs: [],
      raw: text,
    };
  }
}

export function detectP1SocraticViolation(text: string): string | null {
  const t = text.trim();
  if (!t) return "empty response";

  for (const pattern of DIRECT_ANSWER_PATTERNS) {
    if (pattern.test(t)) {
      return `matched prohibited pattern: ${pattern.source}`;
    }
  }

  const questionCount = (t.match(/\?/g) ?? []).length;
  const wordCount = t.split(/\s+/).filter(Boolean).length;

  if (wordCount > 140 && questionCount < 1) {
    return "long prose without Socratic questions";
  }

  if (wordCount > 220) {
    return "response exceeds safe length for Socratic mode";
  }

  return null;
}

async function runPublisherModel(modelPath: string, prompt: string): Promise<string> {
  const client = new v1beta1.PredictionServiceClient({
    keyFilename: SERVICE_ACCOUNT_PATH,
    apiEndpoint: `${VERTEX_LOCATION}-aiplatform.googleapis.com`,
  });

  const [resp] = await runWithLlmTimeoutSimple("socratic_tutor.publisher_vertex", () =>
    client.generateContent({
      model: modelPath,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 720 },
    })
  );

  return resp?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function pickSaferPayload(
  a: SocraticModelPayload,
  b: SocraticModelPayload
): SocraticModelPayload {
  const vA = detectP1SocraticViolation(a.reply);
  const vB = detectP1SocraticViolation(b.reply);
  if (!vA && vB) return a;
  if (vA && !vB) return b;
  if (a.scaffoldQuestions.length >= b.scaffoldQuestions.length) return a;
  return b;
}

function mergeConsensusReplies(
  gemini: SocraticModelPayload,
  claude: SocraticModelPayload,
  agreementScore: number
): { reply: string; scaffoldQuestions: string[]; selectedModel: SocraticConsensusResult["selectedModel"] } {
  if (agreementScore >= SOCRATIC_CONSENSUS_THRESHOLD) {
    const safer = pickSaferPayload(gemini, claude);
    const questions = [
      ...new Set([
        ...safer.scaffoldQuestions,
        ...gemini.scaffoldQuestions,
        ...claude.scaffoldQuestions,
      ]),
    ].slice(0, 5);
    return {
      reply: safer.reply,
      scaffoldQuestions: questions,
      selectedModel: "consensus",
    };
  }

  const safer = pickSaferPayload(gemini, claude);
  const vGem = detectP1SocraticViolation(gemini.reply);
  const vCla = detectP1SocraticViolation(claude.reply);
  const selectedModel: SocraticConsensusResult["selectedModel"] =
    !vGem && vCla ? "gemini" : vGem && !vCla ? "claude" : "gemini";

  return {
    reply: safer.reply,
    scaffoldQuestions: safer.scaffoldQuestions,
    selectedModel,
  };
}

export function fallbackSocraticRefusal(reason: string): string {
  return `I can't give a direct answer on this assignment (policy: ${reason}). Let's break it down: what part of the prompt feels hardest — planning, evidence, or wording? What strategy worked for you on a similar task before?`;
}

/**
 * Run dual-model Socratic consensus; caller may re-invoke with repair prompt if P1 fails.
 */
export async function runSocraticTutorConsensus(
  prompt: string
): Promise<Omit<SocraticConsensusResult, "p1Violation" | "p1ViolationReason">> {
  const projectId = getGcpProjectId();
  const geminiPath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${GEMINI_MODEL_ID}`;
  const claudePath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/anthropic/models/${CLAUDE_MODEL_ID}`;

  const [geminiText, claudeText] = await executeAiWave("socratic_tutor.dual_publishers", () =>
    Promise.all([
      runPublisherModel(geminiPath, prompt),
      runPublisherModel(claudePath, prompt),
    ])
  );

  const gemini = parseSocraticJson(geminiText);
  const claude = parseSocraticJson(claudeText);
  const agreementScore = computeConsensusAgreementScore(gemini.reply, claude.reply);
  const merged = mergeConsensusReplies(gemini, claude, agreementScore);

  return {
    gemini,
    claude,
    agreementScore,
    reply: merged.reply,
    scaffoldQuestions: merged.scaffoldQuestions,
    selectedModel: merged.selectedModel,
  };
}

export function learningBreakdownForTutorViolation(): typeof LEARNING_BREAKDOWN_INDEX.tutorDirectAnswerAttempt {
  return LEARNING_BREAKDOWN_INDEX.tutorDirectAnswerAttempt;
}
