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
 * Distribution Build ID: MSGF-f106bce0-20260923T193404Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertPlanFeature,
  commercialPlanFromMsgfTier,
  planAllows,
  PLAN_FEATURES,
  resolveCommercialPlan,
  type PlanFeature,
} from "../lib/billing/plan-entitlements.ts";

const ENTERPRISE_ONLY: PlanFeature[] = [
  "workspace_sso",
  "siem_export",
  "sentry_quarantine",
  "signing",
  "mcp_product",
  "dropbox_archive",
];

const STARTUP_FEATURES: PlanFeature[] = [
  "team",
  "audit_console",
  "tenant_budgets",
  "session_replay",
  "tri_tribunal",
];

describe("resolveCommercialPlan", () => {
  test("workspace company plan overrides profile", () => {
    assert.equal(
      resolveCommercialPlan({
        companyId: "co-1",
        companyPlan: "startup",
        profilePlan: "pro",
      }),
      "startup"
    );
    assert.equal(
      resolveCommercialPlan({
        companyId: "co-1",
        companyPlan: null,
        profilePlan: "enterprise",
      }),
      "byok"
    );
  });

  test("without companyId uses profile plan (default byok)", () => {
    assert.equal(
      resolveCommercialPlan({
        companyId: null,
        companyPlan: "enterprise",
        profilePlan: "pro",
      }),
      "pro"
    );
    assert.equal(
      resolveCommercialPlan({
        companyId: "",
        profilePlan: null,
      }),
      "byok"
    );
  });
});

describe("commercialPlanFromMsgfTier", () => {
  test("maps Stripe msgf_tier metadata", () => {
    assert.equal(commercialPlanFromMsgfTier("individual_pro"), "pro");
    assert.equal(commercialPlanFromMsgfTier("corporate_startup"), "startup");
    assert.equal(commercialPlanFromMsgfTier("corporate_enterprise"), "enterprise");
    assert.equal(commercialPlanFromMsgfTier("unknown"), "byok");
  });
});

describe("plan feature matrix", () => {
  test("Pro blocked for SSO/SIEM/Sentry/team/tri", () => {
    for (const feature of [
      "workspace_sso",
      "siem_export",
      "sentry_quarantine",
      "team",
      "tri_tribunal",
    ] as const) {
      assert.equal(planAllows("pro", feature), false);
      const gate = assertPlanFeature("pro", feature);
      assert.equal(gate.ok, false);
      if (!gate.ok) {
        assert.equal(gate.error, "PLAN_FEATURE_BLOCKED");
        assert.equal(gate.status, 403);
        assert.equal(gate.feature, feature);
      }
    }
  });

  test("Startup allowed team+tri, blocked SSO/SIEM/Sentry", () => {
    for (const feature of STARTUP_FEATURES) {
      assert.equal(planAllows("startup", feature), true);
    }
    for (const feature of [
      "workspace_sso",
      "siem_export",
      "sentry_quarantine",
    ] as const) {
      assert.equal(planAllows("startup", feature), false);
    }
  });

  test("Enterprise allowed all matrix features", () => {
    for (const feature of PLAN_FEATURES) {
      assert.equal(planAllows("enterprise", feature), true, feature);
    }
    for (const feature of ENTERPRISE_ONLY) {
      assert.equal(planAllows("startup", feature), false, feature);
    }
  });
});
