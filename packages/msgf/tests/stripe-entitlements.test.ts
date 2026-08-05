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
import { randomUUID } from "node:crypto";
import { describe, test } from "node:test";

import {
  evaluatePulseEntitlement,
  mockStripeSubscriptionActive,
  type P4ProfileEntitlementRow,
} from "../lib/middleware/entitlementGuard.ts";
import {
  mapStripeSubscriptionStatus,
  resolveCheckoutEntityId,
  resolveSeatQuantity,
  stripeIdFromExpandable,
  syncProfileStripeSubscriptionStatus,
  activateStartupTeamSubscription,
} from "../lib/services/stripe-entitlements.ts";

function activeProfile(
  overrides: Partial<P4ProfileEntitlementRow> = {}
): P4ProfileEntitlementRow {
  return {
    user_id: randomUUID(),
    tier_id: 1,
    current_credits: 10,
    stripe_subscription_status: "active",
    billing_license_type: "monthly",
    ...overrides,
  };
}

describe("mapStripeSubscriptionStatus", () => {
  test("maps active-like and past_due / canceled cousins", () => {
    assert.equal(mapStripeSubscriptionStatus("active"), "active");
    assert.equal(mapStripeSubscriptionStatus("trialing"), "active");
    assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
    assert.equal(mapStripeSubscriptionStatus("unpaid"), "past_due");
    assert.equal(mapStripeSubscriptionStatus("canceled"), "canceled");
    assert.equal(mapStripeSubscriptionStatus("cancelled"), "canceled");
    assert.equal(mapStripeSubscriptionStatus(""), "canceled");
    assert.equal(mapStripeSubscriptionStatus("paused"), "paused");
  });
});

describe("checkout metadata helpers", () => {
  test("resolveCheckoutEntityId prefers metadata then client_reference_id", () => {
    assert.equal(
      resolveCheckoutEntityId({
        metadata: { msgf_entity_id: "user-1" },
        client_reference_id: "user-2",
      }),
      "user-1"
    );
    assert.equal(
      resolveCheckoutEntityId({
        metadata: null,
        client_reference_id: "user-2",
      }),
      "user-2"
    );
  });

  test("resolveSeatQuantity clamps metadata quantity", () => {
    assert.equal(
      resolveSeatQuantity({ metadata: { msgf_seat_quantity: "5" } }),
      5
    );
    assert.equal(
      resolveSeatQuantity({ metadata: { msgf_seat_quantity: "0" }, fallback: 3 }),
      3
    );
    assert.equal(
      resolveSeatQuantity({ metadata: { msgf_seat_quantity: "999" } }),
      99
    );
  });

  test("stripeIdFromExpandable handles string and object", () => {
    assert.equal(stripeIdFromExpandable("sub_123"), "sub_123");
    assert.equal(stripeIdFromExpandable({ id: "cus_9" }), "cus_9");
    assert.equal(stripeIdFromExpandable(null), "");
  });
});

describe("evaluatePulseEntitlement mock vs live", () => {
  test("mock ON allows monthly with past_due / null status", () => {
    assert.equal(
      evaluatePulseEntitlement(
        activeProfile({ stripe_subscription_status: "past_due" }),
        { mockStripeActive: true }
      ).allowed,
      true
    );
    assert.equal(
      evaluatePulseEntitlement(
        activeProfile({ stripe_subscription_status: null }),
        { mockStripeActive: true }
      ).allowed,
      true
    );
  });

  test("mock OFF blocks past_due and canceled monthly", () => {
    assert.equal(
      evaluatePulseEntitlement(
        activeProfile({ stripe_subscription_status: "past_due" }),
        { mockStripeActive: false }
      ).allowed,
      false
    );
    assert.equal(
      evaluatePulseEntitlement(
        activeProfile({ stripe_subscription_status: "canceled" }),
        { mockStripeActive: false }
      ).allowed,
      false
    );
    assert.equal(
      evaluatePulseEntitlement(
        activeProfile({ stripe_subscription_status: "active" }),
        { mockStripeActive: false }
      ).allowed,
      true
    );
  });

  test("lifetime still requires credits regardless of Stripe mock", () => {
    assert.equal(
      evaluatePulseEntitlement(
        activeProfile({
          billing_license_type: "lifetime",
          current_credits: 0,
          stripe_subscription_status: null,
        }),
        { mockStripeActive: false }
      ).allowed,
      false
    );
    assert.equal(
      evaluatePulseEntitlement(
        activeProfile({
          billing_license_type: "lifetime",
          current_credits: 5,
        }),
        { mockStripeActive: false }
      ).allowed,
      true
    );
  });
});

describe("mockStripeSubscriptionActive env", () => {
  test("explicit 0 disables mock even when webhook not live", () => {
    const prevMock = process.env.MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE;
    const prevLive = process.env.MSGF_STRIPE_WEBHOOK_LIVE;
    try {
      process.env.MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE = "0";
      delete process.env.MSGF_STRIPE_WEBHOOK_LIVE;
      assert.equal(mockStripeSubscriptionActive(), false);

      process.env.MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE = "1";
      assert.equal(mockStripeSubscriptionActive(), true);

      delete process.env.MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE;
      process.env.MSGF_STRIPE_WEBHOOK_LIVE = "1";
      assert.equal(mockStripeSubscriptionActive(), false);
    } finally {
      if (prevMock === undefined) delete process.env.MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE;
      else process.env.MSGF_ENTITLEMENT_MOCK_STRIPE_ACTIVE = prevMock;
      if (prevLive === undefined) delete process.env.MSGF_STRIPE_WEBHOOK_LIVE;
      else process.env.MSGF_STRIPE_WEBHOOK_LIVE = prevLive;
    }
  });
});

type ProfileRow = Record<string, unknown>;

function createMemoryAdmin(seed: {
  profiles?: ProfileRow[];
  companies?: ProfileRow[];
}) {
  const profiles = [...(seed.profiles ?? [])];
  const companies = [...(seed.companies ?? [])];

  function table(name: string) {
    const rows = name === "p4_profiles" ? profiles : companies;
    let filters: Array<(row: ProfileRow) => boolean> = [];
    let pendingUpdate: ProfileRow | null = null;
    let pendingInsert: ProfileRow | null = null;

    const api = {
      select(_cols?: string) {
        return api;
      },
      eq(col: string, value: unknown) {
        filters.push((row) => String(row[col] ?? "") === String(value ?? ""));
        return api;
      },
      maybeSingle: async () => {
        const hit = rows.find((row) => filters.every((fn) => fn(row))) ?? null;
        return { data: hit, error: null };
      },
      single: async () => {
        const hit = rows.find((row) => filters.every((fn) => fn(row))) ?? null;
        if (pendingInsert) {
          rows.push(pendingInsert);
          const created = pendingInsert;
          pendingInsert = null;
          return { data: created, error: null };
        }
        return { data: hit, error: hit ? null : { message: "not found" } };
      },
      insert(payload: ProfileRow) {
        pendingInsert = { id: randomUUID(), ...payload };
        return api;
      },
      update(payload: ProfileRow, _opts?: { count?: string }) {
        pendingUpdate = payload;
        return api;
      },
      then(
        onfulfilled?: (value: {
          data: ProfileRow[] | null;
          error: null;
          count?: number;
        }) => unknown
      ) {
        if (pendingUpdate) {
          let count = 0;
          for (const row of rows) {
            if (filters.every((fn) => fn(row))) {
              Object.assign(row, pendingUpdate);
              count += 1;
            }
          }
          const result = { data: null, error: null, count };
          pendingUpdate = null;
          filters = [];
          return Promise.resolve(result).then(onfulfilled as never);
        }
        const data = rows.filter((row) => filters.every((fn) => fn(row)));
        filters = [];
        return Promise.resolve({ data, error: null }).then(onfulfilled as never);
      },
    };
    return api;
  }

  return {
    from(name: string) {
      return table(name);
    },
    _profiles: profiles,
    _companies: companies,
  };
}

describe("activateStartupTeamSubscription", () => {
  test("writes monthly active status, credits, company seats, and admin role", async () => {
    const entityId = randomUUID();
    const admin = createMemoryAdmin({
      profiles: [
        {
          user_id: entityId,
          company_id: null,
          current_credits: 0,
          billing_license_type: "free",
          stripe_subscription_status: null,
        },
      ],
      companies: [],
    });

    const result = await activateStartupTeamSubscription({
      adminSupabase: admin as never,
      entityId,
      seatQuantity: 4,
      subscriptionId: "sub_team_1",
      customerId: "cus_team_1",
    });

    assert.ok(result);
    assert.equal(result!.seatLimit, 4);
    assert.equal(result!.subscriptionId, "sub_team_1");

    const profile = admin._profiles.find((p) => p.user_id === entityId);
    assert.equal(profile?.billing_license_type, "monthly");
    assert.equal(profile?.stripe_subscription_status, "active");
    assert.equal(profile?.team_platform_role, "admin");
    assert.equal(profile?.stripe_subscription_id, "sub_team_1");
    assert.ok(Number(profile?.current_credits) >= 100);
    assert.ok(profile?.company_id);

    const company = admin._companies.find((c) => c.id === profile?.company_id);
    assert.equal(company?.seat_limit, 4);
    assert.equal(company?.stripe_subscription_id, "sub_team_1");
  });
});

describe("syncProfileStripeSubscriptionStatus", () => {
  test("maps subscription.updated past_due onto matching profile", async () => {
    const entityId = randomUUID();
    const admin = createMemoryAdmin({
      profiles: [
        {
          user_id: entityId,
          stripe_subscription_id: "sub_x",
          stripe_subscription_status: "active",
          billing_license_type: "monthly",
        },
      ],
    });

    const result = await syncProfileStripeSubscriptionStatus({
      adminSupabase: admin as never,
      subscriptionId: "sub_x",
      status: "past_due",
    });

    assert.equal(result.status, "past_due");
    assert.equal(admin._profiles[0]?.stripe_subscription_status, "past_due");
  });
});
