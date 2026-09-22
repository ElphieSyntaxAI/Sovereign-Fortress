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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildConvergeCacheDigest,
  buildConvergeCacheRedisKey,
  buildConvergeResolutionString,
  computeConvergeAgreementScore,
  computeConvergeContentHash,
  CONVERGE_CACHE_TTL_SECONDS,
  estimateCoreConvergeTokenBaseline,
  resolveConvergeRoutingProfile,
} from "../lib/services/converge-cache.js";

describe("converge-cache", () => {
  test("cache digest is deterministic for same matrix inputs", () => {
    const a = buildConvergeCacheDigest("tenant-a", "content-hash-1", "global_converge:byok:gemini");
    const b = buildConvergeCacheDigest("tenant-a", "content-hash-1", "global_converge:byok:gemini");
    const c = buildConvergeCacheDigest("tenant-a", "content-hash-2", "global_converge:byok:gemini");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(a.length, 64);
  });

  test("redis key uses msgf converge namespace", () => {
    const key = buildConvergeCacheRedisKey("t1", "abc", "global_converge:corp:model");
    assert.ok(key.startsWith("msgf:converge:cache:"));
  });

  test("content hash changes when pulse text changes", () => {
    const h1 = computeConvergeContentHash({ pulseText: "alpha" });
    const h2 = computeConvergeContentHash({ pulseText: "beta" });
    assert.notEqual(h1, h2);
  });

  test("routing profile encodes credential mode and model", () => {
    const p = resolveConvergeRoutingProfile("individual_perpetual_platform", "gemini-2.5-pro");
    assert.ok(p.includes("individual_perpetual_platform"));
    assert.ok(p.includes("gemini-2.5-pro"));
  });

  test("agreement score is high when chunk verdicts align", () => {
    const chunks = [
      {
        gemini: { verdict: "HUMAN", reason: "Routine edit aligns with roadmap" },
        claude: { verdict: "HUMAN", reason: "Routine edit aligns with roadmap" },
        agreement: true,
        decision: "HUMAN_CONFIRMED",
        halScore: 100,
      },
    ];
    const score = computeConvergeAgreementScore(chunks);
    assert.ok(score >= 0.8);
    const resolution = buildConvergeResolutionString(chunks);
    assert.ok(resolution.includes("HUMAN"));
  });

  test("P4 TTL default is 600 seconds", () => {
    assert.equal(CONVERGE_CACHE_TTL_SECONDS, 600);
  });

  test("core token baseline uses naive dual converge debit", () => {
    assert.ok(estimateCoreConvergeTokenBaseline(2) > estimateCoreConvergeTokenBaseline(1));
  });
});
