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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Credit reservation — heal-queue reserve amounts.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  resolveHealCreditReserveAmount,
  shouldReserveForHealAction,
} from "../lib/credit-reservation.js";

describe("credit-heal-reservation", () => {
  test("BULK reserves more than DEV_CYCLE_START", () => {
    const bulk = resolveHealCreditReserveAmount({
      action_type: "BULK",
      taskCount: 5,
    });
    const dev = resolveHealCreditReserveAmount({ action_type: "DEV_CYCLE_START" });
    assert.ok(bulk > dev);
  });

  test("shouldReserveForHealAction covers cloud heals only when enabled", () => {
    const prev = process.env.MSGF_CREDIT_RESERVATION_ENABLED;
    process.env.MSGF_CREDIT_RESERVATION_ENABLED = "1";
    try {
      assert.equal(shouldReserveForHealAction("BULK"), true);
      assert.equal(shouldReserveForHealAction("INDIVIDUAL"), true);
      assert.equal(shouldReserveForHealAction("DEV_CYCLE_START"), false);
      assert.equal(shouldReserveForHealAction("SCHEDULED"), false);
    } finally {
      if (prev === undefined) delete process.env.MSGF_CREDIT_RESERVATION_ENABLED;
      else process.env.MSGF_CREDIT_RESERVATION_ENABLED = prev;
    }
  });
});
