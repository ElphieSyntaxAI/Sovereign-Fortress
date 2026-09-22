import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  activeConsensusWidth,
  majorityFromCompletions,
} from "../lib/gateway/active-chat-majority.js";

describe("active chat majority", () => {
  test("shard-and-route stays one model", () => {
    assert.equal(
      activeConsensusWidth({
        aggressiveness: "shard-and-route",
        escalate: true,
        triEnabled: true,
        presetId: "tri_tribunal",
      }),
      1
    );
  });

  test("full-consensus uses dual unless the tenant preset is the tribunal", () => {
    assert.equal(
      activeConsensusWidth({
        aggressiveness: "full-consensus",
        escalate: true,
        triEnabled: false,
        presetId: "balanced_dual",
      }),
      2
    );
    assert.equal(
      activeConsensusWidth({
        aggressiveness: "full-consensus",
        escalate: true,
        triEnabled: true,
        presetId: "tri_tribunal",
      }),
      3
    );
    assert.equal(
      activeConsensusWidth({
        aggressiveness: "full-consensus",
        escalate: false,
        triEnabled: true,
        presetId: "tri_tribunal",
      }),
      1
    );
  });

  test("majority requires agreeing completions", () => {
    const agreed = majorityFromCompletions([
      "skip the duplicate call",
      "skip the duplicate call",
    ]);
    assert.equal(agreed.majority, true);
    const split = majorityFromCompletions([
      "approve the deploy",
      "reject the deploy and halt",
    ]);
    assert.equal(split.majority, false);
  });
});
