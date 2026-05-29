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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  applyConvergeShardableContextBudget,
  trimTextToTokenBudget,
} from "../lib/services/converge-context-budget.js";

describe("converge-context-budget", () => {
  test("trimTextToTokenBudget truncates long text", () => {
    const long = "x".repeat(10_000);
    const out = trimTextToTokenBudget(long, 100);
    assert.ok(out.length < long.length);
    assert.ok(out.includes("truncated"));
  });

  test("applyConvergeShardableContextBudget reduces oversized blocks", () => {
    const huge = "word ".repeat(8_000);
    const result = applyConvergeShardableContextBudget(
      {
        vaultCrossRefContext: huge,
        beatsContext: huge,
        p2FlowDirective: huge,
        defendConstraints: "keep defend short",
      },
      400
    );
    assert.equal(result.context_budget_applied, true);
    assert.ok(result.estimated_tokens_after <= result.estimated_tokens_before);
    assert.ok(result.estimated_tokens_after <= 450);
  });
});
