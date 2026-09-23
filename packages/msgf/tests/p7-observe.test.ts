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
import { describe, test } from "node:test";

import {
  decayReputationCounts,
  resourceKeyForFile,
  resourceKeyForMandateHash,
  resourceKeyForPromptHash,
} from "../lib/schemas/source-audit.ts";
import { hitsForReputationOutcome, p7AuditKeyLists } from "../lib/services/source-audit.ts";
import { auditEventMatchesQuery } from "../lib/services/emit-platform-audit.ts";
import {
  hitFromPromptHash,
  hitsFromDeferredP7,
  isLiveP7Tenant,
  p7SteerHint,
  swarmDetectedP7Hits,
} from "../lib/services/p7-observe.ts";
import { omitPrunedContextTasks } from "../lib/services/agent-context-service.ts";
import { RemediationTaskSchema } from "../lib/schemas/heal-queue.ts";
import type { SourceHit } from "../lib/schemas/source-audit.ts";

const prunedHit: SourceHit = {
  kind: "agent",
  ledger: "agent",
  resource_key: "agent:deadbeef",
  score: 0.2,
  attribution_class: "untrusted_external",
  pruned: true,
};

const vaultHit: SourceHit = {
  kind: "vault",
  ledger: "vault",
  resource_key: "vault:good",
  score: 0.8,
  attribution_class: "unknown",
};

describe("p7 observe / decay / steer", () => {
  test("prompt hash keys are hash-only", () => {
    const hex = "a".repeat(64);
    assert.equal(resourceKeyForPromptHash(hex), `prompt:${hex}`);
    const hit = hitFromPromptHash(hex);
    assert.equal(hit?.kind, "prompt");
    assert.equal(hit?.resource_key, `prompt:${hex}`);
    assert.equal(hit?.content_hash, hex);
  });

  test("live P7 writes skip system and global tenant fallbacks", () => {
    assert.equal(isLiveP7Tenant("acme"), true);
    assert.equal(isLiveP7Tenant("system"), false);
    assert.equal(isLiveP7Tenant("GLOBAL"), false);
    assert.equal(isLiveP7Tenant("  "), false);
    assert.equal(isLiveP7Tenant(null), false);
  });

  test("mandate keys are prefixed hashes", () => {
    const hex = "b".repeat(64);
    assert.equal(resourceKeyForMandateHash(hex), `mandate:${hex.slice(0, 16)}`);
  });

  test("bad reputation includes pruned hits; good skips them", () => {
    const hits = [prunedHit, vaultHit];
    const bad = hitsForReputationOutcome(hits, "bad");
    const good = hitsForReputationOutcome(hits, "good");
    assert.equal(bad.length, 2);
    assert.equal(good.length, 1);
    assert.equal(good[0]?.resource_key, "vault:good");
  });

  test("30-day half-life fades an old good below boost when mixed with age factor", () => {
    const now = new Date("2026-09-18T00:00:00.000Z");
    const lastSeenAt = new Date("2026-07-20T00:00:00.000Z");
    const decayed = decayReputationCounts({
      good: 5,
      bad: 0,
      highDrift: 0,
      lastSeenAt,
      now,
      halfLifeDays: 30,
    });
    assert.ok(decayed.factor < 0.3);
    assert.ok(decayed.good < 5);
  });

  test("half-life 0 disables decay", () => {
    const decayed = decayReputationCounts({
      good: 5,
      bad: 1,
      highDrift: 0,
      lastSeenAt: "2020-01-01T00:00:00.000Z",
      halfLifeDays: 0,
    });
    assert.equal(decayed.factor, 1);
    assert.equal(decayed.good, 5);
  });

  test("P7 poison prefers Small Brain even if fitness would escalate", () => {
    const steer = p7SteerHint({
      promoteHits: [vaultHit],
      blockHits: [prunedHit],
      forceEscalate: false,
    });
    assert.equal(steer.prefer_small_brain, true);
    assert.equal(steer.prefer_cache_or_pack, false);
  });

  test("promote-only prefers cache/pack", () => {
    const steer = p7SteerHint({
      promoteHits: [vaultHit],
      blockHits: [],
    });
    assert.equal(steer.prefer_small_brain, false);
    assert.equal(steer.prefer_cache_or_pack, true);
  });

  test("swarm detected hits are child + mandate, never the parent id", () => {
    const hits = swarmDetectedP7Hits({
      identity: {
        agentId: "child-bot",
        parentAgentId: "parent-bot",
        mandateHash: "c".repeat(64),
      },
    });
    const keys = hits.map((h) => h.resource_key).join(" ");
    assert.equal(hits.length, 2);
    assert.equal(keys.includes("parent-bot"), false);
    assert.ok(hits.some((h) => h.label === "swarm_agent"));
    assert.ok(hits.some((h) => h.resource_key.startsWith("mandate:")));
  });

  test("deferred apply maps hashed outcomes without prompt text", () => {
    const { goodHits, badHits } = hitsFromDeferredP7([
      { resource_key: "prompt:abc", ledger: "prompt", kind: "prompt", outcome: "good" },
      { resource_key: "agent:def", ledger: "agent", kind: "agent", outcome: "bad" },
    ]);
    assert.equal(goodHits[0]?.resource_key, "prompt:abc");
    assert.equal(badHits[0]?.pruned, true);
    assert.equal(JSON.stringify(goodHits).includes("ignore previous"), false);
  });

  test("audit q= matches promoted and prompt: keys", () => {
    const lists = p7AuditKeyLists([vaultHit], [prunedHit, hitFromPromptHash("d".repeat(64))!]);
    const row = {
      kind: "p7_source_audit",
      summary: "P7 defend/block",
      metadata: lists,
    };
    assert.equal(auditEventMatchesQuery(row, "vault:good"), true);
    assert.equal(auditEventMatchesQuery(row, "prompt:"), true);
    assert.equal(auditEventMatchesQuery(row, "agent:deadbeef"), true);
  });

  test("context pack omits pruned files", () => {
    const task = RemediationTaskSchema.parse({
      task_id: "00000000-0000-4000-8000-000000000010",
      file_path: "src/poison.ts",
      governance_pillar: "P6",
      bug_index: {
        level_1_category: "1.0_PULSE",
        level_1_1_branch: "1.1_INGEST",
        level_1_1_1_instance: "1.1.1_TEST",
      },
      reason: "bad",
      source: "pillar_vector",
      pillar_vector_id: null,
      scheduling_tier: null,
      preset_interval: null,
    });
    const key = resourceKeyForFile("src/poison.ts");
    const kept = omitPrunedContextTasks([task], new Map([[key, -0.9]]));
    assert.equal(kept.length, 0);
  });
});
