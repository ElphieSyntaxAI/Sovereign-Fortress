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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  STAGING_AUTHOR_TENANT_ID,
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
});
