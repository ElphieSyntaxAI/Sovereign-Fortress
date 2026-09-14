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
/**
 * P3 — verify-result request schema.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { VerifyResultBodySchema } from "../lib/schemas/verify-result.js";

describe("verify-result schema", () => {
  test("accepts minimal pass payload", () => {
    const parsed = VerifyResultBodySchema.safeParse({
      tenant_id: "deckhostwmsgf/deck_host",
      passed: true,
    });
    assert.equal(parsed.success, true);
  });

  test("accepts pack_id on pass payload", () => {
    const parsed = VerifyResultBodySchema.safeParse({
      tenant_id: "deckhostwmsgf/deck_host",
      passed: true,
      pack_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    assert.equal(parsed.success, true);
  });

  test("rejects missing tenant_id", () => {
    const parsed = VerifyResultBodySchema.safeParse({ passed: false });
    assert.equal(parsed.success, false);
  });
});
