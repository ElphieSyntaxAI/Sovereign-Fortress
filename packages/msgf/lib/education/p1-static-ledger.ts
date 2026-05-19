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
 * Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
 */
/**
 * P1 Static Ledger — Syntax Education hard rules (Utah + layered workspace §2.1.2).
 */
import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import {
  normalizeAiAllowanceLevel,
  resolveLayerBFlags,
  type AiAllowanceLevel,
} from "@elphie-syntax/core";

export type { AiAllowanceLevel };

/** @deprecated Use numeric {@link AiAllowanceLevel} 0–4. */
export type EducationAiAllowanceLevel =
  | "L1_DICTIONARY"
  | "L2_SOCRATIC"
  | "L3_FORBIDDEN";

export class EducationPolicyHaltError extends Error {
  override readonly name = "EducationPolicyHaltError";
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

/** Pillar 1 — non-negotiable tutor output prohibitions (masterdoc §3.2). */
export const P1_SOCRATIC_STATIC_RULES = [
  "You are absolutely barred from outputting direct answers, numerical solutions, proofs, or pre-written sentences the student could paste into their assignment.",
  "You may not write completed thesis statements, body paragraphs, introductions, conclusions, or full sentences that could be submitted as final work.",
  "You may not provide code, equations solved end-to-end, or step-by-step answers that remove the student's reasoning burden.",
  "You may only use district curriculum excerpts provided in CONTEXT — do not invent facts, quotes, or page references outside that corpus.",
  "If the student requests a direct answer, refuse politely and redirect with scaffold questions tied to their documented strengths.",
  `Legal attestation version in force: ${CURRENT_LEGAL_VERSION}. Utah S.B. 149 disclosure must have been shown before this session.`,
] as const;

export function assertAiAllowanceForLlmOrchestration(
  level: AiAllowanceLevel | unknown
): void {
  const resolved = normalizeAiAllowanceLevel(level, 3);
  const flags = resolveLayerBFlags(resolved);

  if (flags.bypassLlmOrchestration) {
    throw new EducationPolicyHaltError(
      resolved === 0
        ? "AI is disabled for this assignment (Level 0 Absolute Zero). Telemetry-only mode."
        : "AI chat is locked (Level 1 Resource Gate). Use grade-appropriate local tools only.",
      resolved === 0 ? "P1_AI_ALLOWANCE_L0_HALT" : "P1_AI_ALLOWANCE_L1_HALT"
    );
  }
}

/** Level 3+ Socratic endpoints. */
export function assertAiAllowanceForSocraticTutor(
  level: AiAllowanceLevel | unknown
): void {
  const resolved = normalizeAiAllowanceLevel(level, 3);
  assertAiAllowanceForLlmOrchestration(resolved);
  if (resolved < 3) {
    throw new EducationPolicyHaltError(
      `Socratic tutor requires AI allowance Level 3 or higher (current: ${resolved}).`,
      "P1_AI_ALLOWANCE_SOCRATIC_LEVEL_HALT"
    );
  }
}

/** @deprecated Use {@link assertAiAllowanceForLlmOrchestration}. */
export function assertAiAllowanceForSocraticTutorLegacy(
  level: EducationAiAllowanceLevel | undefined
): void {
  assertAiAllowanceForSocraticTutor(level);
}

export function formatP1StaticLedgerBlock(): string {
  return P1_SOCRATIC_STATIC_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");
}
