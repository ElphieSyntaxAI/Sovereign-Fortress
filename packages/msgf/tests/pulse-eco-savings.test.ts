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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { estimatePulseRoutingTokenSavings } from "../lib/services/pulse-eco-savings.js";

describe("pulse-eco-savings", () => {
  test("local_gateway yields positive savings vs naive", () => {
    const s = estimatePulseRoutingTokenSavings({
      routing: "local_gateway",
      contentChars: 400,
      keystrokeCount: 20,
    });
    assert.ok(s.tokens_saved > 0);
    assert.ok(s.with_msgf < s.without_msgf);
  });

  test("converge_bypass saves more than global_converge path", () => {
    const bypass = estimatePulseRoutingTokenSavings({
      routing: "converge_bypass",
      contentChars: 200,
    });
    const global = estimatePulseRoutingTokenSavings({
      routing: "global_converge",
      contentChars: 200,
    });
    assert.ok(bypass.tokens_saved >= global.tokens_saved);
  });
});

