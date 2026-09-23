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
import { describe, test } from "node:test";

import {
  STAGING_AUTHOR_TENANT_ID,
  STAGING_PLAN_PASSWORD,
  STAGING_PLAN_PERSONAS,
  STAGING_SOLO_TENANT_ID,
  assertStagingSeedTarget,
  firstGlobalAdminEmail,
  stripeTestReady,
} from "../lib/staging-readiness-seed.ts";

describe("staging readiness seed isolation", () => {
  test("refuses production deploy env", () => {
    assert.throws(
      () =>
        assertStagingSeedTarget({
          deployEnv: "production",
          supabaseUrl: "https://jlionibxmutsqxnjczii.supabase.co",
        }),
      /DEPLOY_ENV=staging/
    );
  });

  test("refuses production supabase host", () => {
    assert.throws(
      () =>
        assertStagingSeedTarget({
          deployEnv: "staging",
          supabaseUrl: "https://prod-project.supabase.co",
          productionSupabaseHosts: ["prod-project.supabase.co"],
        }),
      /matches production/
    );
  });

  test("allows isolated staging supabase", () => {
    assert.doesNotThrow(() =>
      assertStagingSeedTarget({
        deployEnv: "staging",
        supabaseUrl: "https://jlionibxmutsqxnjczii.supabase.co",
        productionSupabaseHosts: ["some-other-prod.supabase.co"],
      })
    );
  });

  test("admin email and stripe helpers", () => {
    assert.equal(
      firstGlobalAdminEmail("jessicapickens@elphiesyntax.com, other@x.com"),
      "jessicapickens@elphiesyntax.com"
    );
    assert.equal(STAGING_SOLO_TENANT_ID, "staging_readiness");
    assert.equal(STAGING_AUTHOR_TENANT_ID, "author_ecosystem");
    assert.equal(
      stripeTestReady({
        STRIPE_SECRET_KEY: "sk_test_abc",
        STRIPE_PRICE_PRO_INDIVIDUAL: "price_a",
        STRIPE_PRICE_PRO_INDIVIDUAL_YEARLY: "price_b",
        STRIPE_PRICE_STARTUP_TEAM: "price_c",
        STRIPE_PRICE_STARTUP_TEAM_YEARLY: "price_d",
        STRIPE_PRICE_ENTERPRISE: "price_e",
        STRIPE_PRICE_ENTERPRISE_YEARLY: "price_f",
      }),
      true
    );
    assert.equal(stripeTestReady({ STRIPE_SECRET_KEY: "sk_live_abc" }), false);
  });

  test("plan personas use fixed password and commercial emails", () => {
    assert.equal(STAGING_PLAN_PASSWORD, "StagingReady!2026");
    assert.equal(STAGING_PLAN_PERSONAS.pro.email, "pro_user@msgf.dev");
    assert.equal(STAGING_PLAN_PERSONAS.startupAdmin.email, "startup_admin@msgf.dev");
    assert.equal(STAGING_PLAN_PERSONAS.startupDev.email, "startup_dev@msgf.dev");
    assert.equal(STAGING_PLAN_PERSONAS.startupAuditor.email, "startup_auditor@msgf.dev");
    assert.equal(STAGING_PLAN_PERSONAS.startupSecurity.email, "startup_security@msgf.dev");
    assert.equal(STAGING_PLAN_PERSONAS.enterprise.email, "enterprise_ciso@msgf.dev");
    assert.equal(STAGING_PLAN_PERSONAS.enterprise.seatLimit, 25);
  });
});
