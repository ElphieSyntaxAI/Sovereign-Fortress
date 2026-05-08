/** Keystroke rhythm summary used for HAL-style forensics. */
export type KeystrokeFingerprint = {
  n: number;
  mean_ms: number;
  stdev_ms: number;
  p50_ms: number;
  p90_ms: number;
  /** Stable digest of the latency series (not cryptographic). */
  series_digest: string;
};

/** Locale for rhythm policy (IME, tokenization). Stored with calibration rows. */
export type CalibrationLocale = "en" | "es" | "ja";

export interface CalibrationResult {
  keystroke_fingerprint: KeystrokeFingerprint;
  /** Approximate lexical density: unique tokens / word tokens in [0,1]. */
  lexical_density: number;
  /** Lightweight syntactic shape signals from raw text. */
  syntactic_baseline: {
    avg_sentence_length_words: number;
    avg_commas_per_sentence: number;
    question_sentence_ratio: number;
  };
  timestamp: string;
  /** Input locale when this sample was captured. */
  locale?: CalibrationLocale;
  /**
   * Max normalized inter-key spread deemed "normal" for this locale before rhythm is flagged anomalous.
   * Higher for `ja` (IME composition adds legitimate long pauses).
   */
  rhythm_anomaly_threshold?: number;
  /**
   * True when the client reported IME composition (e.g. compositionstart / compositionend).
   * Rhythm fingerprint may use committed-block latencies instead of per-keystroke flights.
   */
  is_ime_session?: boolean;
}

export type TenantScope = "author" | "school_tenant";

function sortedMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

function simpleSeriesDigest(latencies: number[]): string {
  let h = 2166136261;
  for (const n of latencies) {
    const x = Math.round(n) >>> 0;
    h ^= x;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z0-9']+/gu)
    ?.filter(Boolean) ?? [];
}

function splitSentencesLatin(text: string): string[] {
  const chunks = text
    .split(/[.!?]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return chunks.length > 0 ? chunks : text.trim() ? [text.trim()] : [];
}

/**
 * Word-like tokens for stylometrics / lexical density. Japanese uses `Intl.Segmenter` when available.
 */
export function segmentWordsForLocale(text: string, locale: CalibrationLocale | undefined): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (locale === "ja") {
    try {
      if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        const seg = new Intl.Segmenter("ja", { granularity: "word" });
        const out: string[] = [];
        for (const { segment, isWordLike } of seg.segment(trimmed)) {
          if (isWordLike && segment.trim()) out.push(segment);
        }
        if (out.length > 0) return out;
      }
    } catch {
      /* ignore */
    }
    return (
      trimmed.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFFA-Za-z0-9]+/gu)?.filter(Boolean) ?? []
    );
  }
  return tokenizeWords(trimmed);
}

/** Sentence boundaries: Japanese 。！？ vs Latin .!? */
export function splitSentencesForLocale(text: string, locale: CalibrationLocale | undefined): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (locale === "ja") {
    const parts = trimmed
      .split(/[。！？…\n]+/u)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [trimmed];
  }
  return splitSentencesLatin(trimmed);
}

function varianceSample(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (nums.length - 1);
}

/** Normalized spread used for HAL rhythm scoring (aligned with author-ecosystem `computeHalScore`). */
export function normalizedLatencySpread(latencyMs: number[]): number {
  const nums = latencyMs.filter((n) => Number.isFinite(n) && n >= 0);
  if (nums.length < 2) return 0;
  const v = varianceSample(nums);
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return mean > 0 ? v / (mean * mean + 1) : v / 10_000;
}

/**
 * Policy ceiling for `normalizedLatencySpread` before treating rhythm as anomalous.
 * Japanese allows higher spread (IME / kanji conversion pauses).
 */
export function rhythmAnomalyThresholdForLocale(locale: CalibrationLocale | undefined): number {
  const base = 2.2;
  if (locale === "ja") return Math.round(base * 1.72 * 1000) / 1000;
  if (locale === "es") return Math.round(base * 1.08 * 1000) / 1000;
  return base;
}

export type BuildCalibrationOptions = {
  locale?: CalibrationLocale;
  is_ime_session?: boolean;
};

/** Pure calibration from text + latencies (safe in browser or Node). */
export function buildCalibrationResult(
  rawText: string,
  latencyMs: number[],
  options?: BuildCalibrationOptions
): CalibrationResult {
  const nums = latencyMs.filter((n) => Number.isFinite(n) && n >= 0);
  const sorted = [...nums].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = n > 0 ? sorted.reduce((a, b) => a + b, 0) / n : 0;
  const stdev =
    n > 1
      ? Math.sqrt(sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1))
      : 0;

  const trimmed = rawText.trim();
  const locale = options?.locale;
  const words = segmentWordsForLocale(trimmed, locale);
  const unique = new Set(words);
  const lexical_density = words.length > 0 ? unique.size / words.length : 0;

  const sentences = splitSentencesForLocale(trimmed, locale);
  const sentenceWordCounts = sentences.map((s) => segmentWordsForLocale(s, locale).length);
  const avg_sentence_length_words =
    sentenceWordCounts.length > 0
      ? sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length
      : 0;

  let commaTotal = 0;
  let questionCount = 0;
  for (const s of sentences) {
    commaTotal += (s.match(/[,，、]/gu) ?? []).length;
    if (/\?\s*$/.test(s) || /？\s*$/.test(s)) questionCount += 1;
  }

  const avg_commas_per_sentence = sentences.length > 0 ? commaTotal / sentences.length : 0;
  const question_sentence_ratio = sentences.length > 0 ? questionCount / sentences.length : 0;

  const threshold = rhythmAnomalyThresholdForLocale(locale);
  const isIme = options?.is_ime_session === true;

  return {
    keystroke_fingerprint: {
      n,
      mean_ms: Math.round(mean * 100) / 100,
      stdev_ms: Math.round(stdev * 100) / 100,
      p50_ms: Math.round(sortedMedian(sorted) * 100) / 100,
      p90_ms: Math.round(percentile(sorted, 0.9) * 100) / 100,
      series_digest: simpleSeriesDigest(nums),
    },
    lexical_density: Math.round(lexical_density * 10000) / 10000,
    syntactic_baseline: {
      avg_sentence_length_words: Math.round(avg_sentence_length_words * 1000) / 1000,
      avg_commas_per_sentence: Math.round(avg_commas_per_sentence * 1000) / 1000,
      question_sentence_ratio: Math.round(question_sentence_ratio * 10000) / 10000,
    },
    timestamp: new Date().toISOString(),
    ...(locale ? { locale } : {}),
    rhythm_anomaly_threshold: threshold,
    ...(isIme ? { is_ime_session: true as const } : {}),
  };
}
