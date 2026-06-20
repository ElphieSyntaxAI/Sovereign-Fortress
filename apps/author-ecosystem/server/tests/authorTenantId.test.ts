import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bffTenantIdFromSupabaseUser } from "../src/lib/authorTenantId.js";

describe("bffTenantIdFromSupabaseUser", () => {
  test("prefers legacy_user_id from metadata", () => {
    assert.equal(
      bffTenantIdFromSupabaseUser({
        id: "auth-uuid",
        user_metadata: { legacy_user_id: "legacy-uuid" },
      }),
      "legacy-uuid"
    );
  });

  test("falls back to auth user id", () => {
    assert.equal(
      bffTenantIdFromSupabaseUser({
        id: "auth-uuid",
        user_metadata: {},
      }),
      "auth-uuid"
    );
  });
});
