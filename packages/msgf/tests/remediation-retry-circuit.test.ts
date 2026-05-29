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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * Remediation retry circuit breaker unit tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { MAX_RECURSION_DEPTH } from "../lib/services/cost-runaway-guard";
import {
  REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS,
  remediationAttemptKey,
  isCircuitBreakerTripped,
  assertRemediationSchedulable,
  REMEDIATION_STATE,
} from "../lib/services/remediation-retry-circuit";
import { buildGenealogicalBugIndex } from "../lib/schemas/vault-hall-metadata";

describe("remediation-retry-circuit", () => {
  test("max attempts aligned with LOM recursion depth", () => {
    assert.equal(REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS, MAX_RECURSION_DEPTH);
    assert.equal(REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS, 3);
  });

  test("attempt key uses file_path and 1.1.1 instance", () => {
    const bug = buildGenealogicalBugIndex({
      level_1_category: "1.0_PULSE",
      level_1_1_branch: "1.1_CONVERGE",
      level_1_1_1_instance: "1.1.1_CONSENSUS_REJECT",
    });
    const key = remediationAttemptKey("src/app/page.tsx", bug);
    assert.equal(key.file_path, "src/app/page.tsx");
    assert.equal(key.bug_index_instance, "1.1.1_CONSENSUS_REJECT");
  });

  test("circuit breaker blocks scheduling", () => {
    assert.equal(isCircuitBreakerTripped(REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION), true);
    assert.throws(
      () =>
        assertRemediationSchedulable(
          REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
          "src/foo.ts"
        ),
      /PENDING_HUMAN_ARBITRATION/
    );
  });
});
