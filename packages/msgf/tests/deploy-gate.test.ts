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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  evaluateDeployGateFromVerify,
} from "../lib/services/deploy-gate.ts";

describe("deploy-gate", () => {
  const now = Date.parse("2026-07-24T12:00:00.000Z");

  test("missing verify → not ok", () => {
    const d = evaluateDeployGateFromVerify({
      projectOrigin: "starmap",
      passed: null,
      createdAt: null,
      nowMs: now,
    });
    assert.equal(d.ok, false);
    assert.equal(d.status, "missing");
  });

  test("passed within window → green", () => {
    const d = evaluateDeployGateFromVerify({
      projectOrigin: "starmap",
      passed: true,
      createdAt: "2026-07-24T10:00:00.000Z",
      maxAgeHours: 72,
      nowMs: now,
      narrativeLogId: "n1",
    });
    assert.equal(d.ok, true);
    assert.equal(d.status, "green");
    assert.equal(d.narrative_log_id, "n1");
  });

  test("failed verify → red", () => {
    const d = evaluateDeployGateFromVerify({
      projectOrigin: "starport",
      passed: false,
      createdAt: "2026-07-24T11:00:00.000Z",
      nowMs: now,
    });
    assert.equal(d.ok, false);
    assert.equal(d.status, "red");
  });

  test("old pass → stale", () => {
    const d = evaluateDeployGateFromVerify({
      projectOrigin: "devlish",
      passed: true,
      createdAt: "2026-07-01T12:00:00.000Z",
      maxAgeHours: 72,
      nowMs: now,
    });
    assert.equal(d.ok, false);
    assert.equal(d.status, "stale");
  });
});
