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
/**
 * Token savings estimate helpers (Author HAL chunk vs MSGF routing).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  compareTokenUsage,
  estimateMsgfRoutedTokens,
  estimateNaiveUngatedTokens,
  routingFromPulseResponse,
} from "../lib/services/token-usage-estimate.js";

describe("token-usage-estimate", () => {
  test("naive baseline exceeds local gateway for routine content", () => {
    const before = estimateNaiveUngatedTokens({
      contentChars: 200,
      keystrokeCount: 40,
      packetCount: 1,
    });
    const after = estimateMsgfRoutedTokens({
      contentChars: 200,
      keystrokeCount: 40,
      packetCount: 1,
      routing: "local_gateway",
    });
    const cmp = compareTokenUsage(before, after);
    assert.ok(cmp.tokens_saved > 0);
    assert.ok(cmp.savings_pct > 0);
  });

  test("routingFromPulseResponse reads BFF wrapper", () => {
    assert.equal(
      routingFromPulseResponse({
        ok: true,
        msgf_pulse: { routing: "local_gateway", data: { routing: "local_gateway" } },
      }),
      "local_gateway"
    );
  });

  test("global converge after estimate is positive", () => {
    const naive = estimateNaiveUngatedTokens({ contentChars: 500, packetCount: 2 });
    const routed = estimateMsgfRoutedTokens({
      contentChars: 500,
      packetCount: 2,
      routing: "global_converge",
    });
    assert.ok(routed.tokens > 0);
    assert.ok(naive.tokens >= routed.tokens * 0.8);
  });
});
