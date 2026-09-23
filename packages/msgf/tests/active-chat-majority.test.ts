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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
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
