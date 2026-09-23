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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import assert from "node:assert/strict";
import test from "node:test";

import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import { breakdownIndexForFlowInconsistency } from "@/lib/education/learning-breakdown-index";
import { bugIndexToGovernancePillar } from "@/lib/services/HealthService";
import {
  bugIndexForGovernanceHeal,
  resolveHealIncidentProjectOrigin,
} from "@/lib/services/heal-incident-scope";

test("resolveHealIncidentProjectOrigin prefers tenantKey org/repo", () => {
  const origin = resolveHealIncidentProjectOrigin({
    tenantKey: "elphiesyntax/author-ecosystem",
    filePath: "governance://baseline/P4",
  });
  assert.equal(origin, "elphiesyntax/author-ecosystem");
});

test("resolveHealIncidentProjectOrigin derives from file path", () => {
  const origin = resolveHealIncidentProjectOrigin({
    filePath: "apps/author-ecosystem/src/foo.ts",
  });
  assert.equal(origin, "apps/author-ecosystem");
});

test("bugIndexForGovernanceHeal uses P4 state ledger index", () => {
  const idx = bugIndexForGovernanceHeal({ governancePillar: "P4" });
  assert.equal(idx.level_1_1_1_instance, "1.1.1_STATE_LEDGER_HEAL");
  assert.equal(bugIndexToGovernancePillar(idx), "P4");
});

test("flow breakdown maps to P4 pillar for incident queue", () => {
  const flow = breakdownIndexForFlowInconsistency();
  assert.equal(bugIndexToGovernancePillar(flow), "P4");
});

test("user sentinel maps to P4 after pillar routing fix", () => {
  assert.equal(
    bugIndexToGovernancePillar(PULSE_BUG_INDEX.userSentinelReport),
    "P4"
  );
});
