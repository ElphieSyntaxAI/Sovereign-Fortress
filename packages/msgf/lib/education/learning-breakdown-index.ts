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
 * Syntax Education — 1.1.1 genealogical paths for **learning breakdowns** (P6 cold layer).
 * Uses the same `GenealogicalBugIndex` wire format as MSGF codebase bugs; only semantics differ.
 */
import {
  buildGenealogicalBugIndex,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";

/** Preset learning-breakdown instances (category → branch → instance). */
export const LEARNING_BREAKDOWN_INDEX = {
  /** Paste / injection without matching key events (HAL authenticity). */
  pasteWithoutKeystrokes: buildGenealogicalBugIndex({
    level_1_category: "1.0_AUTHENTICITY",
    level_1_1_branch: "1.1_HAL",
    level_1_1_1_instance: "1.1.1_PASTE_WITHOUT_KEYS",
  }),
  /** ELA composition — outline / hook milestone friction. */
  elaOutlineFriction: buildGenealogicalBugIndex({
    level_1_category: "1.0_ELA",
    level_1_1_branch: "1.1_COMPOSITION",
    level_1_1_1_instance: "1.1.1_OUTLINE_FRICTION",
  }),
  /** Math — operational step latency anomaly. */
  mathStepLatency: buildGenealogicalBugIndex({
    level_1_category: "1.0_MATH",
    level_1_1_branch: "1.1_ALGEBRA",
    level_1_1_1_instance: "1.1.1_STEP_LATENCY_SPIKE",
  }),
  /** Math — inverse sign / fraction class error (example from education spec). */
  mathInverseSign: buildGenealogicalBugIndex({
    level_1_category: "1.0_MATH",
    level_1_1_branch: "1.1_FRACTIONS",
    level_1_1_1_instance: "1.1.1_INVERSE_SIGN_ERROR",
  }),
  /** Science — lab conclusion mismatch. */
  scienceLogicGap: buildGenealogicalBugIndex({
    level_1_category: "1.0_SCIENCE",
    level_1_1_branch: "1.1_LAB_REPORT",
    level_1_1_1_instance: "1.1.1_CONCLUSION_MISMATCH",
  }),
  /** Socratic tutor — policy boundary (attempted direct answer). */
  tutorDirectAnswerAttempt: buildGenealogicalBugIndex({
    level_1_category: "1.0_TUTOR",
    level_1_1_branch: "1.1_SOCRATIC",
    level_1_1_1_instance: "1.1.1_DIRECT_ANSWER_BLOCKED",
  }),
  /** Flow inconsistent with prior assignment beats (P4 verify). */
  flowInconsistent: buildGenealogicalBugIndex({
    level_1_category: "1.0_COMPOSITION",
    level_1_1_branch: "1.1_FLOW",
    level_1_1_1_instance: "1.1.1_FLOW_INCONSISTENT",
  }),
  /**
   * Research — pasted research material with a citation anchor (Vault / positive index).
   * See pillars §2.6.1.
   */
  researchAnchoredSource: buildGenealogicalBugIndex({
    level_1_category: "3.0_RESEARCH",
    level_1_1_branch: "3.1_CITATIONS",
    level_1_1_1_instance: "3.1.1_ANCHORED_SOURCE_STRING",
  }),
  /**
   * Research — pasted research material WITHOUT citation anchor (Hall — Citation Hall Engine).
   * Triggered when Embedded Research Portal pastes are not accompanied by a "Generate Citation Anchor" click.
   */
  researchUnattributedSource: buildGenealogicalBugIndex({
    level_1_category: "3.0_RESEARCH",
    level_1_1_branch: "3.1_CITATIONS",
    level_1_1_1_instance: "3.1.2_UNATTRIBUTED_SOURCE_STRING",
  }),
  /**
   * Research — source domain not in trusted scholarly list (P6 domain_trust=low rollup).
   */
  researchUntrustedDomain: buildGenealogicalBugIndex({
    level_1_category: "3.0_RESEARCH",
    level_1_1_branch: "3.1_CITATIONS",
    level_1_1_1_instance: "3.1.3_UNTRUSTED_DOMAIN",
  }),
} as const;

export type LearningBreakdownKey = keyof typeof LEARNING_BREAKDOWN_INDEX;

export function learningBreakdownPath(key: LearningBreakdownKey): GenealogicalBugIndex {
  return LEARNING_BREAKDOWN_INDEX[key];
}

/**
 * Maps P4 flow-verify failure to a learning-breakdown index (cold layer metadata).
 */
export function breakdownIndexForFlowInconsistency(): GenealogicalBugIndex {
  return LEARNING_BREAKDOWN_INDEX.flowInconsistent;
}

export function breakdownIndexForPasteAnomaly(): GenealogicalBugIndex {
  return LEARNING_BREAKDOWN_INDEX.pasteWithoutKeystrokes;
}

/**
 * Citation Hall Engine — pasted research material classification.
 * - `hasAnchor=true`  → Vault (`3.1.1_ANCHORED_SOURCE_STRING`)
 * - `hasAnchor=false` → Hall (`3.1.2_UNATTRIBUTED_SOURCE_STRING`)
 */
export function breakdownIndexForCitation(hasAnchor: boolean): GenealogicalBugIndex {
  return hasAnchor
    ? LEARNING_BREAKDOWN_INDEX.researchAnchoredSource
    : LEARNING_BREAKDOWN_INDEX.researchUnattributedSource;
}

export function breakdownIndexForUntrustedDomain(): GenealogicalBugIndex {
  return LEARNING_BREAKDOWN_INDEX.researchUntrustedDomain;
}
