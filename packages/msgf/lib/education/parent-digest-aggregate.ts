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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * Pure parent digest aggregation — Resilience / Friction dashboard (Phase 2).
 * No raw drafts or keystrokes; themes only.
 */
import { anonymizeEntityToken } from "@/lib/education/anonymize-entity-token";
import {
  EduAssignmentStateSchema,
  type EduAssignmentState,
} from "@/lib/education/assignment-instance";
import {
  HalLiteMetricsSchema,
  type HalLiteMetrics,
} from "@/lib/education/hal-lite";

export type ParentAssignmentRow = {
  current_state?: unknown;
  hal_lite_metrics?: unknown;
  entity_token?: unknown;
};

export type ParentDigestSummary = {
  studentDisplayLabel: string;
  legalNote: string;
  lessonsTouched: number;
  avgHumanEffortConfidence: number;
  submittedCount: number;
  stuckCount: number;
  themes: string[];
  /** 0–100 — independent effort / submission resilience (never an outcome grade). */
  resilienceScore: number;
  /** 0–100 — structural friction / paste risk (teacher review signal). */
  frictionScore: number;
  resilienceBand: "strong" | "steady" | "needs_support";
  frictionBand: "low" | "moderate" | "elevated";
  themeCategories: {
    resilience: string[];
    friction: string[];
  };
};

export const PARENT_DIGEST_LEGAL_NOTE =
  "This digest never includes raw keystrokes or draft text. Utah H.B. 273: no auto-grade / IEP changes from AI.";

function parseMetrics(raw: unknown): HalLiteMetrics {
  const hal = HalLiteMetricsSchema.safeParse(raw ?? {});
  return hal.success
    ? hal.data
    : {
        humanEffortConfidenceScore: 1,
        pasteInjectionWarnings: 0,
        activeWritingTimeSeconds: 0,
        pasteEventsCount: 0,
        keystrokeEventsCount: 0,
        documentDeltaChars: 0,
      };
}

function parseState(raw: unknown): EduAssignmentState | null {
  const state = EduAssignmentStateSchema.safeParse(raw);
  return state.success ? state.data : null;
}

function bandResilience(score: number): ParentDigestSummary["resilienceBand"] {
  if (score >= 75) return "strong";
  if (score >= 50) return "steady";
  return "needs_support";
}

function bandFriction(score: number): ParentDigestSummary["frictionBand"] {
  if (score >= 55) return "elevated";
  if (score >= 30) return "moderate";
  return "low";
}

/**
 * Aggregate assignment-instance rows into a guardian-safe Resilience / Friction digest.
 */
export function summarizeParentAssignmentRows(input: {
  entityToken: string;
  rows: ParentAssignmentRow[];
}): ParentDigestSummary {
  const rows = input.rows;
  let confidenceSum = 0;
  let submittedCount = 0;
  let stuckCount = 0;
  let pasteWarnStudents = 0;
  const resilienceThemes = new Set<string>();
  const frictionThemes = new Set<string>();

  for (const row of rows) {
    const state = parseState(row.current_state);
    const metrics = parseMetrics(row.hal_lite_metrics);
    confidenceSum += metrics.humanEffortConfidenceScore;

    if (state === "EDU_SUBMITTED_LOCK") {
      submittedCount += 1;
      resilienceThemes.add("Finished and turned in work");
    }
    if (state === "EDU_MILESTONE_CHECKING") {
      stuckCount += 1;
      frictionThemes.add("Working through writing structure");
    }
    if (metrics.pasteInjectionWarnings > 0) {
      pasteWarnStudents += 1;
      frictionThemes.add("Paste events flagged for teacher review");
    }
    if (metrics.humanEffortConfidenceScore >= 0.85) {
      resilienceThemes.add("Steady independent writing effort");
    }
    if (
      metrics.activeWritingTimeSeconds >= 180 &&
      metrics.humanEffortConfidenceScore >= 0.7
    ) {
      resilienceThemes.add("Sustained focus while drafting");
    }
  }

  const lessonsTouched = rows.length;
  const avgHumanEffortConfidence =
    lessonsTouched === 0
      ? 1
      : Number((confidenceSum / lessonsTouched).toFixed(3));

  const submitRate = lessonsTouched === 0 ? 0 : submittedCount / lessonsTouched;
  const stuckRate = lessonsTouched === 0 ? 0 : stuckCount / lessonsTouched;
  const pasteRate = lessonsTouched === 0 ? 0 : pasteWarnStudents / lessonsTouched;

  const resilienceScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        avgHumanEffortConfidence * 55 + submitRate * 35 + (1 - stuckRate) * 10
      )
    )
  );
  const frictionScore = Math.round(
    Math.max(0, Math.min(100, stuckRate * 55 + pasteRate * 35 + (1 - avgHumanEffortConfidence) * 10))
  );

  const themes = [...new Set([...resilienceThemes, ...frictionThemes])].slice(0, 6);

  return {
    studentDisplayLabel: anonymizeEntityToken(input.entityToken),
    legalNote: PARENT_DIGEST_LEGAL_NOTE,
    lessonsTouched,
    avgHumanEffortConfidence,
    submittedCount,
    stuckCount,
    themes,
    resilienceScore,
    frictionScore,
    resilienceBand: bandResilience(resilienceScore),
    frictionBand: bandFriction(frictionScore),
    themeCategories: {
      resilience: [...resilienceThemes].slice(0, 4),
      friction: [...frictionThemes].slice(0, 4),
    },
  };
}
