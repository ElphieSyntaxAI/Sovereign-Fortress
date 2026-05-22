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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
/**
 * Heal-queue token estimate helpers.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { RemediationTaskSchema } from "../lib/schemas/heal-queue.js";
import {
  buildHealQueueTokenSummary,
  classifyHealCostTier,
  filterTasksByHealCostTier,
} from "../lib/services/heal-token-estimate.js";

const sampleTask = RemediationTaskSchema.parse({
  task_id: "00000000-0000-4000-8000-000000000099",
  file_path: "src/components/ExamplePanel.tsx",
  governance_pillar: "P6",
  bug_index: {
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_HEAL_QUEUE_BASELINE",
  },
  reason: "test",
  source: "pillar_vector",
  pillar_vector_id: null,
  scheduling_tier: null,
  preset_interval: null,
});

describe("heal-token-estimate", () => {
  test("classifyHealCostTier returns inexpensive for unknown baseline instance", () => {
    const c = classifyHealCostTier(sampleTask.bug_index.level_1_1_1_instance);
    assert.equal(c.tier, "inexpensive");
  });

  test("buildHealQueueTokenSummary shows savings with batch lower than naive sum", () => {
    const summary = buildHealQueueTokenSummary([sampleTask]);
    assert.equal(summary.healable_item_count, 1);
    assert.ok(summary.without_msgf_total >= summary.with_msgf_batch_total);
    assert.ok(summary.tokens_saved_vs_naive >= 0);
  });

  test("filterTasksByHealCostTier respects tier", () => {
    const tier = classifyHealCostTier(sampleTask.bug_index.level_1_1_1_instance).tier;
    const filtered = filterTasksByHealCostTier([sampleTask], tier);
    assert.equal(filtered.length, 1);
  });
});
