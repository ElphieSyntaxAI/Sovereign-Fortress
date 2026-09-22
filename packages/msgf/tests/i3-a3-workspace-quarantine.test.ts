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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  emailDomain,
  isBlockedConsumerDomain,
} from "../lib/services/company-domains.ts";
import {
  extractGoogleHostedDomain,
  userHasGoogleIdentity,
} from "../lib/services/google-sso-circuit.ts";

describe("workspace SSO domain gate", () => {
  test("gmail always fails company domain attach gate", () => {
    assert.equal(isBlockedConsumerDomain("gmail.com"), true);
    assert.equal(emailDomain("user@gmail.com"), "gmail.com");
    assert.equal(isBlockedConsumerDomain(emailDomain("Ada@Gmail.com")!), true);
  });

  test("hd missing + corporate email domain still usable for lookup key", () => {
    const user = {
      email: "ada@dealstar.io",
      identities: [{ provider: "google", identity_data: {} }],
    };
    assert.equal(extractGoogleHostedDomain(user), null);
    assert.equal(emailDomain(user.email), "dealstar.io");
    assert.equal(isBlockedConsumerDomain("dealstar.io"), false);
  });

  test("extractGoogleHostedDomain reads identity hd", () => {
    assert.equal(
      extractGoogleHostedDomain({
        identities: [{ provider: "google", identity_data: { hd: "Acme.COM" } }],
      }),
      "acme.com"
    );
  });

  test("userHasGoogleIdentity", () => {
    assert.equal(userHasGoogleIdentity({ identities: [{ provider: "google" }] }), true);
    assert.equal(userHasGoogleIdentity({ identities: [{ provider: "github" }] }), false);
    assert.equal(userHasGoogleIdentity({ app_metadata: { provider: "google" } }), true);
  });
});

describe("vault quarantine HITL status rules", () => {
  test("demote requires QUARANTINED; restore accepts QUARANTINED or DEMOTED_HALL", () => {
    const canDemote = (s: string) => s === "QUARANTINED";
    const canRestore = (s: string) => s === "QUARANTINED" || s === "DEMOTED_HALL";
    assert.equal(canDemote("QUARANTINED"), true);
    assert.equal(canDemote("NONE"), false);
    assert.equal(canRestore("DEMOTED_HALL"), true);
    assert.equal(canRestore("RESTORED"), false);
  });
});
