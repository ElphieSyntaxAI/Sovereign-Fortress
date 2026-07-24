/**
 * @msgf-license-header
 * Part B5 — tier escalation ladder tests (mocked providers).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  runTieredConverge,
  type TierConvergeProvider,
} from "../lib/services/converge-tier/converge-runner.ts";
import { assertNoRawKeysInLog, scrubConvergeLogText } from "../lib/services/converge-tier/scrubber.ts";

describe("converge-tier escalation", () => {
  test("T1 agree stops without escalation", async () => {
    const provider: TierConvergeProvider = {
      callModel: async () =>
        '{"verdict":"HUMAN","reason":"ok"} identical human verdict text here',
    };
    const r = await runTieredConverge({
      startTier: "TIER_1",
      prompt: "test",
      tenantId: "tenant-1",
      provider,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.finalTier, "TIER_1");
      assert.equal(r.escalated, false);
    }
  });

  test("T1 disagree escalates to T3 when all disagree", async () => {
    let calls = 0;
    const provider: TierConvergeProvider = {
      callModel: async () => {
        calls += 1;
        return calls % 2 === 1
          ? "alpha totally different content"
          : "beta unrelated output";
      },
    };
    const r = await runTieredConverge({
      startTier: "TIER_1",
      prompt: "test",
      tenantId: "tenant-2",
      provider,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.hitlRequired, true);
      assert.equal(r.finalTier, "TIER_3");
      assert.equal(r.quarantineRecommended, true);
      assert.ok(r.attempts.length >= 1);
    }
    assert.ok(calls >= 2);
  });

  test("scrubber removes sk- patterns", () => {
    const raw = "failed with sk-abcdefghijklmnopqrstuvwxyz1234567890";
    const scrubbed = scrubConvergeLogText(raw);
    assert.equal(assertNoRawKeysInLog(scrubbed), true);
    assert.ok(scrubbed.includes("[REDACTED_KEY]"));
  });
});
