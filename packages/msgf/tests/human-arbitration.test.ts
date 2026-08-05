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
import assert from "node:assert/strict";
import test from "node:test";

import { RemediationTaskSchema } from "@/lib/schemas/heal-queue";
import { REMEDIATION_STATE } from "@/lib/services/remediation-retry-circuit";
import {
  buildHumanArbitrationPackage,
  runArbitratePhase,
} from "@/lib/services/pulse-pipeline";
import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";

test("buildHumanArbitrationPackage returns null when circuit is closed", () => {
  const task = RemediationTaskSchema.parse({
    task_id: "00000000-0000-4000-8000-000000000001",
    file_path: "src/foo.ts",
    governance_pillar: "P2",
    bug_index: PULSE_BUG_INDEX.hallConsensusFailed,
    reason: "test",
    source: "pillar_vector",
    pillar_vector_id: null,
    scheduling_tier: null,
    preset_interval: null,
    remediation_state: "ACTIVE",
    circuit_breaker_open: false,
  });
  assert.equal(buildHumanArbitrationPackage(task), null);
});

test("buildHumanArbitrationPackage includes fix, consequence score, and comparison pairs", () => {
  const task = RemediationTaskSchema.parse({
    task_id: "00000000-0000-4000-8000-000000000002",
    file_path: "packages/msgf/lib/foo.ts",
    governance_pillar: "P2",
    bug_index: PULSE_BUG_INDEX.hallConsensusFailed,
    reason: "Max remediation failures",
    source: "pillar_vector",
    pillar_vector_id: "00000000-0000-4000-8000-000000000099",
    scheduling_tier: null,
    preset_interval: null,
    remediation_state: REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
    consecutive_failure_count: 3,
    circuit_breaker_open: true,
  });

  const pkg = buildHumanArbitrationPackage(task);
  assert.ok(pkg);
  assert.equal(pkg.remediation_state, REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION);
  assert.ok(pkg.primary.recommended_code_fix.length > 20);
  assert.ok(pkg.primary.consequence_score >= 0 && pkg.primary.consequence_score <= 100);
  assert.ok(pkg.primary.predicted_consequence.length > 5);

  const phase = runArbitratePhase({ remediation_tasks: [task] });
  assert.equal(phase.pending_human_arbitration.length, 1);
  assert.equal(phase.packages_by_path[task.file_path]?.file_path, task.file_path);
});
