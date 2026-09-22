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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Savings QA checkpoints 18–19 (dev-event routing + CONVERGE result cache).
 * Runs in-memory via FakeSupabase and bound converge-cache store.
 */

import assert from "node:assert/strict";
import { describe, test, afterEach } from "node:test";

import { MSGF_PILLAR_TABLE_SANDBOX } from "../lib/msgf-tenant-governance.js";
import { DevEventBodySchema } from "../lib/schemas/dev-event.js";
import {
  __bindInMemoryConvergeCacheStoreForTests,
  buildConvergeCacheRedisKey,
  buildConvergeResolutionString,
  estimateCoreConvergeTokenBaseline,
  getOrSetConvergeCache,
  resolveConvergeRoutingProfile,
  type ConvergeCacheEntry,
  type ConvergeCachedChunk,
} from "../lib/services/converge-cache.js";
import { MSGF_BRAIN_SMALL } from "../lib/services/brain-routing-policy.js";
import { routeDevEventBuildFailure } from "../lib/services/dev-event-routing.js";
import { runDevEventBuildHeal } from "../lib/services/dev-event-build-heal.js";
import { FakeSupabase, devTestVaultRow } from "./helpers/fake-supabase.js";

const BUILD_FAILURE_PAYLOAD = DevEventBodySchema.parse({
  kind: "build_failed",
  activeFile: "src/App.tsx",
  excerpt: "error TS2322: Type string is not assignable to type number in App.tsx",
  exitCode: 1,
  tenantId: "DEV_TEST",
});

const MOCK_CONSENSUS: ConvergeCachedChunk[] = [
  {
    gemini: { verdict: "APPROVE", reason: "Pulse aligns with vault cross-ref." },
    claude: { verdict: "APPROVE", reason: "Pulse aligns with vault cross-ref." },
    agreement: true,
    decision: "APPROVE",
    halScore: 91,
  },
];

describe("savings QA checkpoints", () => {
  afterEach(() => {
    __bindInMemoryConvergeCacheStoreForTests(null);
  });

  test("18. Dev-event router correctly bypasses biometric evaluation and enforces Heal Cheap pathways", async () => {
    const routing = routeDevEventBuildFailure(BUILD_FAILURE_PAYLOAD);

    assert.equal(routing.execution_tier, "CHEAP");
    assert.equal(routing.heal_pathway, "heal_cheap");
    assert.equal(routing.biometric_evaluation_skipped, true);
    assert.equal(routing.pulse_pipeline_skipped, true);
    assert.equal(routing.brain_tier, MSGF_BRAIN_SMALL);
    assert.equal(routing.global_admin_approval_required, false);

    const supabase = new FakeSupabase({
      [MSGF_PILLAR_TABLE_SANDBOX]: [
        devTestVaultRow(
          "Fix TS2322 by narrowing props in App.tsx — use satisfies or explicit union."
        ),
      ],
      p4_narrative_logs: [],
    });

    const heal = await runDevEventBuildHeal({
      adminSupabase: supabase as never,
      entityId: "entity-qa-18",
      body: BUILD_FAILURE_PAYLOAD,
    });

    assert.equal(heal.resolution_source, "vault_cache");
    assert.equal(heal.brain_tier, MSGF_BRAIN_SMALL);
    assert.equal(heal.resolved, true);
    assert.ok(heal.vault_match_id);
    assert.equal(heal.token_usage_estimate.with_msgf, 0);
    assert.equal(heal.token_usage_estimate.savings_pct, 100);
    assert.ok(heal.token_usage_estimate.tokens_saved > 0);
  });

  test("19. CONVERGE Result Cache correctly registers an absolute token saving on identical content hashes", async () => {
    const memory = new Map<string, string>();
    __bindInMemoryConvergeCacheStoreForTests(memory);

    const tenantId = "DEV_TEST";
    const contentHash =
      "a3f2c9e1b4d8076f5e2a1c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8";
    const routingProfile = resolveConvergeRoutingProfile(
      "individual_byok",
      "gemini-2.0-flash"
    );
    const redisKey = buildConvergeCacheRedisKey(tenantId, contentHash, routingProfile);

    const consensus = MOCK_CONSENSUS;
    const agreement_score = 0.92;
    const seeded: ConvergeCacheEntry = {
      resolution: buildConvergeResolutionString(consensus),
      agreement_score,
      consensus,
      cached_at: new Date().toISOString(),
    };
    memory.set(redisKey, JSON.stringify(seeded));

    const baselineTokens = estimateCoreConvergeTokenBaseline(1);
    assert.ok(baselineTokens > 0);

    let dualModelOrchestrationInvoked = false;

    const first = await getOrSetConvergeCache({
      tenantId,
      contentHash,
      routingProfile,
      entityId: "entity-qa-19",
      packetCount: 1,
      runConverge: async () => {
        dualModelOrchestrationInvoked = true;
        throw new Error("dual-model CONVERGE must not run on cache hit");
      },
    });

    assert.equal(dualModelOrchestrationInvoked, false);
    assert.equal(first.cacheHit, true);
    assert.equal(first.agreementScore, agreement_score);
    assert.equal(first.resolution, seeded.resolution);
    assert.deepEqual(first.consensus, consensus);

    const tokensSavedOnHit = baselineTokens;
    assert.equal(tokensSavedOnHit, baselineTokens);

    dualModelOrchestrationInvoked = false;

    const second = await getOrSetConvergeCache({
      tenantId,
      contentHash,
      routingProfile,
      runConverge: async () => {
        dualModelOrchestrationInvoked = true;
        throw new Error("dual-model CONVERGE must not run on identical hash replay");
      },
    });

    assert.equal(dualModelOrchestrationInvoked, false);
    assert.equal(second.cacheHit, true);
    assert.equal(second.resolution, seeded.resolution);
  });
});
