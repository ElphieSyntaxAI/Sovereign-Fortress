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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { OFFICIAL_PILLAR_TITLE, PILLAR_CARD_FACE } from "../lib/pillar-display.js";
import { formatPolicyRemediationTicker } from "../lib/services/dashboard-orchestration.js";

const root = path.resolve(import.meta.dirname, "..");

function source(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("pillar titles and buyer sentences", () => {
  test("official titles and card faces stay aligned", () => {
    assert.equal(OFFICIAL_PILLAR_TITLE.P1, "Static Ledger (Immutable Rules & Security)");
    assert.equal(OFFICIAL_PILLAR_TITLE.P2, "Flow Sequence (Pipeline & Execution Order)");
    assert.equal(OFFICIAL_PILLAR_TITLE.P3, "Entity Profiles (Identity, Roles & Stylometry)");
    assert.equal(OFFICIAL_PILLAR_TITLE.P4, "State Ledger (Runtime Telemetry & Active Memory)");
    assert.equal(OFFICIAL_PILLAR_TITLE.P5, "Local Variables (Workspace Context Sharding)");
    assert.equal(OFFICIAL_PILLAR_TITLE.P6, "Constraint Ledger (Vault vs. Hall Anomaly Isolation)");
    assert.deepEqual(Object.values(PILLAR_CARD_FACE), [
      "P1 · Rules",
      "P2 · Flow",
      "P3 · Identity",
      "P4 · State",
      "P5 · Context",
      "P6 · Isolation",
    ]);
  });

  test("ticker rewrites stored deny rows for display", () => {
    const line = formatPolicyRemediationTicker(
      "older row swarm://agent-execution-very-long-identifier extra"
    );
    assert.match(line, /^Policy Remediation Rejected: Operator issued DENY & PURGE for agent execution swarm:\/\/agent-execut…/);
    assert.equal(
      formatPolicyRemediationTicker("no swarm id"),
      "Policy Remediation Rejected: Operator issued DENY & PURGE for agent execution the blocked path"
    );
  });

  test("dashboard, reports, and workspace keep the short copy", () => {
    const shell = source("app/_components/dashboard/DashboardShell.tsx");
    assert.match(shell, /No Active Projects/);
    assert.match(shell, /Connect a repository to start tracking governance and token savings/);
    assert.match(shell, /Enterprise Impact Control Plane/);
    assert.match(shell, /Resource Optimization & Sustainability Ledger/);
    assert.match(shell, /Your MSGF Console/);
    assert.doesNotMatch(shell, /Ops dashboard/);
    assert.doesNotMatch(shell, /Your governance/);

    const savings = source("app/_components/dashboard/TokenSavingsFeaturesPanel.tsx");
    assert.match(savings, /Workspace Token Savings/);
    assert.match(savings, /24-hour activity window/);
    assert.match(savings, /Calculated using audited pack character deltas and metered provider baselines/);

    const routing = source("app/_components/dashboard/ConsensusPresetPanel.tsx");
    assert.match(routing, /Model Routing Presets/);
    assert.match(routing, /Select baseline and consensus models/);

    const security = source("app/_components/dashboard/SecurityViewSection.tsx");
    assert.match(security, /Workspace Isolation/);
    assert.match(security, /Standard requests execute\s+via optimized routing/);

    const heal = source("app/_components/dashboard/PostIngestHealingConsole.tsx");
    assert.match(heal, /Automated Remediation Console/);

    const shadow = source("app/_components/dashboard/ShadowProxySavingsPanel.tsx");
    assert.match(shadow, /Shadow proof/);
    assert.match(shadow, /Activate enforcement/);

    const archive = source("app/_components/dashboard/PeriodSavingsReportsPanel.tsx");
    assert.match(archive, /Governance Archive/);
    assert.match(archive, /Audit methodology/);
  });
});
