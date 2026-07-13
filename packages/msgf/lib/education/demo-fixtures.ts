/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Fixed demo fixtures for Syntax Education local / CI test readiness.
 * Deterministic IDs so SPA + API + docs can share one loop.
 */
export const EDU_DEMO = {
  tenantId: "syntax_education",
  assignmentId: "00000000-0000-4000-8000-0000000000ed",
  catalogId: "00000000-0000-4000-8000-0000000000ca",
  entityToken: "tok_anon_stu_demo4th01",
  googleSub: "demo-google-sub-grade4-001",
  courseId: "demo-course-4a",
  courseWorkId: "demo-coursework-lab01",
  gradeBand: "4_6" as const,
  subjectDomain: "science" as const,
  milestoneTemplateId: "science_cer" as const,
  title: "Grade 4 — Ecosystem Lab CER",
  catalogTitle: "Demo Science Workbook — Ecosystems (Grade 4)",
} as const;

export const EDU_DEMO_CURRICULUM_TEXT = `
Chapter 1: Ecosystems
Living things in a pond need light, water, and food.

Section 1.1 Algae and light
Algae are tiny living things. They use light to grow. Students observe jars in light and shade.

Section 1.2 Recording observations
Group notes by day. Write what you see without guessing the answer.

Chapter 2: Weather review
Remember last week's weather unit: you sorted cloudy vs sunny days before writing conclusions.
`.trim();

/** Incomplete CER (claim only) — should flag evidence bottleneck. */
export const EDU_DEMO_DRAFT_CLAIM_ONLY = `
Claim: Algae grows faster in the light jar than in the shade jar.
I think light helps living things grow.
`.trim();

/** Complete CER — milestone gate should pass. */
export const EDU_DEMO_DRAFT_COMPLETE = `
Claim: Algae grows faster in the light jar than in the shade jar.
Evidence: After three days the light jar had a green film; the shade jar stayed clear. Day 1 both looked the same; Day 3 light jar was thicker green.
Reasoning: Because algae uses light to make food, more light should mean more algae growth, matching our jars.
`.trim();

/**
 * Documented Vault strength from a prior science / weather unit —
 * used to prove strength→friction scaffolding in the Socratic tutor.
 */
export const EDU_DEMO_VAULT_STRENGTH = {
  strengthLabel: "Weather chart sorting",
  summary:
    "Last week you sorted cloudy vs sunny days into a table before writing a conclusion. You kept observations in columns and waited to explain why.",
  content:
    "Prior success: organized daily weather observations (cloudy vs sunny) into a clear table, then wrote conclusions after looking at patterns — not before.",
  subjectDomain: "science" as const,
  halScore: 88,
} as const;
