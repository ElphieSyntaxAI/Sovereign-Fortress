import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

const LORE_SAMPLE = 3;
const PLOT_SAMPLE = 3;
const QUIZ_QUESTION_COUNT = 3;
const OPTIONS_PER_QUESTION = 4;

export type NarrativeChunkBrief = {
  id: string;
  content: string;
  source_document: string;
  chunk_index: number;
};

/** Shipped to the author — no correct answers. */
export type ConsistencyQuizQuestionPublic = {
  id: string;
  question: string;
  options: string[];
};

export type ConsistencyQuizGradingKey = {
  quizRunId: string;
  /** questionId → index of correct option (0–3). */
  correctByQuestionId: Record<string, number>;
};

export type GeneratedConsistencyQuiz = {
  quizRunId: string;
  questions: ConsistencyQuizQuestionPublic[];
  gradingKey: ConsistencyQuizGradingKey;
  sourceChunkIds: string[];
};

export type ConsistencyQuizScoreResult = {
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  /** When false, persist a row in `p4_consistency_review_flags` (or your editor queue). */
  requiresTeacherEditorReview: boolean;
};

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

async function fetchRandomChunks(
  supabase: SupabaseClient,
  tenantId: string,
  chunkType: "lore" | "plot",
  count: number
): Promise<NarrativeChunkBrief[]> {
  const { data, error } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, content, source_document, chunk_index")
    .eq("tenant_id", tenantId)
    .eq("chunk_type", chunkType);

  if (error) {
    throw new Error(`Failed to load ${chunkType} chunks: ${error.message}`);
  }
  const rows = (data ?? []) as NarrativeChunkBrief[];
  if (rows.length < count) {
    throw new Error(
      `Need at least ${count} ingested '${chunkType}' chunks for this tenant (found ${rows.length}).`
    );
  }
  shuffleInPlace(rows);
  return rows.slice(0, count);
}

type GeminiMcqRow = {
  question?: string;
  options?: string[];
  correctIndex?: number;
};

type GeminiQuizJson = {
  questions?: GeminiMcqRow[];
};

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  return fence?.[1]?.trim() ?? t;
}

function parseGeminiQuizJson(raw: string): GeminiQuizJson {
  const cleaned = stripJsonFence(raw);
  try {
    return JSON.parse(cleaned) as GeminiQuizJson;
  } catch {
    throw new Error("Gemini returned non-JSON quiz output");
  }
}

function validateAndBuildQuestions(
  parsed: GeminiQuizJson,
  quizRunId: string
): { publicQ: ConsistencyQuizQuestionPublic[]; correctByQuestionId: Record<string, number> } {
  const rows = parsed.questions;
  if (!Array.isArray(rows) || rows.length !== QUIZ_QUESTION_COUNT) {
    throw new Error(`Expected exactly ${QUIZ_QUESTION_COUNT} questions from Gemini`);
  }

  const publicQ: ConsistencyQuizQuestionPublic[] = [];
  const correctByQuestionId: Record<string, number> = {};

  for (let i = 0; i < QUIZ_QUESTION_COUNT; i++) {
    const row = rows[i]!;
    const q = typeof row.question === "string" ? row.question.trim() : "";
    const opts = row.options;
    const ci = row.correctIndex;

    if (!q) throw new Error(`Question ${i + 1} is empty`);
    if (!Array.isArray(opts) || opts.length !== OPTIONS_PER_QUESTION) {
      throw new Error(`Question ${i + 1} must have exactly ${OPTIONS_PER_QUESTION} options`);
    }
    const options = opts.map((o) => String(o).trim());
    if (options.some((o) => !o)) throw new Error(`Question ${i + 1} has empty options`);

    if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci >= OPTIONS_PER_QUESTION) {
      throw new Error(`Question ${i + 1} correctIndex must be 0–${OPTIONS_PER_QUESTION - 1}`);
    }

    const id = `${quizRunId}-q${i + 1}`;
    publicQ.push({ id, question: q, options });
    correctByQuestionId[id] = ci;
  }

  return { publicQ, correctByQuestionId };
}

function buildContextBlock(lore: NarrativeChunkBrief[], plot: NarrativeChunkBrief[]): string {
  const lines: string[] = [
    "You may ONLY use the following excerpts. Do not use outside knowledge.",
    "",
    "--- LORE EXCERPTS ---",
  ];
  lore.forEach((c, i) => {
    lines.push(`[Lore ${i + 1}] source: ${c.source_document} (chunk ${c.chunk_index})`);
    lines.push(c.content);
    lines.push("");
  });
  lines.push("--- PLOT EXCERPTS ---");
  plot.forEach((c, i) => {
    lines.push(`[Plot ${i + 1}] source: ${c.source_document} (chunk ${c.chunk_index})`);
    lines.push(c.content);
    lines.push("");
  });
  return lines.join("\n");
}

const GEMINI_DEFAULT_MODEL = "gemini-2.0-flash";

async function callGeminiForQuiz(
  apiKey: string,
  model: string,
  contextBlock: string
): Promise<string> {
  const prompt = `${contextBlock}

TASK: Generate exactly ${QUIZ_QUESTION_COUNT} multiple-choice questions an author who wrote this material should answer easily, but a stranger could not without the excerpts.
Each question must:
- Be answerable ONLY from the excerpts above (no invented chapters or facts).
- Prefer concrete detail when the text supports it (e.g. colors, names, objects, stated events).
- Have exactly ${OPTIONS_PER_QUESTION} distinct options; one clearly correct from the text; three plausible distractors also grounded or clearly wrong per the text.

Return ONLY valid JSON (no markdown) with this shape:
{"questions":[{"question":"string","options":["A","B","C","D"],"correctIndex":0}]}
where correctIndex is 0-based.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini generateContent failed (${res.status}): ${errText.slice(0, 600)}`);
  }

  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== "string") {
    throw new Error("Gemini returned no text candidate");
  }
  return text;
}

/**
 * Score answers in the same order as `questions` from {@link GeneratedConsistencyQuiz}.
 */
export function scoreConsistencyQuiz(
  gradingKey: ConsistencyQuizGradingKey,
  questions: ConsistencyQuizQuestionPublic[],
  selectedIndices: number[]
): ConsistencyQuizScoreResult {
  if (selectedIndices.length !== questions.length) {
    throw new Error(`Expected ${questions.length} answers, got ${selectedIndices.length}`);
  }

  let correctCount = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const picked = selectedIndices[i]!;
    const expected = gradingKey.correctByQuestionId[q.id];
    if (expected === undefined) throw new Error(`Missing grading key for question ${q.id}`);
    if (typeof picked !== "number" || !Number.isInteger(picked) || picked < 0 || picked >= OPTIONS_PER_QUESTION) {
      throw new Error(`Invalid selected index for question ${q.id}`);
    }
    if (picked === expected) correctCount += 1;
  }

  const totalQuestions = questions.length;
  const passed = correctCount === totalQuestions;
  return {
    correctCount,
    totalQuestions,
    passed,
    requiresTeacherEditorReview: !passed,
  };
}

export type ConsistencyQuizGeneratorOptions = {
  /** Defaults to `process.env.GEMINI_API_KEY` or `process.env.GOOGLE_API_KEY`. */
  geminiApiKey?: string;
  /** e.g. `gemini-2.0-flash`. Override with `GEMINI_MODEL`. */
  geminiModel?: string;
};

/**
 * Retrieves random Lore/Plot chunks from `p4_narrative_library_chunks`, asks Gemini for 3 MCQs
 * grounded only in that text, and exposes a grading key for server-side verification.
 *
 * Env: `GEMINI_API_KEY` or `GOOGLE_API_KEY`; optional `GEMINI_MODEL`.
 */
export class ConsistencyQuizGenerator {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    private readonly supabase: SupabaseClient,
    options: ConsistencyQuizGeneratorOptions = {}
  ) {
    const key =
      options.geminiApiKey?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim();
    if (!key) {
      throw new Error("Set GEMINI_API_KEY or GOOGLE_API_KEY for ConsistencyQuizGenerator");
    }
    this.apiKey = key;
    this.model =
      options.geminiModel?.trim() ||
      process.env.GEMINI_MODEL?.trim() ||
      GEMINI_DEFAULT_MODEL;
  }

  async generateQuiz(tenantId: string): Promise<GeneratedConsistencyQuiz> {
    const lore = await fetchRandomChunks(this.supabase, tenantId, "lore", LORE_SAMPLE);
    const plot = await fetchRandomChunks(this.supabase, tenantId, "plot", PLOT_SAMPLE);

    const quizRunId = randomUUID();
    const context = buildContextBlock(lore, plot);
    const rawText = await callGeminiForQuiz(this.apiKey, this.model, context);
    const parsed = parseGeminiQuizJson(rawText);
    const { publicQ, correctByQuestionId } = validateAndBuildQuestions(parsed, quizRunId);

    const sourceChunkIds = [...lore.map((c) => c.id), ...plot.map((c) => c.id)];

    return {
      quizRunId,
      questions: publicQ,
      gradingKey: { quizRunId, correctByQuestionId },
      sourceChunkIds,
    };
  }

  /**
   * Inserts a row when the author fails the quiz so Teachers/Editors can review the HAL session.
   * Uses service-role Supabase (bypasses RLS). No-op if `score.passed`.
   */
  async flagSessionForManualReview(params: {
    tenantId: string;
    halLedgerId: string;
    quizRunId: string;
    score: ConsistencyQuizScoreResult;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { tenantId, halLedgerId, quizRunId, score, metadata } = params;
    if (score.passed || !score.requiresTeacherEditorReview) return;

    const { error } = await this.supabase.from("p4_consistency_review_flags").insert({
      tenant_id: tenantId,
      hal_ledger_id: halLedgerId,
      quiz_run_id: quizRunId,
      quiz_passed: score.passed,
      correct_count: score.correctCount,
      total_questions: score.totalQuestions,
      requires_manual_review: true,
      reason: "consistency_quiz_failed",
      metadata: {
        ...(metadata ?? {}),
        kind: "narrative_consistency_quiz",
      },
    });

    if (error) {
      throw new Error(`p4_consistency_review_flags insert failed: ${error.message}`);
    }
  }
}
