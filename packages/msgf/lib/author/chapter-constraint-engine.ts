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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
/**
 * Author Ecosystem — chapter constraint engine.
 *
 * Pure, deterministic, no I/O. Given a structured chapter payload plus a set of
 *   (a) World Bible static rules (RAG READY WORLD BIBLE §1.0 — immutable laws)
 *   (b) Trope/Sensitivity Sheet taboos (Rag Ready Trope_Sensitivity Sheet §1.0–§2.0)
 * it returns:
 *   • `structuralExceptions[]` — Static-Ledger violations (physics / planetary /
 *     spatial law breaches). The route handler returns HTTP 422 when this is
 *     non-empty.
 *   • `omensTriggered[]`     — Cultural taboo breaches. The route handler
 *     persists each to `author_cultural_omens` and increments the manuscript's
 *     `author_tension_ledger.tension_level`.
 *   • `tensionDelta`         — sum of taboo severities (1..10 each).
 *
 * The engine intentionally does *not* call an LLM — every test must be
 * reproducible byte-for-byte against the same inputs. NLP-level inference is
 * out of scope for the gate; the engine only checks structured fields the
 * upstream parser has already extracted.
 */

import { z } from "zod";

// -----------------------------------------------------------------------------
// 1. World Bible static rules (RAG READY WORLD BIBLE §1.0)
// -----------------------------------------------------------------------------

export const WorldBibleConstraintCategorySchema = z.enum([
  "physics",
  "planetary",
  "spatial",
  "magic",
  "history",
]);
export type WorldBibleConstraintCategory = z.infer<
  typeof WorldBibleConstraintCategorySchema
>;

export const WorldBibleConstraintOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "contains_keyword",
  "must_be_true",
  "must_be_false",
]);
export type WorldBibleConstraintOperator = z.infer<
  typeof WorldBibleConstraintOperatorSchema
>;

export const WorldBibleConstraintSchema = z.object({
  /** RAG TAG slug — e.g. "Physics:Frost_Line", "Planet_Phys:Atmosphere". */
  ruleId: z.string().min(1).max(160),
  category: WorldBibleConstraintCategorySchema,
  /** Human-readable rule (echoed back in the exception for the author UI). */
  description: z.string().min(1).max(1024),
  detector: z.object({
    /**
     * Dotted path into `chapter.scene` (e.g. `"location.gravity_g"`,
     * `"environment.descriptors"`). Resolved at runtime; missing paths fail open
     * (no violation) unless `requirePresent` is true.
     */
    field: z.string().min(1).max(160),
    operator: WorldBibleConstraintOperatorSchema,
    expected: z.unknown(),
    /** When true, missing field is itself a violation (HARD law). */
    requirePresent: z.boolean().default(false),
    /** Shown to the author when the rule fires. */
    violationMessage: z.string().min(1).max(1024),
  }),
});
export type WorldBibleConstraint = z.infer<typeof WorldBibleConstraintSchema>;

// -----------------------------------------------------------------------------
// 2. Cultural taboos (Trope/Sensitivity Sheet §1.0–§2.0)
// -----------------------------------------------------------------------------

export const CulturalTabooSchema = z.object({
  tabooId: z.string().min(1).max(160),
  description: z.string().min(1).max(1024),
  /** Maps to Trope/Sensitivity §2.1 Reaction_Severity (1..10). */
  severity: z.number().int().min(1).max(10),
  detector: z.object({
    /** Matched against `chapter.actions[i].action` (case-insensitive equal). */
    actionType: z.string().min(1).max(160),
  }),
  /** Cultural_Omen name surfaced to the author (e.g. "raven_circles_overhead"). */
  omenPattern: z.string().min(1).max(160),
});
export type CulturalTaboo = z.infer<typeof CulturalTabooSchema>;

// -----------------------------------------------------------------------------
// 3. Chapter payload (the unit being validated)
// -----------------------------------------------------------------------------

export const ChapterActionSchema = z.object({
  actor: z.string().min(1).max(160),
  action: z.string().min(1).max(160),
});
export type ChapterAction = z.infer<typeof ChapterActionSchema>;

export const ChapterScenePayloadSchema = z.object({
  /**
   * Free-form structured fields the upstream parser extracts from the chapter.
   * Constraints reference these via dotted-path `detector.field`.
   *
   * Example:
   *   {
   *     location: { planet: "Korr-7", gravity_g: 2.5, atmosphere: "thin_no_respirator" },
   *     environment: { descriptors: ["tropical", "humid"] }
   *   }
   */
  scene: z.record(z.string(), z.unknown()).default({}),
  /** Discrete character actions parsed from the chapter beat list. */
  actions: z.array(ChapterActionSchema).default([]),
});
export type ChapterScenePayload = z.infer<typeof ChapterScenePayloadSchema>;

// -----------------------------------------------------------------------------
// 4. Validation result
// -----------------------------------------------------------------------------

export type StructuralLayoutException = {
  ruleId: string;
  ruleCategory: WorldBibleConstraintCategory;
  message: string;
  offendingField: string;
  expected: unknown;
  actual: unknown;
};

export type CulturalOmenTrigger = {
  tabooId: string;
  severity: number;
  omenPattern: string;
  offendingActor: string;
};

export type ChapterValidationResult = {
  structuralExceptions: StructuralLayoutException[];
  omensTriggered: CulturalOmenTrigger[];
  tensionDelta: number;
};

// -----------------------------------------------------------------------------
// 5. Engine
// -----------------------------------------------------------------------------

/**
 * Resolves `a.b.c` against `obj`. Returns `undefined` if any segment is missing.
 */
function readPath(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  const segments = path.split(".");
  let cursor: unknown = obj;
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
}

function applyOperator(
  operator: WorldBibleConstraintOperator,
  actual: unknown,
  expected: unknown
): boolean {
  // Returns TRUE when the actual value VIOLATES the rule.
  switch (operator) {
    case "equals":
      return actual !== expected;
    case "not_equals":
      return actual === expected;
    case "gt":
      return !(typeof actual === "number" && actual > Number(expected));
    case "gte":
      return !(typeof actual === "number" && actual >= Number(expected));
    case "lt":
      return !(typeof actual === "number" && actual < Number(expected));
    case "lte":
      return !(typeof actual === "number" && actual <= Number(expected));
    case "in": {
      // Whitelist semantics:
      //   • scalar  actual → violation when actual is NOT in expected
      //   • array  actual  → violation when ANY element is NOT in expected
      if (!Array.isArray(expected)) return true;
      const set = expected as unknown[];
      if (Array.isArray(actual)) {
        return !actual.every((v) => set.includes(v));
      }
      return !set.includes(actual);
    }
    case "not_in": {
      // Blacklist semantics:
      //   • scalar  actual → violation when actual IS in expected
      //   • array  actual  → violation when ANY element IS in expected
      if (!Array.isArray(expected)) return false;
      const set = expected as unknown[];
      if (Array.isArray(actual)) {
        return actual.some((v) => set.includes(v));
      }
      return set.includes(actual);
    }
    case "contains_keyword": {
      const needle = String(expected).toLowerCase();
      if (Array.isArray(actual)) {
        return !actual.some((v) => String(v).toLowerCase().includes(needle));
      }
      return !String(actual ?? "").toLowerCase().includes(needle);
    }
    case "must_be_true":
      return actual !== true;
    case "must_be_false":
      return actual !== false;
    default:
      return false;
  }
}

/**
 * Pure entrypoint. Given the chapter + world bible + taboos, returns the full
 * validation result. The route handler is responsible for persistence.
 */
export function validateChapterAgainstWorldBible(input: {
  chapter: ChapterScenePayload;
  worldBibleRules: WorldBibleConstraint[];
  culturalTaboos: CulturalTaboo[];
}): ChapterValidationResult {
  const structuralExceptions: StructuralLayoutException[] = [];

  for (const rule of input.worldBibleRules) {
    const actual = readPath(input.chapter.scene, rule.detector.field);

    if (actual === undefined) {
      if (rule.detector.requirePresent) {
        structuralExceptions.push({
          ruleId: rule.ruleId,
          ruleCategory: rule.category,
          message: `${rule.detector.violationMessage} (required field "${rule.detector.field}" was missing).`,
          offendingField: rule.detector.field,
          expected: rule.detector.expected,
          actual: null,
        });
      }
      continue;
    }

    if (applyOperator(rule.detector.operator, actual, rule.detector.expected)) {
      structuralExceptions.push({
        ruleId: rule.ruleId,
        ruleCategory: rule.category,
        message: rule.detector.violationMessage,
        offendingField: rule.detector.field,
        expected: rule.detector.expected,
        actual,
      });
    }
  }

  const omensTriggered: CulturalOmenTrigger[] = [];
  let tensionDelta = 0;

  if (input.culturalTaboos.length > 0 && input.chapter.actions.length > 0) {
    const tabooByAction = new Map<string, CulturalTaboo>();
    for (const taboo of input.culturalTaboos) {
      tabooByAction.set(taboo.detector.actionType.toLowerCase(), taboo);
    }
    for (const action of input.chapter.actions) {
      const taboo = tabooByAction.get(action.action.toLowerCase());
      if (!taboo) continue;
      omensTriggered.push({
        tabooId: taboo.tabooId,
        severity: taboo.severity,
        omenPattern: taboo.omenPattern,
        offendingActor: action.actor,
      });
      tensionDelta += taboo.severity;
    }
  }

  return { structuralExceptions, omensTriggered, tensionDelta };
}
