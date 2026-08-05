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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Heal queue Zod contracts + RemediationEngine batch prefix grouping.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  HealQueueTokenSummarySchema,
  IngestRemediationActionSchema,
  PRESET_INTERVAL_TO_SCHEDULING_TIER,
  RemediationTaskSchema,
  parseIngestRemediationAction,
} from "../lib/schemas/heal-queue";
import { buildHealQueueTokenSummary } from "../lib/services/heal-token-estimate.js";
import { REMEDIATION_STATE } from "../lib/schemas/remediation-state.js";
import {
  longestCommonPathPrefix,
  remediationEngine,
} from "../lib/services/RemediationEngine";
import {
  estimateBatchExecutionTokens,
  estimateIndividualExecutionTokens,
  presetIntervalsDueThisCronCycle,
} from "../lib/services/heal-queue-cron-batch";

const TENANT = "00000000-0000-4000-8000-000000000001";

describe("RemediationTaskSchema token_estimate", () => {
  test("requires file_path on nested token_estimate", () => {
    const base = {
      task_id: "00000000-0000-4000-8000-000000000099",
      file_path: "packages/msgf/lib/a.ts",
      governance_pillar: "P2" as const,
      bug_index: {
        level_1_category: "1.0_API",
        level_1_1_branch: "1.1_X",
        level_1_1_1_instance: "1.1.1_INGEST_BASELINE",
      },
      reason: "test",
      source: "pillar_vector" as const,
      pillar_vector_id: null,
      scheduling_tier: null,
      preset_interval: null,
    };

    const withoutPath = RemediationTaskSchema.safeParse({
      ...base,
      token_estimate: {
        cost_tier: "inexpensive",
        strategy_scope: "global",
        consequence_score: 10,
        tokens_without_msgf: 100,
        tokens_with_msgf: 80,
        tokens_saved: 20,
      },
    });
    assert.equal(withoutPath.success, false);
    assert.equal(withoutPath.error?.issues[0]?.path.join("."), "token_estimate.file_path");

    const withPath = RemediationTaskSchema.safeParse({
      ...base,
      token_estimate: {
        file_path: base.file_path,
        cost_tier: "inexpensive",
        strategy_scope: "global",
        consequence_score: 10,
        tokens_without_msgf: 100,
        tokens_with_msgf: 80,
        tokens_saved: 20,
      },
    });
    assert.equal(withPath.success, true);
  });
});

describe("HealQueueTokenSummarySchema", () => {
  test("accepts per_item from buildHealQueueTokenSummary", () => {
    const tasks = [
      {
        file_path: "packages/msgf/lib/a.ts",
        governance_pillar: "P2" as const,
        bug_index: {
          level_1_category: "1.0_API",
          level_1_1_branch: "1.1_X",
          level_1_1_1_instance: "1.1.1_INGEST_BASELINE",
        },
        remediation_state: REMEDIATION_STATE.ACTIVE,
      },
    ];
    const summary = buildHealQueueTokenSummary(tasks);
    assert.ok(summary.per_item.length >= 1);

    const parsed = HealQueueTokenSummarySchema.safeParse(summary);
    assert.equal(parsed.success, true, JSON.stringify(parsed.success ? "" : parsed.error?.issues));
  });
});

describe("IngestRemediationActionSchema", () => {
  test("requires file_paths for INDIVIDUAL", () => {
    const parsed = IngestRemediationActionSchema.safeParse({
      tenant_id: TENANT,
      action_type: "INDIVIDUAL",
    });
    assert.equal(parsed.success, false);
  });

  test("requires preset_interval for SCHEDULED", () => {
    const parsed = IngestRemediationActionSchema.safeParse({
      tenant_id: TENANT,
      action_type: "SCHEDULED",
      file_paths: ["src/a.ts"],
    });
    assert.equal(parsed.success, false);
  });

  test("accepts BULK with tenant uuid only", () => {
    const body = parseIngestRemediationAction({
      tenant_id: TENANT,
      action_type: "BULK",
    });
    assert.equal(body.action_type, "BULK");
  });

  test("accepts BULK_EXPENSIVE and BULK_INEXPENSIVE", () => {
    const expensive = parseIngestRemediationAction({
      tenant_id: TENANT,
      action_type: "BULK_EXPENSIVE",
    });
    const inexpensive = parseIngestRemediationAction({
      tenant_id: TENANT,
      action_type: "BULK_INEXPENSIVE",
    });
    assert.equal(expensive.action_type, "BULK_EXPENSIVE");
    assert.equal(inexpensive.action_type, "BULK_INEXPENSIVE");
  });

  test("maps preset intervals to scheduling tiers", () => {
    assert.equal(PRESET_INTERVAL_TO_SCHEDULING_TIER.immediate, "RED");
    assert.equal(PRESET_INTERVAL_TO_SCHEDULING_TIER.nightly, "GREEN");
  });
});

describe("RemediationEngine batch plan", () => {
  test("groups paths under slash prefix to reduce token overhead", () => {
    const prefix = longestCommonPathPrefix([
      "packages/msgf/lib/a.ts",
      "packages/msgf/lib/b.ts",
    ]);
    assert.equal(prefix, "packages/msgf/lib/");

    const plan = remediationEngine.buildBatchRemediationPlan([
      {
        file_path: "packages/msgf/lib/a.ts",
        bug_index_instance: "1.1.1_INGEST_BASELINE",
      },
      {
        file_path: "packages/msgf/lib/b.ts",
        bug_index_instance: "1.1.1_INGEST_BASELINE",
      },
    ]);
    assert.ok(plan.groups.length >= 1);
    assert.ok(plan.token_overhead_saved_estimate >= 0);
  });
});

describe("Cron preset interval windows", () => {
  test("v32-heartbeat due intervals are 6h every tick; nightly after UTC midnight", () => {
    const noon = presetIntervalsDueThisCronCycle({
      executedAt: new Date("2026-05-22T12:00:00.000Z"),
      periodHours: 6,
    });
    assert.deepEqual(noon, ["6h"]);

    const dawn = presetIntervalsDueThisCronCycle({
      executedAt: new Date("2026-05-22T02:00:00.000Z"),
      periodHours: 6,
    });
    assert.deepEqual(dawn, ["6h", "nightly"]);
  });

  test("resolveAutoCronLomConsensusStrategy picks lowest consequence_score global row", () => {
    const pick = remediationEngine.resolveAutoCronLomConsensusStrategy(
      "1.1.1_LOM_MODEL_DISAGREE"
    );
    assert.ok(pick);
    assert.equal(pick.scope, "global");
    const all = remediationEngine.getGlobalStrategiesForIncident("1.1.1_LOM_MODEL_DISAGREE");
    const minScore = Math.min(...all.map((s) => s.consequence_score));
    assert.equal(pick.consequence_score, minScore);
  });

  test("batch token estimate is lower than individual path listing", () => {
    const paths = ["packages/msgf/lib/a.ts", "packages/msgf/lib/b.ts"];
    const individual = estimateIndividualExecutionTokens(paths);
    const plan = remediationEngine.buildBatchRemediationPlan([
      { file_path: paths[0], bug_index_instance: "1.1.1_INGEST_BASELINE" },
      { file_path: paths[1], bug_index_instance: "1.1.1_INGEST_BASELINE" },
    ]);
    const batch = estimateBatchExecutionTokens(plan);
    assert.ok(individual >= batch);
  });
});
