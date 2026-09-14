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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SHADOW_TRIAL_ACTIVATION_DAYS,
  SHADOW_TRIAL_HOURS,
  SHADOW_TRIAL_TIER,
  buildShadowTrialStatusUrl,
  computeShadowTrialActivationExpiresAt,
  computeShadowTrialWindowExpiresAt,
  evaluateShadowTrialClock,
  formatUsd,
  resolveEffectiveGatewayMode,
  shouldExpireUnusedShadowTrial,
  shouldSendShadowTrialProofReport,
} from "../lib/services/shadow-trial.js";
import {
  INDIVIDUAL_TRIAL_3D_HOURS,
  INDIVIDUAL_TRIAL_3D_LICENSE_TYPE,
  evaluateManagedCloudWindow,
  isIndividualTrial3dLicenseType,
  managedCloudWindowMsForLicenseType,
} from "../lib/services/individual-perpetual-license.js";
import { MSGF_TRIAL_3D_SLICE_SOFT_CAP } from "../lib/services/paid-individual-usage.js";
import { evaluatePulseEntitlement } from "../lib/middleware/entitlementGuard.ts";

describe("shadow-trial", () => {
  it("uses 7-day tier slug for new rows", () => {
    assert.equal(SHADOW_TRIAL_HOURS, 168);
    assert.equal(SHADOW_TRIAL_TIER, "shadow_trial_7d");
    assert.equal(SHADOW_TRIAL_ACTIVATION_DAYS, 14);
  });

  it("builds status URL with encoded token", () => {
    const url = buildShadowTrialStatusUrl("abc/def");
    assert.match(url, /\/shadow-trial\?t=abc%2Fdef$/);
  });

  it("formats USD to 4 decimals", () => {
    assert.equal(formatUsd(1.234567), "$1.2346");
  });

  it("signup deadline is 14 days; first eval starts the 7-day window", () => {
    const signup = new Date("2026-09-14T12:00:00.000Z");
    const activation = computeShadowTrialActivationExpiresAt(signup);
    assert.equal(activation.toISOString(), "2026-09-28T12:00:00.000Z");

    const firstEval = new Date("2026-09-15T08:00:00.000Z");
    const window = computeShadowTrialWindowExpiresAt(firstEval);
    assert.equal(window.toISOString(), "2026-09-22T08:00:00.000Z");
  });

  it("does not start the 7-day clock until first eval", () => {
    const now = Date.parse("2026-09-16T00:00:00.000Z");
    const clock = evaluateShadowTrialClock(
      {
        first_eval_at: null,
        expires_at: "2026-09-28T12:00:00.000Z",
        activation_expires_at: "2026-09-28T12:00:00.000Z",
      },
      now
    );
    assert.equal(clock.awaitingFirstEval, true);
    assert.equal(clock.expired, false);
    assert.equal(clock.windowEnded, false);
    assert.equal(
      shouldSendShadowTrialProofReport(
        {
          first_eval_at: null,
          expires_at: "2026-09-28T12:00:00.000Z",
          activation_expires_at: "2026-09-28T12:00:00.000Z",
        },
        now
      ),
      false
    );
  });

  it("expires unused keys after 14 days without a proof report", () => {
    const now = Date.parse("2026-09-29T00:00:00.000Z");
    const unused = {
      first_eval_at: null,
      expires_at: "2026-09-28T12:00:00.000Z",
      activation_expires_at: "2026-09-28T12:00:00.000Z",
    };
    assert.equal(shouldExpireUnusedShadowTrial(unused, now), true);
    assert.equal(shouldSendShadowTrialProofReport(unused, now), false);
    assert.equal(evaluateShadowTrialClock(unused, now).expired, true);
  });

  it("sends the proof report only after the 7-day window ends", () => {
    const during = Date.parse("2026-09-20T00:00:00.000Z");
    const after = Date.parse("2026-09-23T00:00:00.000Z");
    const started = {
      first_eval_at: "2026-09-15T08:00:00.000Z",
      expires_at: "2026-09-22T08:00:00.000Z",
      activation_expires_at: "2026-09-28T12:00:00.000Z",
    };
    assert.equal(shouldSendShadowTrialProofReport(started, during), false);
    assert.equal(shouldSendShadowTrialProofReport(started, after), true);
    assert.equal(
      shouldSendShadowTrialProofReport(
        { ...started, report_sent_at: "2026-09-23T00:00:00.000Z" },
        after
      ),
      false
    );
  });

  it("forces shadow mode on trial keys until full access is live", () => {
    assert.equal(
      resolveEffectiveGatewayMode({
        requested: "active",
        licenseTierId: "shadow_trial_7d",
        tenantId: "shadow_trial_abcd",
        fullAccessLive: false,
      }),
      "shadow"
    );
    assert.equal(
      resolveEffectiveGatewayMode({
        requested: "active",
        licenseTierId: "shadow_trial_7d",
        tenantId: "shadow_trial_abcd",
        fullAccessLive: true,
      }),
      "active"
    );
    assert.equal(
      resolveEffectiveGatewayMode({
        requested: "active",
        licenseTierId: "pro",
        tenantId: "acme",
        fullAccessLive: false,
      }),
      "active"
    );
  });
});

describe("3-day Individual Pro full access", () => {
  it("treats INDIVIDUAL_TRIAL_3D as a 72h managed-cloud window", () => {
    assert.equal(INDIVIDUAL_TRIAL_3D_HOURS, 72);
    assert.equal(isIndividualTrial3dLicenseType(INDIVIDUAL_TRIAL_3D_LICENSE_TYPE), true);
    assert.equal(MSGF_TRIAL_3D_SLICE_SOFT_CAP, 200);

    const purchase = new Date("2026-09-14T12:00:00.000Z");
    const during = new Date("2026-09-16T11:00:00.000Z");
    const after = new Date("2026-09-17T13:00:00.000Z");
    const windowMs = managedCloudWindowMsForLicenseType(INDIVIDUAL_TRIAL_3D_LICENSE_TYPE);

    assert.equal(
      evaluateManagedCloudWindow(purchase, during, windowMs).managedCloudExpired,
      false
    );
    assert.equal(
      evaluateManagedCloudWindow(purchase, after, windowMs).managedCloudExpired,
      true
    );
  });

  it("allows Pulse during the 72h window and denies after", () => {
    const profile = {
      user_id: "00000000-0000-4000-8000-000000000001",
      tier_id: 1,
      current_credits: 50,
      stripe_subscription_status: null,
      billing_license_type: "lifetime" as const,
      license_type: INDIVIDUAL_TRIAL_3D_LICENSE_TYPE,
      license_purchase_date: "2026-09-14T12:00:00.000Z",
    };
    assert.equal(
      evaluatePulseEntitlement(profile, {
        mockStripeActive: false,
        now: new Date("2026-09-16T12:00:00.000Z"),
      }).allowed,
      true
    );
    assert.equal(
      evaluatePulseEntitlement(profile, {
        mockStripeActive: false,
        now: new Date("2026-09-17T13:00:00.000Z"),
      }).allowed,
      false
    );
  });
});
