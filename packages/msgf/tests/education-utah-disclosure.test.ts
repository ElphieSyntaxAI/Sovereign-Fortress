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
  disclosureCopyHash,
  getUtahDisclosureCopy,
} from "@/lib/education/utah-disclosure";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";
import { assertHb273NoAutoGradeOrIep } from "@/lib/education/utah-disclosure";

describe("Utah disclosure copy", () => {
  it("includes S.B. 149 and H.B. 273 language", () => {
    const copy = getUtahDisclosureCopy();
    assert.match(copy.summary, /S\.B\. 149/i);
    assert.ok(copy.bullets.length >= 3);
    assert.ok(copy.hb273Bullets.some((b) => /grade/i.test(b)));
    assert.ok(copy.hb273Bullets.some((b) => /IEP/i.test(b)));
    assert.equal(disclosureCopyHash(copy).length, 64);
  });

  it("H.B. 273 helpers always HALT", () => {
    assert.throws(
      () => assertHb273NoAutoGradeOrIep("auto_grade"),
      (e: unknown) =>
        e instanceof EducationPolicyHaltError &&
        e.code === "P1_HB273_AUTO_GRADE_HALT"
    );
    assert.throws(
      () => assertHb273NoAutoGradeOrIep("iep_mutate"),
      (e: unknown) =>
        e instanceof EducationPolicyHaltError &&
        e.code === "P1_HB273_IEP_MUTATE_HALT"
    );
  });
});
