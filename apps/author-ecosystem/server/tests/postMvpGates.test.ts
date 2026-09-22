/**
 * Author post-MVP gates (fan hub + helper). Default OFF.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  authorPostMvpDisabledPayload,
  isAuthorFanHubEnabled,
  isAuthorHelperEnabled,
} from "../src/lib/postMvpGates.js";

describe("author post-MVP gates", () => {
  test("fan hub and helper default off", () => {
    assert.equal(isAuthorFanHubEnabled({}), false);
    assert.equal(isAuthorHelperEnabled({}), false);
  });

  test("opt-in via AUTHOR_POST_MVP_* or VITE_*", () => {
    assert.equal(isAuthorFanHubEnabled({ AUTHOR_POST_MVP_FAN_HUB: "1" }), true);
    assert.equal(isAuthorHelperEnabled({ VITE_AUTHOR_POST_MVP_HELPER: "true" }), true);
  });

  test("disabled payload is feature_gated", () => {
    const payload = authorPostMvpDisabledPayload("author_helper");
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "feature_gated");
    assert.equal(payload.feature, "author_helper");
    assert.match(payload.message, /AUTHOR_POST_MVP_HELPER=1/);
  });
});
