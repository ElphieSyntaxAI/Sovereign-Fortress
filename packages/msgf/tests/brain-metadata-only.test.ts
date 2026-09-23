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

import { convergeCacheTrainingMetadata } from "../lib/services/converge-cache.js";
import { toCrossTenantBrainMetadata } from "../lib/services/global-insight.js";
import {
  buildGlobalBrainSwarmTelemetry,
  globalBrainTelemetryHasStrippedKeys,
} from "../lib/services/global-brain-swarm-telemetry.js";
import type { SwarmEvaluateTrip } from "../lib/services/swarm-guard.js";

const PROMPT = "Write a medical summary for Patient X with diagnosis text";

describe("brain metadata only", () => {
  test("global swarm envelope drops hard data keys", () => {
    const trip = {
      identity: {
        tenantId: "tenant-secret",
        entityId: "entity-secret",
        agentId: "child-1",
        parentAgentId: "parent-1",
        role: "secondary",
        mandateHash: "a".repeat(64),
      },
      graph: {
        children: ["child-1"],
        entities: ["entity-secret"],
        parentOf: { "child-1": "parent-1" },
        edges: [],
        inflight: 1,
      },
      cause_codes: ["fanout_exceeded"],
    } as unknown as SwarmEvaluateTrip;
    const envelope = buildGlobalBrainSwarmTelemetry({
      trip,
      tokensIn: 10,
      tokensOut: 2,
    });
    const json = JSON.stringify(envelope);
    assert.equal(globalBrainTelemetryHasStrippedKeys(envelope).length, 0);
    assert.equal(json.includes(PROMPT), false);
    assert.equal(json.includes("tenant-secret"), false);
    assert.equal(json.includes("entity-secret"), false);
  });

  test("cross-tenant absorb and converge export keep hashes, not text or embeddings", () => {
    const stored = toCrossTenantBrainMetadata({
      sourceLogId: "log-1",
      tenantId: "acme",
      strategyId: "narrow_mandate",
      driftScore: 0.4,
      patternText: PROMPT,
    });
    assert.equal(stored.includes(PROMPT), false);
    assert.match(stored, /content_hash/);
    assert.equal(stored.includes("embedding"), false);

    const meta = convergeCacheTrainingMetadata({
      resolution: PROMPT,
      agreement_score: 0.91,
      consensus: [
        {
          gemini: { verdict: "HUMAN", reason: PROMPT },
          claude: { verdict: "HUMAN", reason: PROMPT },
          agreement: true,
          decision: "pass",
          halScore: 1,
          consensus_mode: "DUAL",
          consensus_providers: ["google", "anthropic"],
        },
      ],
      cached_at: "2026-09-22T00:00:00.000Z",
    });
    const metaJson = JSON.stringify(meta);
    assert.equal(metaJson.includes(PROMPT), false);
    assert.equal(meta.consensus_mode, "DUAL");
    assert.equal(meta.provider_count, 2);
  });
});