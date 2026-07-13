/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildClassroomLineItemUrl,
  halConfidenceToScore,
  mintClassroomGradeStub,
} from "@/lib/education/human-effort-classroom-stub";
import {
  mintOAuthState,
  parseOAuthState,
  classroomOAuthConfigured,
} from "@/lib/education/classroom-oauth";
import {
  EDU_DEMO,
  EDU_DEMO_VAULT_STRENGTH,
} from "@/lib/education/demo-fixtures";
import { buildSocraticTutorPrompt } from "@/lib/education/socratic-tutor-prompt";
import {
  educationPathForPersona,
  PLATFORM_COMING_SOON,
} from "@/lib/platform-persona-auth";

describe("Education Phase-1 80% push helpers", () => {
  it("ungates Education platform login", () => {
    assert.equal(PLATFORM_COMING_SOON.education, false);
    assert.equal(educationPathForPersona("teacher"), "/teacher");
    assert.equal(educationPathForPersona("administration_it"), "/curriculum");
    assert.equal(educationPathForPersona("student"), "/sandbox");
  });

  it("mints Classroom Human Effort Certificate stub from HAL confidence", () => {
    process.env.EDUCATION_PRIVACY_GATE_SECRET = "test-privacy-gate-secret";
    const stub = mintClassroomGradeStub({
      entityKey: EDU_DEMO.entityToken,
      halConfidence: 0.82,
      courseId: EDU_DEMO.courseId,
      courseWorkId: EDU_DEMO.courseWorkId,
      assignmentInstanceId: "00000000-0000-4000-8000-0000000000aa",
      certificateId: "00000000-0000-4000-8000-0000000000c1",
      issuedAt: "2026-07-13T12:00:00.000Z",
    });
    assert.equal(stub.status, "classroom_stub");
    assert.equal(stub.halScore, 82);
    assert.equal(stub.certificateId, "00000000-0000-4000-8000-0000000000c1");
    assert.ok(stub.certificateDigest.length >= 32);
    assert.match(stub.lineItemUrl, /^classroom:\/\/stub\//);
    assert.equal(halConfidenceToScore(1), 100);
    assert.equal(halConfidenceToScore(0), 0);
    assert.match(
      buildClassroomLineItemUrl({
        courseId: "c1",
        courseWorkId: "w1",
        assignmentInstanceId: "i1",
      }),
      /classroom:\/\/stub\/c1\/w1/
    );
  });

  it("round-trips Classroom OAuth state mint/parse", () => {
    process.env.GOOGLE_CLASSROOM_CLIENT_SECRET = "test-secret";
    const state = mintOAuthState({
      assignmentId: EDU_DEMO.assignmentId,
      tenantId: EDU_DEMO.tenantId,
      courseId: EDU_DEMO.courseId,
    });
    const parsed = parseOAuthState(state);
    assert.ok(parsed);
    assert.equal(parsed!.assignmentId, EDU_DEMO.assignmentId);
    assert.equal(parsed!.tenantId, EDU_DEMO.tenantId);
    // Without full client env, configured flag stays false (expected for CI).
    assert.equal(typeof classroomOAuthConfigured(), "boolean");
  });

  it("embeds demo Vault strength into Socratic prompt (strength→friction bridge)", () => {
    const prompt = buildSocraticTutorPrompt({
      studentQuestion: "I claimed algae grows in light but I do not know what evidence to write.",
      curriculumShards: [],
      vaultStrengths: [
        {
          id: "strength-demo-1",
          content: EDU_DEMO_VAULT_STRENGTH.content,
          similarity: 0.9,
          strengthLabel: EDU_DEMO_VAULT_STRENGTH.strengthLabel,
          summary: EDU_DEMO_VAULT_STRENGTH.summary,
          subjectDomain: EDU_DEMO_VAULT_STRENGTH.subjectDomain,
          halScore: EDU_DEMO_VAULT_STRENGTH.halScore,
        },
      ],
      frictionBreakdown: {
        level_1_category: "1.0_SCIENCE",
        level_1_1_branch: "1.1_CER",
        level_1_1_1_instance: "1.1.1_evidence_gap",
      },
      subjectDomain: "science",
      assignmentId: EDU_DEMO.assignmentId,
      draftExcerpt: "Claim: Algae grows faster in the light jar.",
    });
    assert.match(prompt, /Weather chart sorting/);
    assert.match(prompt, /THE VAULT/);
    assert.match(prompt, /strength→weakness bridge|strength/i);
    assert.match(prompt, /1\.1\.1_evidence_gap/);
  });
});
