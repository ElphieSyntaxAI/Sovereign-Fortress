/**
 * P2 — dev heal handoff unit tests.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  computeDevHandoff,
  DEV_HEAL_OCCURRENCE_THRESHOLD,
  recommendDevHealPath,
} from "../lib/dev-heal-config.js";

describe("dev-heal-config", () => {
  test("dev_cycle_required at threshold", () => {
    const h = computeDevHandoff({
      max_occurrence_count: DEV_HEAL_OCCURRENCE_THRESHOLD,
      incident_id: "00000000-0000-4000-8000-000000000001",
    });
    assert.equal(h.dev_cycle_required, true);
    assert.equal(h.threshold, DEV_HEAL_OCCURRENCE_THRESHOLD);
  });

  test("recommend self when dev cycle required", () => {
    const h = computeDevHandoff({ max_occurrence_count: 5 });
    assert.equal(recommendDevHealPath(h), "self");
  });

  test("recommend cloud below threshold", () => {
    const h = computeDevHandoff({ max_occurrence_count: 1 });
    assert.equal(recommendDevHealPath(h), "cloud");
  });
});
