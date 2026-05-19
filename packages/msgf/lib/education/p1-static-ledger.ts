/**
 * P1 Static Ledger — Syntax Education hard rules (Utah + anti-cheating tutor policy).
 */
import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";

export type EducationAiAllowanceLevel = "L1_DICTIONARY" | "L2_SOCRATIC" | "L3_FORBIDDEN";

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

export function assertAiAllowanceForSocraticTutor(
  level: EducationAiAllowanceLevel | undefined
): void {
  const resolved = level ?? "L2_SOCRATIC";
  if (resolved === "L3_FORBIDDEN") {
    throw new EducationPolicyHaltError(
      "AI tutor is forbidden for this assignment (P1 AI Allowance L3).",
      "P1_AI_ALLOWANCE_L3_HALT"
    );
  }
  if (resolved === "L1_DICTIONARY") {
    throw new EducationPolicyHaltError(
      "This assignment allows dictionary-only support (L1). Socratic tutor is blocked.",
      "P1_AI_ALLOWANCE_L1_HALT"
    );
  }
}

export function formatP1StaticLedgerBlock(): string {
  return P1_SOCRATIC_STATIC_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");
}
