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

  test("rejects missing tenant_id", () => {
    const parsed = VerifyResultBodySchema.safeParse({ passed: false });
    assert.equal(parsed.success, false);
  });
});
