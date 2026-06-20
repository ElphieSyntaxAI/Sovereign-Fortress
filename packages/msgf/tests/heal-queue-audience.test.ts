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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { HealQueueGetResponse } from "../lib/schemas/heal-queue.js";
import { REMEDIATION_STATE } from "../lib/schemas/remediation-state.js";
import { applyHealQueueAudienceScope } from "../lib/services/heal-queue-audience.js";

function minimalQueue(): HealQueueGetResponse {
  return {
    ok: true,
    tenant_id: "00000000-0000-4000-8000-000000000001",
    brain_readiness: {
      readiness_score: 50,
      missing_pillars: [],
      baseline_training_required: false,
      baseline_training_remaining: 0,
      is_pillar_baseline_set: true,
      brain_fully_initialized: true,
    },
    remediation_tasks: [
      {
        file_path: "src/a.ts",
        governance_pillar: "P2",
        bug_index: {
          level_1_category: "1.0_API",
          level_1_1_branch: "1.1_X",
          level_1_1_1_instance: "1.1.1_X",
        },
        remediation_state: REMEDIATION_STATE.ACTIVE,
      },
      {
        file_path: "src/b.ts",
        governance_pillar: "P6",
        bug_index: {
          level_1_category: "1.0_API",
          level_1_1_branch: "1.1_X",
          level_1_1_1_instance: "1.1.1_Y",
        },
        remediation_state: REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
        circuit_breaker_open: true,
      },
    ],
    human_arbitration_packages: [
      {
        file_path: "src/b.ts",
        governance_pillar: "P6",
        bug_index: {
          level_1_category: "1.0_API",
          level_1_1_branch: "1.1_X",
          level_1_1_1_instance: "1.1.1_Y",
        },
        comparison_pairs: [],
      },
    ],
    heal_token_summary: {
      healable_item_count: 2,
      without_msgf_total: 100,
      with_msgf_total: 40,
      tokens_saved_total: 60,
      expensive_count: 0,
      inexpensive_count: 2,
      expensive_subset: {
        without_msgf_total: 0,
        with_msgf_total: 0,
        tokens_saved_total: 0,
        item_count: 0,
      },
      inexpensive_subset: {
        without_msgf_total: 100,
        with_msgf_total: 40,
        tokens_saved_total: 60,
        item_count: 2,
      },
    },
  };
}

describe("heal-queue-audience", () => {
  test("user scope hides Big Brain arbitration and pending tasks", () => {
    const user = applyHealQueueAudienceScope(minimalQueue(), "user");
    assert.equal(user.audience_scope, "user");
    assert.equal(user.human_arbitration_packages.length, 0);
    assert.equal(user.remediation_tasks.length, 1);
    assert.equal(user.remediation_tasks[0]?.file_path, "src/a.ts");
    assert.equal(user.big_brain_escalations_pending, 2);
  });

  test("admin scope retains full queue", () => {
    const admin = applyHealQueueAudienceScope(minimalQueue(), "admin");
    assert.equal(admin.audience_scope, "admin");
    assert.equal(admin.human_arbitration_packages.length, 1);
    assert.equal(admin.remediation_tasks.length, 2);
  });
});
