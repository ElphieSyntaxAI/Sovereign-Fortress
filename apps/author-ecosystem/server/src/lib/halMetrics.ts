import type { CalibrationLocale } from "@elphie-syntax/core/lib/forensics/calibration/pure";
import {
  normalizedLatencySpread,
  rhythmAnomalyThresholdForLocale,
  segmentWordsForLocale,
  splitSentencesForLocale,
} from "@elphie-syntax/core/lib/forensics/calibration/pure";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function assertUuid(value: string, field: string): string {
  const t = value.trim();
  if (!UUID_RE.test(t)) {
    throw new HalValidationError(`${field} must be a valid UUID`);
  }
  return t;
}

export class HalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HalValidationError";
  }
}

/** Re-export for HAL routes (alias of core `CalibrationLocale`). */
export type HalLocale = CalibrationLocale;

export function parseHalLocale(raw: unknown): HalLocale {
  const s = String(raw ?? "en").toLowerCase().trim();
  if (s === "es" || s === "ja") return s;
  return "en";
}

export type CompositionEventName = "compositionstart" | "compositionend";

/**
 * Normalize DOM-style composition event names from the client.
 */
export function parseCompositionEvents(raw: unknown): CompositionEventName[] {
  if (!Array.isArray(raw)) return [];
  const out: CompositionEventName[] = [];
  for (const x of raw) {
    const t = String(x).trim().toLowerCase();
    if (t === "compositionstart" || t === "compositionend") {
      out.push(t);
    }
  }
  return out;
}

/**
 * IME session if explicitly flagged or any compositionstart / compositionend was reported.
 */
export function inferIsImeSession(input: {
  isImeSession?: boolean;
  compositionEvents?: CompositionEventName[];
}): boolean {
  if (input.isImeSession === true) return true;
  const ev = input.compositionEvents ?? [];
  return ev.includes("compositionstart") || ev.includes("compositionend");
}

function parseNumberArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const x of raw) {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n)) continue;
    out.push(n);
  }
  return out;
}

/**
 * Optional `compositionBlocks`: each inner array is per-keystroke flight times inside one IME
 * commitment; summed server-side into one block latency.
 */
export function parseCompositionBlocks(raw: unknown): number[][] {
  if (!Array.isArray(raw)) return [];
  const out: number[][] = [];
  for (const row of raw) {
    if (!Array.isArray(row)) continue;
    const inner = parseNumberArray(row);
    if (inner.length > 0) out.push(inner);
  }
  return out;
}

/** Sum each IME slice into one committed-block latency (ms). */
export function latenciesFromCompositionBlocks(blocks: number[][]): number[] {
  const out: number[] = [];
  for (const b of blocks) {
    if (b.length === 0) continue;
    const sum = b.reduce((a, x) => a + (Number.isFinite(x) && x >= 0 ? x : 0), 0);
    if (sum > 0) out.push(Math.round(sum));
  }
  return out;
}

export type ResolveHalImeRhythmResult = {
  isImeSession: boolean;
  /** Series used for rhythm / variance / `keystroke_latency_ms` when IME blocks are used. */
  latencyMsForRhythm: number[];
  /** Units aligned with `latencyMsForRhythm` for the keystroke/word ratio when IME. */
  rhythmUnitCount: number;
  /** Original per-key flights (audit). */
  rawKeystrokeLatencyMs: number[];
};

/**
 * Resolves rhythm inputs for HAL: when an IME session is detected, prefer committed-block
 * latencies so Kanji selection pauses do not dominate variance.
 */
export function resolveHalImeRhythm(input: {
  keystrokeLatencies: number[];
  committedBlockLatenciesMs?: unknown;
  compositionBlocks?: unknown;
  isImeSession?: boolean;
  compositionEvents?: unknown;
}): ResolveHalImeRhythmResult {
  const raw = toLatencyIntArray(parseNumberArray(input.keystrokeLatencies));
  const events = parseCompositionEvents(input.compositionEvents);
  const isImeSession = inferIsImeSession({
    isImeSession: input.isImeSession,
    compositionEvents: events,
  });

  let latencyMsForRhythm = raw;
  let rhythmUnitCount = Math.max(0, raw.length);

  if (isImeSession) {
    const blocks = toLatencyIntArray(parseNumberArray(input.committedBlockLatenciesMs));
    if (blocks.length > 0) {
      latencyMsForRhythm = blocks;
      rhythmUnitCount = blocks.length;
    } else {
      const slices = parseCompositionBlocks(input.compositionBlocks);
      const merged = latenciesFromCompositionBlocks(slices);
      if (merged.length > 0) {
        latencyMsForRhythm = merged;
        rhythmUnitCount = merged.length;
      } else if (raw.length > 0) {
        const sum = raw.reduce((a, b) => a + b, 0);
        latencyMsForRhythm = [Math.round(sum)];
        rhythmUnitCount = 1;
      }
    }
  }

  if (latencyMsForRhythm.length === 0 && raw.length > 0) {
    latencyMsForRhythm = raw;
    rhythmUnitCount = raw.length;
  }

  return {
    isImeSession: isImeSession,
    latencyMsForRhythm,
    rhythmUnitCount,
    rawKeystrokeLatencyMs: raw,
  };
}

/** Relaxation divisor for normalized latency spread when scoring (IME composition, non-block path). */
const JA_IME_RHYTHM_RELAXATION = 1.68;

/** Keystroke events with latency → treat count as manual keystrokes for HAL ratio. */
export function toLatencyIntArray(latencies: number[]): number[] {
  return latencies.map((n) => {
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(Math.round(n), 2_147_483_647);
  });
}

export function varianceSample(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (nums.length - 1);
}

/** 90th percentile of inter-key latencies (ms), aligned with calibration `keystroke_fingerprint.p90_ms`. */
export function latencyP90Ms(latencyMs: number[]): number {
  const nums = latencyMs.filter((n) => Number.isFinite(n) && n >= 0);
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.9 * sorted.length) - 1));
  return Math.round(sorted[idx]! * 100) / 100;
}

export type ComputeHalScoreOptions = {
  /** When true, variance uses `latencyMs` (typically committed blocks); ratio uses `keystrokeCount`. */
  isImeSession?: boolean;
};

/**
 * HAL score: (rhythm units / total words) dampened by latency variance on the rhythm series.
 * For IME sessions, pass committed-block latencies and `rhythmUnitCount` (block count) so Kanji
 * picker pauses do not tank the score. For `ja` + non-IME, variance is relaxed via `JA_IME_RHYTHM_RELAXATION`.
 */
export function computeHalScore(
  keystrokeCount: number,
  totalWords: number,
  latencyMs: number[],
  locale: HalLocale = "en",
  options: ComputeHalScoreOptions = {}
): number {
  const words = Math.max(0, totalWords);
  const keys = Math.max(0, keystrokeCount);

  const baseRatio = words > 0 ? keys / words : keys > 0 ? keys : 0;

  const normalizedSpread = normalizedLatencySpread(latencyMs);
  let adjustedSpread = normalizedSpread;
  if (locale === "ja" && !options.isImeSession) {
    adjustedSpread = normalizedSpread / JA_IME_RHYTHM_RELAXATION;
  }
  const varianceFactor = 1 / (1 + adjustedSpread);

  return baseRatio * varianceFactor;
}

export { rhythmAnomalyThresholdForLocale, normalizedLatencySpread };

export function stylometricFromContentDelta(
  contentDelta: string,
  locale: HalLocale = "en"
): {
  average_sentence_length_words: number;
  vocabulary_variety: number;
  word_count: number;
  sentence_count: number;
  unique_word_count: number;
  locale: HalLocale;
  segmentation: "latin" | "intl_ja" | "ja_fallback";
} {
  const trimmed = contentDelta.trim();
  if (!trimmed) {
    return {
      average_sentence_length_words: 0,
      vocabulary_variety: 0,
      word_count: 0,
      sentence_count: 0,
      unique_word_count: 0,
      locale,
      segmentation: locale === "ja" ? "ja_fallback" : "latin",
    };
  }

  const sentences = splitSentencesForLocale(trimmed, locale);
  const allWords = segmentWordsForLocale(trimmed, locale);
  const sentenceWordCounts = sentences.map((s: string) => segmentWordsForLocale(s, locale).length);
  const avgLen =
    sentenceWordCounts.length > 0
      ? sentenceWordCounts.reduce((a: number, b: number) => a + b, 0) / sentenceWordCounts.length
      : 0;

  const unique = new Set(allWords);
  const variety = allWords.length > 0 ? unique.size / allWords.length : 0;

  let segmentation: "latin" | "intl_ja" | "ja_fallback" = "latin";
  if (locale === "ja") {
    segmentation =
      typeof Intl !== "undefined" && "Segmenter" in Intl && allWords.length > 0
        ? "intl_ja"
        : "ja_fallback";
  }

  return {
    average_sentence_length_words: Math.round(avgLen * 1000) / 1000,
    vocabulary_variety: Math.round(variety * 10000) / 10000,
    word_count: allWords.length,
    sentence_count: sentences.length,
    unique_word_count: unique.size,
    locale,
    segmentation,
  };
}
