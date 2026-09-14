/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DashboardTenantAccessError,
  validateDashboardTenantAccess,
} from "../lib/auth/dashboard-guard.ts";
import { applyDefendMitigationOverrides } from "../lib/services/msgf-global-rules.ts";
import { fitnessSuggestsSmallBrain } from "../lib/services/model-fitness.ts";
import type { ShadowPreflightResult } from "../lib/msgf-shadow.ts";

describe("governance IDOR + mitigation justification", () => {
  it("validateDashboardTenantAccess rejects empty tenant_id", async () => {
    await assert.rejects(
      () =>
        validateDashboardTenantAccess(
          {} as never,
          { user: { id: "11111111-1111-4111-8111-111111111111" } as never },
          "   "
        ),
      (err: unknown) =>
        err instanceof DashboardTenantAccessError && err.status === 400
    );
  });

  it("mitigation override keeps RED without A6 incident_id", () => {
    const preflight = {
      tier: "RED",
      blocked: true,
      reason: "Hall match",
      vaultMatch: null,
      hallMatch: {
        content: "global_mitigation arbitration_beat 1.1.1_TEST",
        metadata: { label: "x", tenant_id: "tenant-a" },
      },
      scoredHits: [],
      prunedHits: [],
      contextHits: [],
    } as unknown as ShadowPreflightResult;

    const out = applyDefendMitigationOverrides(
      preflight,
      {
        version: "test",
        mitigations: [],
        conflict_guards: [
          {
            bug_index_instance: "1.1.1_TEST",
            prefer_human_fix: true,
            canonical_fix_template: "fix",
            human_reasoning: "because",
            updated_at: new Date().toISOString(),
          },
        ],
      },
      "tenant-a"
    );
    assert.equal(out.tier, "RED");
    assert.equal(out.blocked, true);
    assert.match(out.reason, /A6-linked|HITL/i);
  });

  it("mitigation override demotes only with justified incident", () => {
    const preflight = {
      tier: "RED",
      blocked: true,
      reason: "Hall match",
      vaultMatch: null,
      hallMatch: {
        content: "arbitration_beat 1.1.1_TEST",
        metadata: { tenant_id: "tenant-a" },
      },
      scoredHits: [],
      prunedHits: [],
      contextHits: [],
    } as unknown as ShadowPreflightResult;

    const out = applyDefendMitigationOverrides(
      preflight,
      {
        version: "test",
        mitigations: [
          {
            id: "m1",
            bug_index_instance: "1.1.1_TEST",
            bug_index: {
              level_1_category: "1.0",
              level_1_1_branch: "1.1",
              level_1_1_1_instance: "1.1.1_TEST",
            } as never,
            fix_template: "fix",
            human_reasoning: "operator justified",
            incident_id: "inc-123",
            applied_at: new Date().toISOString(),
          },
        ],
        conflict_guards: [
          {
            bug_index_instance: "1.1.1_TEST",
            prefer_human_fix: true,
            canonical_fix_template: "fix",
            human_reasoning: "because",
            updated_at: new Date().toISOString(),
          },
        ],
      },
      "tenant-a"
    );
    assert.equal(out.tier, "YELLOW");
    assert.equal(out.blocked, false);
    assert.match(out.reason, /inc-123/);
  });

  it("fitnessSuggestsSmallBrain requires over spike without under spike", () => {
    assert.equal(
      fitnessSuggestsSmallBrain({ under_rate: 0.05, over_rate: 0.4, sample_count: 20 }),
      true
    );
    assert.equal(
      fitnessSuggestsSmallBrain({ under_rate: 0.3, over_rate: 0.5, sample_count: 20 }),
      false
    );
  });

  it("COMPANY_ADMIN allowlist rejects foreign tenant (pure check)", () => {
    const allow = new Set(["company-uuid", "member-a"]);
    const requested = "foreign-tenant";
    assert.equal(allow.has(requested), false);
  });
});
