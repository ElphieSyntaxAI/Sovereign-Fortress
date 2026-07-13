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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * HAL Lite — classroom-light Human Effort Signal (Author HAL Ledger → Education vector).
 * Tracks paste events / telemetry velocity for Google Docs sidebar without Author forensics.
 */
import { z } from "zod";

import { LEARNING_BREAKDOWN_INDEX } from "@/lib/education/learning-breakdown-index";

/** Characters in a single paste that raise PASTE_INJECTION (4th-grade-light threshold). */
export const PASTE_INJECTION_CHAR_THRESHOLD = 120;

export const HalLiteMetricsSchema = z.object({
  activeWritingTimeSeconds: z.number().finite().min(0).default(0),
  pasteEventsCount: z.number().int().min(0).default(0),
  pasteInjectionWarnings: z.number().int().min(0).default(0),
  keystrokeEventsCount: z.number().int().min(0).default(0),
  documentDeltaChars: z.number().int().default(0),
  humanEffortConfidenceScore: z.number().min(0).max(1).default(1),
});

export type HalLiteMetrics = z.infer<typeof HalLiteMetricsSchema>;

export type PasteAssessment = {
  isPasteInjection: boolean;
  charsPasted: number;
  warningCode: "PASTE_INJECTION" | null;
  breakdown: typeof LEARNING_BREAKDOWN_INDEX.pasteWithoutKeystrokes | null;
};

export function emptyHalLiteMetrics(): HalLiteMetrics {
  return {
    activeWritingTimeSeconds: 0,
    pasteEventsCount: 0,
    pasteInjectionWarnings: 0,
    keystrokeEventsCount: 0,
    documentDeltaChars: 0,
    humanEffortConfidenceScore: 1,
  };
}

/**
 * Assess a document-length delta. Large positive jumps without proportional
 * keystroke rhythm are treated as paste injection.
 */
export function assessPasteDelta(input: {
  deltaChars: number;
  matchingKeystrokeCount?: number;
  threshold?: number;
}): PasteAssessment {
  const threshold = input.threshold ?? PASTE_INJECTION_CHAR_THRESHOLD;
  const charsPasted = Math.max(0, input.deltaChars);
  const keys = input.matchingKeystrokeCount ?? 0;
  const isPasteInjection =
    charsPasted >= threshold && keys < Math.max(3, Math.floor(charsPasted / 40));

  return {
    isPasteInjection,
    charsPasted,
    warningCode: isPasteInjection ? "PASTE_INJECTION" : null,
    breakdown: isPasteInjection
      ? LEARNING_BREAKDOWN_INDEX.pasteWithoutKeystrokes
      : null,
  };
}

/**
 * Recompute confidence from cumulative HAL Lite counters.
 * Paste injections and sparse keystroke coverage depress the score.
 */
export function computeHumanEffortConfidence(metrics: HalLiteMetrics): number {
  let score = 1;
  score -= Math.min(0.45, metrics.pasteInjectionWarnings * 0.12);
  score -= Math.min(0.2, Math.max(0, metrics.pasteEventsCount - 2) * 0.04);

  const writing = metrics.activeWritingTimeSeconds;
  if (writing >= 60 && metrics.keystrokeEventsCount < 10) {
    score -= 0.25;
  }
  if (
    metrics.documentDeltaChars > PASTE_INJECTION_CHAR_THRESHOLD * 2 &&
    metrics.keystrokeEventsCount < 20
  ) {
    score -= 0.15;
  }

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

export function applyPasteAssessment(
  metrics: HalLiteMetrics,
  assessment: PasteAssessment
): HalLiteMetrics {
  const next: HalLiteMetrics = {
    ...metrics,
    pasteEventsCount: metrics.pasteEventsCount + (assessment.charsPasted > 0 ? 1 : 0),
    pasteInjectionWarnings:
      metrics.pasteInjectionWarnings + (assessment.isPasteInjection ? 1 : 0),
    documentDeltaChars: metrics.documentDeltaChars + assessment.charsPasted,
  };
  next.humanEffortConfidenceScore = computeHumanEffortConfidence(next);
  return next;
}

export function applyActiveWritingSeconds(
  metrics: HalLiteMetrics,
  seconds: number
): HalLiteMetrics {
  const next: HalLiteMetrics = {
    ...metrics,
    activeWritingTimeSeconds: Math.max(
      0,
      metrics.activeWritingTimeSeconds + Math.max(0, seconds)
    ),
  };
  next.humanEffortConfidenceScore = computeHumanEffortConfidence(next);
  return next;
}

export function applyKeystrokeBurst(
  metrics: HalLiteMetrics,
  count: number
): HalLiteMetrics {
  const next: HalLiteMetrics = {
    ...metrics,
    keystrokeEventsCount: metrics.keystrokeEventsCount + Math.max(0, count),
  };
  next.humanEffortConfidenceScore = computeHumanEffortConfidence(next);
  return next;
}

/** Wire shape for assignment instance JSON (plan §3). */
export function toHalLiteWire(metrics: HalLiteMetrics): {
  active_writing_time_seconds: number;
  paste_events_count: number;
  human_effort_confidence_score: number;
  paste_injection_warnings: number;
} {
  return {
    active_writing_time_seconds: metrics.activeWritingTimeSeconds,
    paste_events_count: metrics.pasteEventsCount,
    human_effort_confidence_score: metrics.humanEffortConfidenceScore,
    paste_injection_warnings: metrics.pasteInjectionWarnings,
  };
}
