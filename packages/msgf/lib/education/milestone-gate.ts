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
 * Structural Milestone Gate — Author Bicameral Audit → Education vector.
 * Light template parser (CER / ELA outline / explain-solution) before Socratic unlock.
 */
import { z } from "zod";

import { LEARNING_BREAKDOWN_INDEX } from "@/lib/education/learning-breakdown-index";
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";

export const MilestoneTemplateIdSchema = z.enum([
  "science_cer",
  "ela_outline",
  "explain_solution",
  "lab_report",
  "generic_sections",
]);
export type MilestoneTemplateId = z.infer<typeof MilestoneTemplateIdSchema>;

export type MilestoneStepDef = {
  id: string;
  label: string;
  /** Case-insensitive heading / cue patterns that mark the section. */
  cues: string[];
  /** Minimum chars under the section before it counts as filled. */
  minBodyChars: number;
};

export type MilestoneCheckResult = {
  templateId: MilestoneTemplateId;
  complete: boolean;
  /** Steps still missing or under-filled — Socratic may target these. */
  incompleteSteps: Array<{ id: string; label: string }>;
  /** When a known friction pattern is detected (e.g. claim without evidence). */
  bottleneck: {
    stepId: string;
    label: string;
    breakdown: GenealogicalBugIndex;
  } | null;
  /** True when Socratic deepen is allowed (structure present enough). */
  unlockSocratic: boolean;
};

const SCIENCE_CER: MilestoneStepDef[] = [
  {
    id: "claim",
    label: "Claim",
    cues: ["claim", "i claim", "hypothesis"],
    minBodyChars: 20,
  },
  {
    id: "evidence",
    label: "Evidence",
    cues: ["evidence", "data", "observations", "results"],
    minBodyChars: 40,
  },
  {
    id: "reasoning",
    label: "Reasoning",
    cues: ["reasoning", "because", "this shows", "therefore"],
    minBodyChars: 40,
  },
];

const ELA_OUTLINE: MilestoneStepDef[] = [
  {
    id: "hook",
    label: "Hook / Intro",
    cues: ["introduction", "hook", "thesis"],
    minBodyChars: 30,
  },
  {
    id: "body",
    label: "Body",
    cues: ["body", "paragraph", "support", "example"],
    minBodyChars: 60,
  },
  {
    id: "conclusion",
    label: "Conclusion",
    cues: ["conclusion", "in conclusion", "finally"],
    minBodyChars: 25,
  },
];

const EXPLAIN_SOLUTION: MilestoneStepDef[] = [
  {
    id: "given",
    label: "What I know",
    cues: ["given", "what i know", "problem"],
    minBodyChars: 15,
  },
  {
    id: "steps",
    label: "My steps",
    cues: ["steps", "step 1", "first", "next"],
    minBodyChars: 30,
  },
  {
    id: "answer",
    label: "Answer / check",
    cues: ["answer", "check", "therefore", "so"],
    minBodyChars: 10,
  },
];

const LAB_REPORT: MilestoneStepDef[] = [
  {
    id: "purpose",
    label: "Purpose",
    cues: ["purpose", "question", "objective"],
    minBodyChars: 20,
  },
  {
    id: "method",
    label: "Method",
    cues: ["method", "procedure", "materials"],
    minBodyChars: 30,
  },
  {
    id: "results",
    label: "Results",
    cues: ["results", "data", "observations"],
    minBodyChars: 30,
  },
  {
    id: "conclusion",
    label: "Conclusion",
    cues: ["conclusion", "discussion"],
    minBodyChars: 25,
  },
];

export function milestoneStepsFor(
  templateId: MilestoneTemplateId
): MilestoneStepDef[] {
  switch (templateId) {
    case "science_cer":
      return SCIENCE_CER;
    case "ela_outline":
      return ELA_OUTLINE;
    case "explain_solution":
      return EXPLAIN_SOLUTION;
    case "lab_report":
      return LAB_REPORT;
    case "generic_sections":
      return [
        {
          id: "section_a",
          label: "Section 1",
          cues: ["section 1", "part 1"],
          minBodyChars: 20,
        },
        {
          id: "section_b",
          label: "Section 2",
          cues: ["section 2", "part 2"],
          minBodyChars: 20,
        },
      ];
  }
}

function normalizeDoc(text: string): string {
  return text.replace(/\r\n/g, "\n").toLowerCase();
}

function sectionFilled(
  doc: string,
  step: MilestoneStepDef,
  nextCueStarts: number[]
): boolean {
  let bestIdx = -1;
  for (const cue of step.cues) {
    const idx = doc.indexOf(cue.toLowerCase());
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx < 0) return false;

  const endCandidates = nextCueStarts.filter((n) => n > bestIdx);
  const end = endCandidates.length ? Math.min(...endCandidates) : doc.length;
  const body = doc.slice(bestIdx, end).trim();
  return body.length >= step.minBodyChars;
}

function cuePositions(doc: string, steps: MilestoneStepDef[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const step of steps) {
    let best = -1;
    for (const cue of step.cues) {
      const idx = doc.indexOf(cue.toLowerCase());
      if (idx >= 0 && (best < 0 || idx < best)) best = idx;
    }
    if (best >= 0) map.set(step.id, best);
  }
  return map;
}

function bottleneckFor(
  templateId: MilestoneTemplateId,
  incomplete: Array<{ id: string; label: string }>,
  filledIds: Set<string>
): MilestoneCheckResult["bottleneck"] {
  if (templateId === "science_cer" || templateId === "lab_report") {
    if (filledIds.has("claim") && incomplete.some((s) => s.id === "evidence")) {
      return {
        stepId: "evidence",
        label: "Evidence",
        breakdown: LEARNING_BREAKDOWN_INDEX.scienceLogicGap,
      };
    }
  }
  if (templateId === "ela_outline" && incomplete.some((s) => s.id === "hook")) {
    return {
      stepId: "hook",
      label: "Hook / Intro",
      breakdown: LEARNING_BREAKDOWN_INDEX.elaOutlineFriction,
    };
  }
  if (incomplete.length === 0) return null;
  const first = incomplete[0]!;
  return {
    stepId: first.id,
    label: first.label,
    breakdown:
      templateId === "explain_solution"
        ? LEARNING_BREAKDOWN_INDEX.mathStepLatency
        : LEARNING_BREAKDOWN_INDEX.flowInconsistent,
  };
}

/**
 * Parse student document text against a milestone template.
 * Unlock Socratic once ≥1 structural cue is present (scaffolding), but expose
 * bottleneck for strength-based prompts when key steps are missing.
 */
export function checkMilestones(input: {
  templateId: MilestoneTemplateId;
  documentText: string;
  /** Require all steps before unlock (strict). Default: unlock after any step cue. */
  strictUnlock?: boolean;
}): MilestoneCheckResult {
  const steps = milestoneStepsFor(input.templateId);
  const doc = normalizeDoc(input.documentText ?? "");
  const positions = cuePositions(doc, steps);
  const allStarts = [...positions.values()];

  const incompleteSteps: Array<{ id: string; label: string }> = [];
  const filledIds = new Set<string>();

  for (const step of steps) {
    const others = allStarts.filter((p) => p !== positions.get(step.id));
    if (sectionFilled(doc, step, others)) {
      filledIds.add(step.id);
    } else {
      incompleteSteps.push({ id: step.id, label: step.label });
    }
  }

  const complete = incompleteSteps.length === 0;
  const unlockSocratic = input.strictUnlock
    ? complete
    : filledIds.size > 0 || doc.trim().length >= 80;

  return {
    templateId: input.templateId,
    complete,
    incompleteSteps,
    bottleneck: bottleneckFor(input.templateId, incompleteSteps, filledIds),
    unlockSocratic,
  };
}
