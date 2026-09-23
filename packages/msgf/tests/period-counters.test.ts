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
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isoWeekPeriodKey,
  monthPeriodKey,
  previousIsoWeekKeys,
  previousMonthKeys,
} from "../lib/services/period-counters.js";

describe("period-counters keys", () => {
  test("iso week and month keys are stable formats", () => {
    const d = new Date("2026-08-05T18:00:00.000Z");
    assert.match(isoWeekPeriodKey(d), /^\d{4}-W\d{2}$/);
    assert.equal(monthPeriodKey(d), "2026-08");
  });

  test("previous weeks returns 3 unique keys", () => {
    const keys = previousIsoWeekKeys(3, new Date("2026-08-05T12:00:00.000Z"));
    assert.equal(keys.length, 3);
    assert.equal(new Set(keys).size, 3);
  });

  test("previous months returns descending history", () => {
    const keys = previousMonthKeys(3, new Date("2026-08-05T12:00:00.000Z"));
    assert.deepEqual(keys, ["2026-08", "2026-07", "2026-06"]);
  });
});
