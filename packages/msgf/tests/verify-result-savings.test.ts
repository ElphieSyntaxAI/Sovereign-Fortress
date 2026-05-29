/**
 * Verify-result savings counter wiring.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildSavingsFeatureCatalog } from "../lib/services/savings-features-stats.js";

describe("verify-result savings dashboard", () => {
  test("savings catalog includes verify-result and run scripts features", () => {
    const catalog = buildSavingsFeatureCatalog();
    const verify = catalog.find((e) => e.id === "verify_result");
    const runScripts = catalog.find((e) => e.id === "run_scripts");
    assert.ok(verify);
    assert.ok(runScripts);
    assert.equal(verify.brain_tier, "small_brain");
    assert.equal(runScripts.brain_tier, "small_brain");
  });
});
