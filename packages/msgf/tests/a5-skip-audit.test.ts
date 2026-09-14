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
import { describe, test } from "node:test";

import {
  canonicalizeSkipAuditPayload,
  signSkipAuditPayload,
  skipAuditSecret,
  verifySkipAuditSignature,
} from "../lib/services/skip-audit.ts";

describe("skip-audit HMAC", () => {
  const payload = {
    project_origin: "elphiesyntax/msgf",
    user: "machine-1",
    git_sha: "abc123",
    reason: "emergency",
    ts: "2026-07-24T00:00:00.000Z",
  };

  test("canonicalize is stable / sorted", () => {
    const a = canonicalizeSkipAuditPayload(payload);
    const b = canonicalizeSkipAuditPayload({ ...payload });
    assert.equal(a, b);
    assert.ok(a.startsWith("{"));
    assert.ok(a.includes('"project_origin":"elphiesyntax/msgf"'));
  });

  test("sign then verify", () => {
    const secret = "test-skip-secret";
    const sig = signSkipAuditPayload(payload, secret);
    assert.equal(sig.length, 64);
    assert.equal(verifySkipAuditSignature(payload, sig, secret), true);
    assert.equal(verifySkipAuditSignature(payload, "0".repeat(64), secret), false);
  });

  test("tamper fails verify", () => {
    const secret = "test-skip-secret";
    const sig = signSkipAuditPayload(payload, secret);
    assert.equal(
      verifySkipAuditSignature({ ...payload, reason: "tampered" }, sig, secret),
      false
    );
  });

  test("skipAuditSecret prefers MSGF_SKIP_AUDIT_SECRET", () => {
    assert.equal(
      skipAuditSecret({
        MSGF_SKIP_AUDIT_SECRET: "a",
        MSGF_OPS_CRON_SECRET: "b",
      } as NodeJS.ProcessEnv),
      "a"
    );
    assert.equal(
      skipAuditSecret({ MSGF_OPS_CRON_SECRET: "b" } as NodeJS.ProcessEnv),
      "b"
    );
    assert.equal(skipAuditSecret({} as NodeJS.ProcessEnv), null);
  });
});
