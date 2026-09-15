/**
 * Shared HAL tamper suite for live `/api/hal/session` and offline sealed resync.
 * Hard reject = gaming / impossible physics. Soft flag = transparency only (full score).
 */

import { normalizedLatencySpread, rhythmAnomalyThresholdForLocale } from "./halMetrics.js";
import type { HalLocale } from "./halMetrics.js";

export type HalTamperHardCode =
  | "impossible_rhythm_flat"
  | "impossible_rhythm_bounds"
  | "paste_as_typing"
  | "clock_skew"
  | "non_monotonic_time"
  | "caps_exceeded"
  | "replay_batch"
  | "cross_path_collision"
  | "seal_integrity";

export type HalTamperSoftCode =
  | "linguistic_anomaly"
  | "high_paste_ratio"
  | "rhythm_outlier"
  | "thin_content_delta";

export type HalDnaEventLike = {
  key?: string;
  timestamp?: string | number;
  flightTime?: number;
  dwellTime?: number;
  isSystemEvent?: boolean;
  wordsPasted?: number;
};

export type HalTamperInput = {
  locale: HalLocale;
  latencyMs: number[];
  events?: HalDnaEventLike[];
  /** Claimed typed/manual word count from stylometrics or batch summary. */
  claimedTypedWords: number;
  contentDelta?: string;
  /** Soft: linguistic anomaly flags already computed. */
  linguisticAnomalyCount?: number;
  /** Offline seal window checks */
  startedAt?: Date | null;
  endedAt?: Date | null;
  serverNow?: Date;
  clockSkewMs?: number;
  eventCount?: number;
  batchCount?: number;
  maxEvents?: number;
  maxBatches?: number;
  /** Replay / collision */
  batchAlreadyAccepted?: boolean;
  overlapsLiveSession?: boolean;
};

export type HalTamperResult = {
  ok: boolean;
  hard: HalTamperHardCode[];
  soft: HalTamperSoftCode[];
  reasons: string[];
};

const DEFAULT_CLOCK_SKEW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_EVENTS = 50_000;
const DEFAULT_MAX_BATCHES = 200;
/** Paste words >= this share of claimed typed words → hard paste-as-typing when typed keys sparse. */
const PASTE_AS_TYPING_RATIO = 0.85;
const HIGH_PASTE_SOFT_RATIO = 0.35;
const MIN_EVENTS_FOR_FLAT_CHECK = 40;
const FLAT_SPREAD_HARD = 0.02;
const MIN_FLIGHT_MS = 5;
const MAX_FLIGHT_MS = 30_000;
const THIN_CONTENT_CHARS = 40;

function pasteStats(events: HalDnaEventLike[] | undefined): {
  pasteWords: number;
  typedKeys: number;
} {
  let pasteWords = 0;
  let typedKeys = 0;
  for (const e of events ?? []) {
    if (!e || typeof e !== "object") continue;
    if (e.key === "PASTE_EVENT" || e.isSystemEvent === true) {
      const w = Number(e.wordsPasted);
      if (Number.isFinite(w) && w > 0) pasteWords += w;
      continue;
    }
    typedKeys += 1;
  }
  return { pasteWords, typedKeys };
}

/**
 * Run shared tamper checks. Pure — no I/O.
 */
export function runHalTamperChecks(input: HalTamperInput): HalTamperResult {
  const hard: HalTamperHardCode[] = [];
  const soft: HalTamperSoftCode[] = [];
  const reasons: string[] = [];

  const maxEvents = input.maxEvents ?? DEFAULT_MAX_EVENTS;
  const maxBatches = input.maxBatches ?? DEFAULT_MAX_BATCHES;
  const skew = input.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  const now = input.serverNow ?? new Date();

  if (input.batchAlreadyAccepted) {
    hard.push("replay_batch");
    reasons.push("Sealed batch already accepted (replay).");
  }
  if (input.overlapsLiveSession) {
    hard.push("cross_path_collision");
    reasons.push("Offline batch overlaps a live session already scored for this manuscript.");
  }

  const eventCount = input.eventCount ?? input.events?.length ?? input.latencyMs.length;
  if (eventCount > maxEvents) {
    hard.push("caps_exceeded");
    reasons.push(`Event count ${eventCount} exceeds cap ${maxEvents}.`);
  }
  if (input.batchCount != null && input.batchCount > maxBatches) {
    hard.push("caps_exceeded");
    reasons.push(`Batch count ${input.batchCount} exceeds cap ${maxBatches}.`);
  }

  if (input.startedAt && input.endedAt) {
    if (input.endedAt.getTime() < input.startedAt.getTime()) {
      hard.push("non_monotonic_time");
      reasons.push("Batch ended_at before started_at.");
    }
    // Future-dated ends only (past ends are normal after focus/offline writing).
    if (input.endedAt.getTime() - now.getTime() > skew) {
      hard.push("clock_skew");
      reasons.push("Batch ended_at is too far in the future vs server.");
    }
  }

  if (input.events && input.events.length >= 2) {
    let prev = -Infinity;
    for (const e of input.events) {
      const t =
        typeof e.timestamp === "number"
          ? e.timestamp
          : e.timestamp
            ? Date.parse(String(e.timestamp))
            : NaN;
      if (!Number.isFinite(t)) continue;
      if (t < prev) {
        hard.push("non_monotonic_time");
        reasons.push("Event timestamps are not monotonic.");
        break;
      }
      prev = t;
    }
  }

  const latency = input.latencyMs.filter((n) => Number.isFinite(n) && n >= 0);
  if (latency.length >= MIN_EVENTS_FOR_FLAT_CHECK) {
    const spread = normalizedLatencySpread(latency);
    if (spread <= FLAT_SPREAD_HARD) {
      hard.push("impossible_rhythm_flat");
      reasons.push("Latency series is robotically flat (near-zero variance).");
    }
    const outOfBounds = latency.filter((n) => n < MIN_FLIGHT_MS || n > MAX_FLIGHT_MS);
    if (outOfBounds.length > latency.length * 0.5) {
      hard.push("impossible_rhythm_bounds");
      reasons.push("Majority of flight times outside human bounds.");
    }
  }

  const { pasteWords, typedKeys } = pasteStats(input.events);
  const claimed = Math.max(0, input.claimedTypedWords);
  if (pasteWords > 0 && claimed > 0) {
    const pasteRatio = pasteWords / (pasteWords + claimed);
    if (
      (pasteRatio >= PASTE_AS_TYPING_RATIO && typedKeys < Math.max(10, pasteWords * 0.1)) ||
      (pasteWords >= 80 && typedKeys < 15 && pasteWords > typedKeys * 10)
    ) {
      hard.push("paste_as_typing");
      reasons.push("Large paste mass claimed with sparse typed keystrokes.");
    } else if (pasteRatio >= HIGH_PASTE_SOFT_RATIO) {
      soft.push("high_paste_ratio");
    }
  } else if (pasteWords > 80 && typedKeys < 15 && claimed > 50) {
    hard.push("paste_as_typing");
    reasons.push("Paste-heavy session with almost no typed keys.");
  }

  const threshold = rhythmAnomalyThresholdForLocale(input.locale);
  if (latency.length >= 8) {
    const spread = normalizedLatencySpread(latency);
    if (spread > threshold * 2.5 && !hard.includes("impossible_rhythm_flat")) {
      soft.push("rhythm_outlier");
    }
  }

  if ((input.linguisticAnomalyCount ?? 0) > 0) {
    soft.push("linguistic_anomaly");
  }

  const delta = String(input.contentDelta ?? "").trim();
  if (delta.length > 0 && delta.length < THIN_CONTENT_CHARS && (input.events?.length ?? 0) > 20) {
    soft.push("thin_content_delta");
  }

  return {
    ok: hard.length === 0,
    hard: [...new Set(hard)],
    soft: [...new Set(soft)],
    reasons,
  };
}

export function httpStatusForTamper(result: HalTamperResult): number {
  if (result.hard.includes("replay_batch") || result.hard.includes("cross_path_collision")) {
    return 409;
  }
  return 400;
}
