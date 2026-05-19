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
 * Distribution Build ID: MSGF-f70c13c-20260519T044237Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeystrokeEvent, StateBeatRow } from "@/lib/P4";

export type ModelVerdict = "HUMAN" | "NON_HUMAN" | "INCONCLUSIVE";

export interface BiometricInput {
  userId?: string;
  keystrokes: KeystrokeEvent[];
  /** Optional raw text chunk (if available client-side after anonymization). */
  textSample?: string;
  profile?: BiometricProfileRow | null;
}

export interface LinguisticInput {
  currentText: string;
  historicalBeats: Pick<StateBeatRow, "beat_text" | "sequence_index">[];
  geminiVerdict: ModelVerdict;
  claudeVerdict: ModelVerdict;
}

export interface IntegrityInput {
  currentText: string;
  geminiReason?: string;
  claudeReason?: string;
}

export interface HalSubScores {
  biometric: number;
  linguistic: number;
  integrity: number;
}

export interface HalWeights {
  biometric: number;
  linguistic: number;
  integrity: number;
}

export interface HalScoreResult {
  halScore: number;
  subScores: HalSubScores;
  weights: HalWeights;
  flags: {
    largePasteDetected: boolean;
    mechanicalTypingDetected: boolean;
    tooPerfectDetected: boolean;
    llmTransitionPatternDetected: boolean;
    adaptiveSensitivityApplied: boolean;
    deltaOver30Percent: boolean;
    baselineTrainingActive: boolean;
  };
  rationale: string[];
}

export interface BiometricProfileRow {
  user_id: string;
  ewma_speed: number | null;
  rhythm_hash: string | null;
  recalibrated_at: string | null;
  baseline_training_remaining: number;
  updated_at?: string;
  created_at?: string;
}

const DEFAULT_WEIGHTS: HalWeights = {
  biometric: 0.35,
  linguistic: 0.4,
  integrity: 0.25,
};

const LLM_TRANSITION_PATTERNS = [
  "in conclusion",
  "moreover",
  "furthermore",
  "in summary",
  "it is important to note",
  "additionally",
];

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeWeights(w: HalWeights): HalWeights {
  const total = w.biometric + w.linguistic + w.integrity;
  if (total <= 0) return DEFAULT_WEIGHTS;
  return {
    biometric: w.biometric / total,
    linguistic: w.linguistic / total,
    integrity: w.integrity / total,
  };
}

function estimateTypingStats(keystrokes: KeystrokeEvent[]) {
  if (!keystrokes.length) {
    return { chars: 0, durationMs: 0, charsPerSecond: 0, largePasteDetected: false };
  }

  const sorted = [...keystrokes].sort((a, b) => a.ts - b.ts);
  const start = sorted[0].ts;
  const end = sorted[sorted.length - 1].ts;
  const durationMs = Math.max(1, end - start);

  let chars = 0;
  let largePasteDetected = false;
  for (const e of sorted) {
    if (e.key.length > 24) largePasteDetected = true;
    if (e.key.length === 1) chars += 1;
    else if (e.key === "Enter") chars += 1;
  }

  const charsPerSecond = chars / (durationMs / 1000);
  return { chars, durationMs, charsPerSecond, largePasteDetected };
}

function avgInterKeyMs(keystrokes: KeystrokeEvent[]): number {
  if (keystrokes.length < 2) return 0;
  const sorted = [...keystrokes].sort((a, b) => a.ts - b.ts);
  let total = 0;
  let n = 0;
  for (let i = 1; i < sorted.length; i++) {
    total += Math.max(1, sorted[i].ts - sorted[i - 1].ts);
    n++;
  }
  return n ? total / n : 0;
}

function buildRhythmHash(keystrokes: KeystrokeEvent[]): string {
  const avg = avgInterKeyMs(keystrokes);
  // Buckets are coarse on purpose to avoid overfitting and preserve privacy.
  const bucket = Math.round(avg / 25) * 25;
  const lenBucket = Math.round(keystrokes.length / 10) * 10;
  return `r${bucket}-n${lenBucket}`;
}

/**
 * Biometric Score:
 * - Deduct for large paste-like events
 * - Deduct for highly mechanical typing speeds
 */
export function calculateBiometricScore(input: BiometricInput): {
  score: number;
  largePasteDetected: boolean;
  mechanicalTypingDetected: boolean;
  deltaOver30Percent: boolean;
  adaptiveSensitivityApplied: boolean;
  baselineTrainingActive: boolean;
  rationale: string;
} {
  const stats = estimateTypingStats(input.keystrokes);
  let score = 100;
  let mechanicalTypingDetected = false;
  let deltaOver30Percent = false;
  let adaptiveSensitivityApplied = false;
  const baselineTrainingActive =
    (input.profile?.baseline_training_remaining ?? 0) > 0;

  if (stats.largePasteDetected) {
    score -= 35;
  }

  // Human drafting commonly ranges lower; sustained >16 cps is suspicious here.
  if (stats.charsPerSecond > 16) {
    score -= 35;
    mechanicalTypingDetected = true;
  } else if (stats.charsPerSecond > 12) {
    score -= 20;
    mechanicalTypingDetected = true;
  }

  if (stats.charsPerSecond < 0.2 && stats.chars > 30) {
    // Unusual telemetry shape; minor confidence penalty.
    score -= 10;
  }

  // Adaptive delta: compare pulse speed against user EWMA baseline.
  if (input.profile?.ewma_speed && input.profile.ewma_speed > 0) {
    const baseline = input.profile.ewma_speed;
    const delta = Math.abs(stats.charsPerSecond - baseline) / baseline;
    deltaOver30Percent = delta > 0.3;
    if (deltaOver30Percent) {
      // If recently recalibrated or baseline training is active, lower sensitivity.
      if (baselineTrainingActive || wasRecentlyRecalibrated(input.profile)) {
        score -= 8;
        adaptiveSensitivityApplied = true;
      } else {
        score -= 22;
      }
    }
  }

  return {
    score: clamp100(score),
    largePasteDetected: stats.largePasteDetected,
    mechanicalTypingDetected,
    deltaOver30Percent,
    adaptiveSensitivityApplied,
    baselineTrainingActive,
    rationale: `Biometric: cps=${stats.charsPerSecond.toFixed(2)}, chars=${stats.chars}, paste=${stats.largePasteDetected}, adaptive=${adaptiveSensitivityApplied}`,
  };
}

function wasRecentlyRecalibrated(profile: BiometricProfileRow): boolean {
  if (!profile.recalibrated_at) return false;
  const at = new Date(profile.recalibrated_at).getTime();
  if (Number.isNaN(at)) return false;
  const elapsedMs = Date.now() - at;
  return elapsedMs <= 1000 * 60 * 60 * 24 * 3; // 3 days
}

function punctuationProfile(text: string) {
  const safe = text || "";
  const chars = Math.max(1, safe.length);
  const uppercase = (safe.match(/[A-Z]/g) || []).length / chars;
  const commas = (safe.match(/,/g) || []).length / chars;
  const periods = (safe.match(/\./g) || []).length / chars;
  const exclamations = (safe.match(/!/g) || []).length / chars;
  return { uppercase, commas, periods, exclamations };
}

/**
 * Linguistic Score:
 * Compare current style against historical beats + model verdict alignment.
 */
export function calculateLinguisticScore(input: LinguisticInput): {
  score: number;
  rationale: string;
} {
  let score = 100;
  const beatText = input.historicalBeats.map((b) => b.beat_text).join(" ");
  const current = punctuationProfile(input.currentText);
  const historical = punctuationProfile(beatText);

  const styleDelta =
    Math.abs(current.uppercase - historical.uppercase) +
    Math.abs(current.commas - historical.commas) +
    Math.abs(current.periods - historical.periods);

  // Penalize significant style drift from the user's prior beats.
  if (beatText.length > 0) {
    if (styleDelta > 0.12) score -= 35;
    else if (styleDelta > 0.07) score -= 20;
    else if (styleDelta > 0.04) score -= 10;
  }

  // Model disagreement should reduce confidence in "human-like continuity".
  if (input.geminiVerdict !== input.claudeVerdict) {
    score -= 25;
  } else if (input.geminiVerdict === "NON_HUMAN") {
    score -= 35;
  } else if (input.geminiVerdict === "INCONCLUSIVE") {
    score -= 15;
  }

  return {
    score: clamp100(score),
    rationale: `Linguistic: styleDelta=${styleDelta.toFixed(3)}, gemini=${input.geminiVerdict}, claude=${input.claudeVerdict}`,
  };
}

/**
 * Integrity Score:
 * Penalize text that looks "too perfect" or uses common LLM transitions.
 */
export function calculateIntegrityScore(input: IntegrityInput): {
  score: number;
  tooPerfectDetected: boolean;
  llmTransitionPatternDetected: boolean;
  rationale: string;
} {
  const text = input.currentText || "";
  let score = 100;

  const sentenceCount = Math.max(1, (text.match(/[.!?]/g) || []).length);
  const commaCount = (text.match(/,/g) || []).length;
  const avgSentenceLen = text.length / sentenceCount;

  const transitionMatches = LLM_TRANSITION_PATTERNS.filter((p) =>
    text.toLowerCase().includes(p)
  );
  const llmTransitionPatternDetected = transitionMatches.length > 0;
  if (llmTransitionPatternDetected) {
    score -= Math.min(25, 10 + transitionMatches.length * 5);
  }

  // "Too perfect" heuristic: long text with low typo/noise and very regular punctuation.
  const typoLike = (text.match(/\b(teh|adn|recieve|definately)\b/gi) || []).length;
  const punctuationVariance = Math.abs(commaCount / Math.max(1, text.length) - 0.02);
  const tooPerfectDetected =
    text.length > 450 && typoLike === 0 && punctuationVariance < 0.006 && avgSentenceLen > 75;

  if (tooPerfectDetected) {
    score -= 30;
  }

  // Slight penalty if either model reason explicitly calls out AI-like structure.
  const modelReasons = `${input.geminiReason || ""} ${input.claudeReason || ""}`.toLowerCase();
  if (/(ai|templated|formulaic|machine-like|llm)/i.test(modelReasons)) {
    score -= 10;
  }

  return {
    score: clamp100(score),
    tooPerfectDetected,
    llmTransitionPatternDetected,
    rationale: `Integrity: transitions=${transitionMatches.join("|") || "none"}, tooPerfect=${tooPerfectDetected}`,
  };
}

export function calculateHalScore(params: {
  biometric: BiometricInput;
  linguistic: LinguisticInput;
  integrity: IntegrityInput;
  weights?: Partial<HalWeights>;
}): HalScoreResult {
  const normalizedWeights = normalizeWeights({
    ...DEFAULT_WEIGHTS,
    ...(params.weights || {}),
  });

  const biometric = calculateBiometricScore(params.biometric);
  const linguistic = calculateLinguisticScore(params.linguistic);
  const integrity = calculateIntegrityScore(params.integrity);

  const weighted =
    biometric.score * normalizedWeights.biometric +
    linguistic.score * normalizedWeights.linguistic +
    integrity.score * normalizedWeights.integrity;

  return {
    halScore: clamp100(weighted),
    subScores: {
      biometric: biometric.score,
      linguistic: linguistic.score,
      integrity: integrity.score,
    },
    weights: normalizedWeights,
    flags: {
      largePasteDetected: biometric.largePasteDetected,
      mechanicalTypingDetected: biometric.mechanicalTypingDetected,
      tooPerfectDetected: integrity.tooPerfectDetected,
      llmTransitionPatternDetected: integrity.llmTransitionPatternDetected,
      adaptiveSensitivityApplied: biometric.adaptiveSensitivityApplied,
      deltaOver30Percent: biometric.deltaOver30Percent,
      baselineTrainingActive: biometric.baselineTrainingActive,
    },
    rationale: [biometric.rationale, linguistic.rationale, integrity.rationale],
  };
}

export async function getBiometricProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<BiometricProfileRow | null> {
  const { data, error } = await supabase
    .from("biometric_profile")
    .select(
      "user_id, ewma_speed, rhythm_hash, recalibrated_at, baseline_training_remaining, updated_at, created_at"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as BiometricProfileRow | null) ?? null;
}

export async function upsertBiometricProfileFromPulse(params: {
  supabase: SupabaseClient;
  userId: string;
  keystrokes: KeystrokeEvent[];
  alpha?: number;
}): Promise<BiometricProfileRow> {
  const { supabase, userId, keystrokes } = params;
  const alpha = params.alpha ?? 0.35;
  const stats = estimateTypingStats(keystrokes);
  const rhythmHash = buildRhythmHash(keystrokes);

  const existing = await getBiometricProfile(supabase, userId);
  const ewmaSpeed =
    existing?.ewma_speed && existing.ewma_speed > 0
      ? alpha * stats.charsPerSecond + (1 - alpha) * existing.ewma_speed
      : stats.charsPerSecond;
  const remaining = Math.max(
    0,
    (existing?.baseline_training_remaining ?? 0) - 1
  );

  const { data, error } = await supabase
    .from("biometric_profile")
    .upsert(
      {
        user_id: userId,
        ewma_speed: ewmaSpeed,
        rhythm_hash: rhythmHash,
        recalibrated_at: existing?.recalibrated_at ?? null,
        baseline_training_remaining: remaining,
      },
      { onConflict: "user_id" }
    )
    .select(
      "user_id, ewma_speed, rhythm_hash, recalibrated_at, baseline_training_remaining, updated_at, created_at"
    )
    .single();

  if (error) throw error;
  return data as BiometricProfileRow;
}

/**
 * Reset biometric baseline and mark next 3 beats as Baseline Training.
 */
export async function recalibrateUser(
  supabase: SupabaseClient,
  userId: string
): Promise<BiometricProfileRow> {
  const { data, error } = await supabase
    .from("biometric_profile")
    .upsert(
      {
        user_id: userId,
        ewma_speed: null,
        rhythm_hash: null,
        recalibrated_at: new Date().toISOString(),
        baseline_training_remaining: 3,
      },
      { onConflict: "user_id" }
    )
    .select(
      "user_id, ewma_speed, rhythm_hash, recalibrated_at, baseline_training_remaining, updated_at, created_at"
    )
    .single();

  if (error) throw error;
  return data as BiometricProfileRow;
}

