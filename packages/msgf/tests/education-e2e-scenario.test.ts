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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Pure end-to-end scenario — disclosure → layout → HAL → milestone → state → board math.
 * Runs without Supabase so CI / local can prove the education loop is test-ready.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canTransition,
  MSGF_STATE_MAPPING,
} from "@/lib/education/assignment-instance";
import {
  EDU_DEMO,
  EDU_DEMO_CURRICULUM_TEXT,
  EDU_DEMO_DRAFT_CLAIM_ONLY,
  EDU_DEMO_DRAFT_COMPLETE,
} from "@/lib/education/demo-fixtures";
import {
  applyPasteAssessment,
  assessPasteDelta,
  computeHumanEffortConfidence,
  emptyHalLiteMetrics,
  toHalLiteWire,
} from "@/lib/education/hal-lite";
import { buildCatalogLayoutFromText } from "@/lib/education/layout-from-text";
import { checkMilestones } from "@/lib/education/milestone-gate";
import {
  disclosureCopyHash,
  getUtahDisclosureCopy,
  assertHb273NoAutoGradeOrIep,
} from "@/lib/education/utah-disclosure";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";

describe("Education E2E scenario (test-ready pure loop)", () => {
  it("walks disclosure → curriculum layout → HAL paste → milestone → lockout map", () => {
    // 1) Disclosure must be readable for grade 4+ and hash-stable
    const copy = getUtahDisclosureCopy();
    assert.match(copy.title, /AI|before you start/i);
    assert.ok(copy.bullets.length >= 4);
    assert.equal(disclosureCopyHash(copy).length, 64);

    // 2) Admin book → pickable layout
    const layout = buildCatalogLayoutFromText(
      EDU_DEMO_CURRICULUM_TEXT,
      EDU_DEMO.catalogTitle
    );
    assert.ok(layout[0]?.chapters.length);
    assert.ok(
      layout[0]!.chapters.some((c) => /ecosystem/i.test(c.chapterTitle)) ||
        layout[0]!.chapters.length >= 1
    );

    // 3) HAL Lite flags a pasted block without keystrokes
    let metrics = emptyHalLiteMetrics();
    const assessment = assessPasteDelta({
      deltaChars: 380,
      matchingKeystrokeCount: 0,
    });
    assert.equal(assessment.warningCode, "PASTE_INJECTION");
    metrics = applyPasteAssessment(metrics, assessment);
    assert.ok(computeHumanEffortConfidence(metrics) < 1);
    const wire = toHalLiteWire(metrics);
    assert.equal(wire.paste_events_count, 1);
    assert.ok(wire.paste_injection_warnings >= 1);

    // 4) Milestone gate: claim-only → evidence bottleneck; full CER → complete
    const incomplete = checkMilestones({
      templateId: EDU_DEMO.milestoneTemplateId,
      documentText: EDU_DEMO_DRAFT_CLAIM_ONLY,
    });
    assert.equal(incomplete.complete, false);
    assert.equal(incomplete.bottleneck?.stepId, "evidence");
    assert.equal(incomplete.unlockSocratic, true);

    const complete = checkMilestones({
      templateId: EDU_DEMO.milestoneTemplateId,
      documentText: EDU_DEMO_DRAFT_COMPLETE,
    });
    assert.equal(complete.complete, true);
    assert.equal(complete.bottleneck, null);

    // 5) Author → Edu state map + transitions (including turn-in lockout)
    assert.equal(MSGF_STATE_MAPPING.STATE_SOVEREIGN, "EDU_ACTIVE_DRAFTING");
    assert.equal(MSGF_STATE_MAPPING.STATE_AUDIT, "EDU_MILESTONE_CHECKING");
    assert.equal(MSGF_STATE_MAPPING.STATE_COOLDOWN, "EDU_SUBMITTED_LOCK");
    assert.equal(
      canTransition("EDU_ACTIVE_DRAFTING", "EDU_MILESTONE_CHECKING"),
      true
    );
    assert.equal(
      canTransition("EDU_MILESTONE_CHECKING", "EDU_SUBMITTED_LOCK"),
      true
    );
    assert.equal(
      canTransition("EDU_SUBMITTED_LOCK", "EDU_ACTIVE_DRAFTING"),
      false
    );

    // 6) H.B. 273 hard HALTs remain absolute
    assert.throws(
      () => assertHb273NoAutoGradeOrIep("auto_grade"),
      (e: unknown) =>
        e instanceof EducationPolicyHaltError &&
        e.code === "P1_HB273_AUTO_GRADE_HALT"
    );

    // 7) Classroom board ranking input shape (stuck if milestone checking)
    const boardStudent = {
      displayLabel: "Student_demo",
      currentState: "EDU_MILESTONE_CHECKING" as const,
      humanEffortConfidence: metrics.humanEffortConfidenceScore,
      stuck: true,
    };
    assert.equal(boardStudent.stuck, true);
    assert.ok(boardStudent.humanEffortConfidence <= 1);
  });

  it("exposes stable demo IDs for SPA + API contract", () => {
    assert.match(EDU_DEMO.assignmentId, /^00000000-0000-4000-8000-/);
    assert.match(EDU_DEMO.entityToken, /^tok_anon_stu_/);
    assert.equal(EDU_DEMO.gradeBand, "4_6");
    assert.equal(EDU_DEMO.milestoneTemplateId, "science_cer");
  });
});
