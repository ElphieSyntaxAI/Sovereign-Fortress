/**
 * Linguistic forensics: TTR, syntactic density, function-word weight, style similarity, anomalies.
 */

import {
  segmentWordsForLocale,
  splitSentencesForLocale,
  type CalibrationLocale,
} from "@elphie-syntax/core/lib/forensics/calibration/pure";

/** Normalized feature vector extracted from a text sample (one "session"). */
export type LinguisticSessionProfile = {
  ttr: number;
  /** Mean words per sentence. */
  avgSentenceLengthWords: number;
  /** Punctuation marks per 100 content words (approx.). */
  punctuationFrequency: number;
  /** Share of tokens that are function words [0, 1]. */
  functionWordWeight: number;
  /** Std dev of per-sentence word counts (uniformity signal). */
  sentenceLengthStdDev: number;
};

export type LinguisticAnomalyFlags = {
  /** TTR below threshold — often highly repetitive / templated. */
  lowTtrRepetitive: boolean;
  /** Sentence lengths unusually uniform — heuristic for AI-like regularity. */
  overlyUniformSyntax: boolean;
};

/** High-frequency Japanese particles / auxiliaries for `functionWordWeight` when `locale === 'ja'`. */
const DEFAULT_JA_FUNCTION_TOKENS = new Set([
  "の",
  "に",
  "は",
  "を",
  "が",
  "と",
  "も",
  "で",
  "へ",
  "や",
  "から",
  "まで",
  "より",
  "ね",
  "よ",
  "か",
  "って",
  "という",
  "など",
  "ばかり",
  "ほど",
  "だけ",
]);

const DEFAULT_FUNCTION_WORDS = new Set(
  [
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "if",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "to",
    "with",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "am",
    "it",
    "this",
    "that",
    "these",
    "those",
    "which",
    "who",
    "whom",
    "what",
    "there",
    "here",
    "then",
    "than",
    "so",
    "such",
    "no",
    "not",
    "nor",
    "do",
    "does",
    "did",
    "have",
    "has",
    "had",
    "can",
    "could",
    "would",
    "should",
    "may",
    "might",
    "must",
    "will",
    "shall",
    "about",
    "above",
    "after",
    "before",
    "between",
    "through",
    "during",
    "under",
    "again",
    "further",
    "once",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "every",
    "both",
    "few",
    "more",
    "most",
    "other",
    "some",
    "any",
    "own",
    "same",
    "very",
    "just",
    "only",
    "because",
    "until",
    "while",
    "although",
    "though",
    "also",
    "too",
  ].map((w) => w.toLowerCase())
);

function countPunctuation(text: string, locale: CalibrationLocale): number {
  if (locale === "ja") {
    return (text.match(/[.,;:!?"'()\[\]{}—–\-、。，．：；！？「」『』（）［］｛｝]/gu) ?? []).length;
  }
  return (text.match(/[.,;:!?"'()\[\]{}—–\-]/gu) ?? []).length;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sampleStdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return Math.sqrt(nums.reduce((s, x) => s + (x - m) ** 2, 0) / (nums.length - 1));
}

function toFeatureVector(p: LinguisticSessionProfile): number[] {
  return [
    p.ttr,
    Math.min(p.avgSentenceLengthWords / 40, 1),
    Math.min(p.punctuationFrequency / 25, 1),
    p.functionWordWeight,
    Math.min(p.sentenceLengthStdDev / 15, 1),
  ];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type LinguisticAnalyzerOptions = {
  /** TTR at or below this value triggers `lowTtrRepetitive` (default 0.18). */
  lowTtrThreshold?: number;
  /** Sentence-length std dev at or below this triggers `overlyUniformSyntax` (default 1.25 words). */
  uniformSyntaxStdDevThreshold?: number;
  /** Custom function-word set (lowercase Latin or Japanese tokens). */
  functionWords?: Set<string>;
  /** Japanese particle / auxiliary set for `locale === 'ja'`. */
  jaFunctionTokens?: Set<string>;
};

export class LinguisticAnalyzer {
  private readonly lowTtrThreshold: number;
  private readonly uniformSyntaxStdDevThreshold: number;
  private readonly functionWords: Set<string>;
  private readonly jaFunctionTokens: Set<string>;

  constructor(options: LinguisticAnalyzerOptions = {}) {
    this.lowTtrThreshold = options.lowTtrThreshold ?? 0.18;
    this.uniformSyntaxStdDevThreshold = options.uniformSyntaxStdDevThreshold ?? 1.25;
    this.functionWords = options.functionWords ?? DEFAULT_FUNCTION_WORDS;
    this.jaFunctionTokens = options.jaFunctionTokens ?? DEFAULT_JA_FUNCTION_TOKENS;
  }

  /** Extract TTR, syntactic density, function-word weight, and length variability. */
  extract(text: string, locale: CalibrationLocale = "en"): LinguisticSessionProfile {
    const trimmed = text.trim();
    const words = segmentWordsForLocale(trimmed, locale);
    const totalWords = words.length;
    const unique = new Set(words);
    const ttr = totalWords > 0 ? unique.size / totalWords : 0;

    const sentences = splitSentencesForLocale(trimmed, locale);
    const sentenceWordCounts = sentences.map((s: string) => segmentWordsForLocale(s, locale).length);
    const avgSentenceLengthWords =
      sentenceWordCounts.length > 0 ? mean(sentenceWordCounts) : 0;
    const sentenceLengthStdDev = sampleStdDev(sentenceWordCounts);

    const punctCount = countPunctuation(trimmed, locale);
    const punctuationFrequency = totalWords > 0 ? (punctCount / totalWords) * 100 : 0;

    let fn = 0;
    if (locale === "ja") {
      for (const w of words) {
        if (this.jaFunctionTokens.has(w)) fn += 1;
      }
    } else {
      for (const w of words) {
        const lw = w.toLowerCase();
        if (this.functionWords.has(lw)) fn += 1;
      }
    }
    const functionWordWeight = totalWords > 0 ? fn / totalWords : 0;

    return {
      ttr,
      avgSentenceLengthWords: Math.round(avgSentenceLengthWords * 1000) / 1000,
      punctuationFrequency: Math.round(punctuationFrequency * 1000) / 1000,
      functionWordWeight: Math.round(functionWordWeight * 10000) / 10000,
      sentenceLengthStdDev: Math.round(sentenceLengthStdDev * 1000) / 1000,
    };
  }

  detectAnomalies(profile: LinguisticSessionProfile): LinguisticAnomalyFlags {
    const lowTtrRepetitive =
      profile.ttr > 0 && profile.ttr <= this.lowTtrThreshold;
    const overlyUniformSyntax =
      profile.sentenceLengthStdDev >= 0 &&
      profile.sentenceLengthStdDev <= this.uniformSyntaxStdDevThreshold &&
      profile.avgSentenceLengthWords >= 6;

    return { lowTtrRepetitive, overlyUniformSyntax };
  }

  /**
   * Compare two sessions (raw text or precomputed profiles). Returns similarity in [0, 100].
   */
  compareStyles(
    sessionA: string | LinguisticSessionProfile,
    sessionB: string | LinguisticSessionProfile,
    locale: CalibrationLocale = "en"
  ): number {
    const a = typeof sessionA === "string" ? this.extract(sessionA, locale) : sessionA;
    const b = typeof sessionB === "string" ? this.extract(sessionB, locale) : sessionB;
    const va = toFeatureVector(a);
    const vb = toFeatureVector(b);
    const cos = cosineSimilarity(va, vb);
    return Math.round(Math.max(0, Math.min(1, cos)) * 10000) / 100;
  }
}

/**
 * Stateless helper: compare two sessions without keeping analyzer options.
 * Uses default thresholds for any future hooks; for anomalies use `new LinguisticAnalyzer(opts).detectAnomalies`.
 */
export function compareStyles(
  sessionA: string | LinguisticSessionProfile,
  sessionB: string | LinguisticSessionProfile,
  analyzer: LinguisticAnalyzer = new LinguisticAnalyzer(),
  locale: CalibrationLocale = "en"
): number {
  return analyzer.compareStyles(sessionA, sessionB, locale);
}
