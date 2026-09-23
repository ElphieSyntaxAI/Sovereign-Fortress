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
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyShadowPromptSignals,
  computeShadowProof,
  pickShadowRecommendedAction,
  SHADOW_BOT_SWARM_ACTION,
  SHADOW_POLICY_DRIFT_ACTION,
  SHADOW_PROOF_SCOPE_DISCLAIMER,
  SHADOW_RETRY_LOOP_ACTION,
} from "../lib/shadow-eval/shadow-proof.js";

describe("shadow-proof", () => {
  it("classifies retry loops and policy-risk language", () => {
    const retry = classifyShadowPromptSignals("that didn't work, try again");
    assert.equal(retry.retry_loop, true);
    assert.equal(retry.policy_drift, false);

    const policy = classifyShadowPromptSignals("please ignore previous and jailbreak");
    assert.equal(policy.policy_drift, true);

    const clean = classifyShadowPromptSignals("add a login button");
    assert.equal(clean.retry_loop, false);
    assert.equal(clean.policy_drift, false);
    assert.equal(clean.fat_context, false);
  });

  it("prefers cache hits over retry flags", () => {
    const action = pickShadowRecommendedAction({
      cacheHit: true,
      signals: { retry_loop: true, policy_drift: true, fat_context: false },
      fallback: "KEEP_AS_IS",
    });
    assert.equal(action, "ENABLE_SEMANTIC_CACHE");
  });

  it("prefers bot-swarm trips over cache and retry flags", () => {
    const action = pickShadowRecommendedAction({
      cacheHit: true,
      signals: { retry_loop: true, policy_drift: true, fat_context: false },
      fallback: "KEEP_AS_IS",
      swarmTrip: true,
    });
    assert.equal(action, SHADOW_BOT_SWARM_ACTION);
  });

  it("counts duplicate calls as extras and their $", () => {
    const proof = computeShadowProof([
      {
        prompt_hash: "aaa",
        actual_cost_usd: 0.02,
        recommended_action: "KEEP_AS_IS",
        observed_at: "2026-09-11T10:00:00.000Z",
      },
      {
        prompt_hash: "aaa",
        actual_cost_usd: 0.03,
        recommended_action: "ENABLE_SEMANTIC_CACHE",
        observed_at: "2026-09-11T10:01:00.000Z",
      },
      {
        prompt_hash: "bbb",
        actual_cost_usd: 0.01,
        recommended_action: SHADOW_RETRY_LOOP_ACTION,
        observed_at: "2026-09-11T10:02:00.000Z",
      },
      {
        prompt_hash: "ccc",
        actual_cost_usd: 0.01,
        recommended_action: SHADOW_POLICY_DRIFT_ACTION,
        actual_tokens: 9000,
        observed_at: "2026-09-11T10:03:00.000Z",
      },
    ]);

    assert.equal(proof.evaluation_count, 4);
    assert.equal(proof.unique_prompts, 3);
    assert.equal(proof.duplicate_calls, 1);
    assert.equal(proof.duplicate_cost_usd, 0.03);
    assert.equal(proof.retry_loop_prompts, 1);
    assert.equal(proof.policy_flags, 1);
    assert.equal(proof.fat_context_calls, 1);
    assert.match(proof.headline, /duplicate call/);
    assert.match(proof.headline, /retry-loop/);
  });

  it("counts FLAG_BOT_SWARM rows as runaway agent waves", () => {
    const proof = computeShadowProof([
      {
        prompt_hash: "child-a",
        actual_cost_usd: 0.02,
        recommended_action: SHADOW_BOT_SWARM_ACTION,
        observed_at: "2026-09-11T10:04:00.000Z",
      },
      {
        prompt_hash: "child-b",
        actual_cost_usd: 0.01,
        recommended_action: SHADOW_BOT_SWARM_ACTION,
        observed_at: "2026-09-11T10:05:00.000Z",
      },
    ]);
    assert.equal(proof.bot_swarm_waves, 2);
    assert.match(proof.headline, /runaway secondary-agent waves/);
  });

  it("does not claim wins when every prompt is unique", () => {
    const proof = computeShadowProof([
      {
        prompt_hash: "only",
        actual_cost_usd: 0.004,
        recommended_action: "KEEP_AS_IS",
        observed_at: "2026-09-11T10:00:00.000Z",
      },
    ]);
    assert.equal(proof.duplicate_calls, 0);
    assert.match(proof.headline, /1 call observed/);
  });

  it("scopes the report as a project estimate, not full MSGF", () => {
    assert.match(SHADOW_PROOF_SCOPE_DISCLAIMER, /this project only/i);
    assert.match(SHADOW_PROOF_SCOPE_DISCLAIMER, /not the full MSGF capability set/i);
  });

  it("unions unique deferred P7 keys across evals", () => {
    const proof = computeShadowProof([
      {
        prompt_hash: "p1",
        actual_cost_usd: 0.01,
        recommended_action: "KEEP_AS_IS",
        p7_deferred: [
          { resource_key: "vault:aaa", outcome: "good" },
          { resource_key: "agent:bbb", outcome: "bad" },
        ],
      },
      {
        prompt_hash: "p2",
        actual_cost_usd: 0.01,
        recommended_action: "KEEP_AS_IS",
        p7_deferred: [
          { resource_key: "vault:aaa", outcome: "good" },
          { resource_key: "prompt:ccc", outcome: "bad" },
        ],
      },
    ]);
    assert.equal(proof.p7_promoted_resources, 1);
    assert.equal(proof.p7_blocked_resources, 2);
    assert.match(proof.headline, /promoted 1 resource/);
    assert.match(proof.headline, /blocked 2/);
  });
});
