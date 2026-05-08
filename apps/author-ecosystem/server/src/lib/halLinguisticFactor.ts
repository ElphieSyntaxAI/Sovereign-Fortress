import type { LinguisticSessionProfile } from "./forensics/linguistics.js";

/** Row shape from `p4_hal_ledger_rolling_avg_5` (Supabase). */
export type HalRollingBaselineRow = {
  tenant_id: string;
  sample_sessions: number;
  avg_ttr: number | null;
  avg_avg_sentence_length_words: number | null;
  avg_punctuation_frequency: number | null;
  avg_function_word_weight: number | null;
  avg_sentence_length_std_dev: number | null;
};

const EPS = 1e-6;

/**
 * Max relative delta across linguistic dimensions vs rolling averages.
 * Returns null if there is no usable baseline.
 */
export function maxRelativeDriftAgainstBaseline(
  current: LinguisticSessionProfile,
  baseline: HalRollingBaselineRow
): number | null {
  if (!baseline.sample_sessions || baseline.sample_sessions < 1) return null;

  const pairs: [number, number | null][] = [
    [current.ttr, baseline.avg_ttr],
    [current.avgSentenceLengthWords, baseline.avg_avg_sentence_length_words],
    [current.punctuationFrequency, baseline.avg_punctuation_frequency],
    [current.functionWordWeight, baseline.avg_function_word_weight],
    [current.sentenceLengthStdDev, baseline.avg_sentence_length_std_dev],
  ];

  let max = 0;
  let any = false;
  for (const [c, b] of pairs) {
    if (b == null || !Number.isFinite(b)) continue;
    any = true;
    const rel = Math.abs(c - b) / Math.max(EPS, Math.abs(b));
    if (rel > max) max = rel;
  }

  return any ? max : null;
}

/**
 * Map drift to multiplier in [0.5, 1.2].
 * - Strong match (<=5% relative delta): 1.2
 * - Major drift (>20%): 0.5
 * - Between: linear ramp
 */
export function linguisticMatchFactor(maxRelativeDrift: number | null): number {
  if (maxRelativeDrift == null || !Number.isFinite(maxRelativeDrift)) {
    return 1;
  }
  if (maxRelativeDrift > 0.2) {
    return 0.5;
  }
  if (maxRelativeDrift <= 0.05) {
    return 1.2;
  }
  const t = (maxRelativeDrift - 0.05) / 0.15;
  const f = 1.2 - t * 0.7;
  return Math.min(1.2, Math.max(0.5, f));
}
