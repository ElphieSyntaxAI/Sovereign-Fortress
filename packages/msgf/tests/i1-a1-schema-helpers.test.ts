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
  assertRegisterableCompanyDomain,
  emailDomain,
  isBlockedConsumerDomain,
  normalizeCompanyDomain,
} from "../lib/services/company-domains.ts";
import {
  filterVaultRowsForRetrieval,
  isVaultRowEligibleForRetrieval,
} from "../lib/services/vault-quarantine.ts";

describe("company-domains", () => {
  test("normalizeCompanyDomain lowercases and strips @", () => {
    assert.equal(normalizeCompanyDomain("  @Foo.COM. "), "foo.com");
  });

  test("blocks consumer gmail", () => {
    assert.equal(isBlockedConsumerDomain("gmail.com"), true);
    assert.throws(() => assertRegisterableCompanyDomain("gmail.com"));
  });

  test("allows corporate domain", () => {
    assert.equal(assertRegisterableCompanyDomain("DealStar.io"), "dealstar.io");
  });

  test("emailDomain extracts host", () => {
    assert.equal(emailDomain("Ada@DealStar.IO"), "dealstar.io");
    assert.equal(emailDomain("not-an-email"), null);
  });
});

describe("vault-quarantine", () => {
  test("NONE and missing status are eligible", () => {
    assert.equal(isVaultRowEligibleForRetrieval({ quarantine_status: "NONE" }), true);
    assert.equal(isVaultRowEligibleForRetrieval({}), true);
    assert.equal(isVaultRowEligibleForRetrieval({ quarantine_status: "RESTORED" }), true);
  });

  test("QUARANTINED and DEMOTED_HALL are blocked", () => {
    assert.equal(isVaultRowEligibleForRetrieval({ quarantine_status: "QUARANTINED" }), false);
    assert.equal(isVaultRowEligibleForRetrieval({ quarantine_status: "DEMOTED_HALL" }), false);
    assert.equal(
      isVaultRowEligibleForRetrieval({ metadata: { quarantine_status: "QUARANTINED" } }),
      false
    );
  });

  test("filterVaultRowsForRetrieval drops blocked rows", () => {
    const rows = [
      { id: "1", quarantine_status: "NONE" },
      { id: "2", quarantine_status: "QUARANTINED" },
      { id: "3", quarantine_status: "DEMOTED_HALL" },
      { id: "4", quarantine_status: "RESTORED" },
    ];
    const kept = filterVaultRowsForRetrieval(rows);
    assert.deepEqual(
      kept.map((r) => r.id),
      ["1", "4"]
    );
  });
});
