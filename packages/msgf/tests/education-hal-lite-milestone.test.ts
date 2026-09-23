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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyPasteAssessment,
  assessPasteDelta,
  computeHumanEffortConfidence,
  emptyHalLiteMetrics,
} from "@/lib/education/hal-lite";
import { checkMilestones } from "@/lib/education/milestone-gate";
import {
  canTransition,
  MSGF_STATE_MAPPING,
} from "@/lib/education/assignment-instance";

describe("HAL Lite", () => {
  it("flags large paste without keystrokes as PASTE_INJECTION", () => {
    const a = assessPasteDelta({ deltaChars: 400, matchingKeystrokeCount: 0 });
    assert.equal(a.isPasteInjection, true);
    assert.equal(a.warningCode, "PASTE_INJECTION");
  });

  it("allows normal typed growth", () => {
    const a = assessPasteDelta({ deltaChars: 40, matchingKeystrokeCount: 35 });
    assert.equal(a.isPasteInjection, false);
  });

  it("depresses confidence after injection warnings", () => {
    let m = emptyHalLiteMetrics();
    m = applyPasteAssessment(
      m,
      assessPasteDelta({ deltaChars: 500, matchingKeystrokeCount: 0 })
    );
    assert.equal(m.pasteInjectionWarnings, 1);
    assert.ok(computeHumanEffortConfidence(m) < 1);
  });
});

describe("Milestone Gate", () => {
  it("detects claim-without-evidence bottleneck for science_cer", () => {
    const result = checkMilestones({
      templateId: "science_cer",
      documentText: `
        Claim: Algae grows faster in light.
        I think light helps plants.
      `,
    });
    assert.equal(result.complete, false);
    assert.equal(result.bottleneck?.stepId, "evidence");
    assert.equal(result.unlockSocratic, true);
  });

  it("marks CER complete when all sections filled", () => {
    const result = checkMilestones({
      templateId: "science_cer",
      documentText: `
        Claim: Algae grows faster under bright light than shade.
        Evidence: Day 1 shade flasks had 2g; light flasks had 5g after three days of data.
        Reasoning: Because light drives photosynthesis, more light produced more algae biomass.
      `,
    });
    assert.equal(result.complete, true);
    assert.equal(result.bottleneck, null);
  });
});

describe("Assignment state mapping", () => {
  it("maps Author SSoT states to education vectors", () => {
    assert.equal(MSGF_STATE_MAPPING.STATE_SOVEREIGN, "EDU_ACTIVE_DRAFTING");
    assert.equal(MSGF_STATE_MAPPING.STATE_AUDIT, "EDU_MILESTONE_CHECKING");
    assert.equal(MSGF_STATE_MAPPING.STATE_COOLDOWN, "EDU_SUBMITTED_LOCK");
  });

  it("blocks transitions out of turn-in lockout", () => {
    assert.equal(canTransition("EDU_SUBMITTED_LOCK", "EDU_ACTIVE_DRAFTING"), false);
    assert.equal(canTransition("EDU_ACTIVE_DRAFTING", "EDU_MILESTONE_CHECKING"), true);
  });
});
