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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * P2 — agent context pack builder.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildAgentContextPack } from "../lib/services/agent-context-service.js";
import { RemediationTaskSchema } from "../lib/schemas/heal-queue.js";

const sampleTask = RemediationTaskSchema.parse({
  task_id: "00000000-0000-4000-8000-000000000010",
  file_path: "src/example.ts",
  governance_pillar: "P6",
  bug_index: {
    level_1_category: "1.0_PULSE",
    level_1_1_branch: "1.1_INGEST",
    level_1_1_1_instance: "1.1.1_TEST",
  },
  reason: "Syntax error",
  source: "pillar_vector",
  pillar_vector_id: null,
  scheduling_tier: null,
  preset_interval: null,
});

describe("agent-context-service", () => {
  test("guided mode includes file steps", () => {
    const pack = buildAgentContextPack({
      mode: "guided",
      tenant_id: "tenant/demo",
      tasks: [sampleTask],
    });
    assert.match(pack.markdown, /src\/example\.ts/);
    assert.match(pack.markdown, /Steps:/);
    assert.equal(pack.task_count, 1);
  });

  test("auto mode is compact", () => {
    const pack = buildAgentContextPack({
      mode: "auto",
      tenant_id: "tenant/demo",
      tasks: [sampleTask],
    });
    assert.match(pack.markdown, /compact/i);
    assert.doesNotMatch(pack.markdown, /###/);
  });

  test("filters by file_paths", () => {
    const pack = buildAgentContextPack({
      mode: "guided",
      tenant_id: "tenant/demo",
      tasks: [sampleTask],
      file_paths: ["other.ts"],
    });
    assert.equal(pack.task_count, 0);
  });
});
