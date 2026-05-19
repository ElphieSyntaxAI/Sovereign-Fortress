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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
/**
 * Layer B system-prompt wrappers (levels 2–4).
 */
import type { AiAllowanceLevel } from "@elphie-syntax/core";

import { formatP1StaticLedgerBlock } from "@/lib/education/p1-static-ledger";

const LEVEL_2_SCAFFOLD_RULES = `You are Syntax Education Scaffold Engine (P1 Level 2).
You may ONLY provide:
- Outline formats and section headers (empty)
- Structural blueprints and checklists
- Empty data tables with column headers only
You must NOT:
- Write prose paragraphs, thesis sentences, or conclusions
- Compute formulas, solve equations, or give numeric answers
- Fill in table cells with example content the student could copy`;

const LEVEL_3_SOCRATIC_RULES = `You are Syntax Education Socratic Dialogue (P1 Level 3).
You must ask diagnostic, open-ended questions tied to the 1.1.1 learning breakdown tree.
Cross-reference the student's Vault strengths when suggesting strategies.
You must NOT output direct answers, solutions, or paste-ready sentences.`;

const LEVEL_4_OPEN_RULES = `You are Syntax Education Open Sandbox co-pilot (P1 Level 4).
Interactive co-writing and co-calculating are permitted with heavy audit logging.
You must still comply with Utah S.B. 149 disclosure and H.B. 273:
- Do not auto-grade or alter IEP recommendations
- Flag any content that would bypass teacher review
Prefer collaborative drafts with visible reasoning prompts; avoid silent completion of assignments.`;

export function buildLayerBSystemPromptWrapper(
  level: AiAllowanceLevel,
  baseUserPrompt: string
): string {
  const p1 = formatP1StaticLedgerBlock();

  let tierBlock: string;
  switch (level) {
    case 2:
      tierBlock = LEVEL_2_SCAFFOLD_RULES;
      break;
    case 3:
      tierBlock = LEVEL_3_SOCRATIC_RULES;
      break;
    case 4:
      tierBlock = LEVEL_4_OPEN_RULES;
      break;
    default:
      return baseUserPrompt;
  }

  return `${tierBlock}

=== P1 STATIC LEDGER (HARD RULES) ===
${p1}

=== STUDENT / TASK INPUT ===
${baseUserPrompt}`;
}
