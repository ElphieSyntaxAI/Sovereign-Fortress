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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { classifyCodeDelta } from "../lib/services/converge-tier/classifier.ts";

describe("classifyCodeDelta", () => {
  test("markdown → TIER_1", () => {
    const r = classifyCodeDelta({
      paths: ["docs/README.md"],
      linesAdded: 2,
    });
    assert.equal(r.tier, "TIER_1");
    assert.ok(r.riskScore < 0.3);
  });

  test("feature path mid diff → TIER_2", () => {
    const r = classifyCodeDelta({
      paths: ["src/features/checkout/Card.tsx"],
      linesAdded: 40,
      linesModified: 10,
    });
    assert.equal(r.tier, "TIER_2");
  });

  test("auth path forces TIER_3", () => {
    const r = classifyCodeDelta({
      paths: ["src/auth/login.ts"],
      linesAdded: 2,
    });
    assert.equal(r.tier, "TIER_3");
    assert.ok(r.riskScore > 0.7);
  });

  test("company override forces tier", () => {
    const r = classifyCodeDelta(
      { paths: ["src/payment/handler.ts"], linesAdded: 1 },
      { pathOverrides: [{ pathGlob: "**/payment/**", forceTier: "TIER_3" }] }
    );
    assert.equal(r.tier, "TIER_3");
  });

  test("classifier completes under 5ms for 1k paths (soft budget)", () => {
    const paths = Array.from({ length: 1000 }, (_, i) => `src/pkg/file-${i}.ts`);
    const t0 = performance.now();
    const r = classifyCodeDelta({ paths, linesAdded: 5 });
    const elapsed = performance.now() - t0;
    assert.ok(r.tier);
    assert.ok(elapsed < 50, `expected <50ms got ${elapsed}ms`);
  });
});
