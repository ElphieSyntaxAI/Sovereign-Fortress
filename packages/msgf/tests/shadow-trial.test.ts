/**
 * @msgf-license-header
 * Shadow trial helpers — token hashing and report copy.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SHADOW_TRIAL_HOURS,
  SHADOW_TRIAL_TIER,
  buildShadowTrialStatusUrl,
  formatUsd,
} from "../lib/services/shadow-trial.js";

describe("shadow-trial", () => {
  it("uses 24h tier slug", () => {
    assert.equal(SHADOW_TRIAL_HOURS, 24);
    assert.equal(SHADOW_TRIAL_TIER, "shadow_trial_24h");
  });

  it("builds status URL with encoded token", () => {
    const url = buildShadowTrialStatusUrl("abc/def");
    assert.match(url, /\/shadow-trial\?t=abc%2Fdef$/);
  });

  it("formats USD to 4 decimals", () => {
    assert.equal(formatUsd(1.234567), "$1.2346");
  });
});
