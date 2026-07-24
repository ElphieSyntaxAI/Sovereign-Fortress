/**
 * @msgf-license-header
 * Hot layer fast read tests.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isHotLayerPrimaryReadsEnabled,
  readActiveSliceFast,
} from "../lib/msgf-hot-layer.ts";

describe("msgf-hot-layer", () => {
  test("primary reads default on unless MSGF_HOT_LAYER_PRIMARY=0", () => {
    const prev = process.env.MSGF_HOT_LAYER_PRIMARY;
    delete process.env.MSGF_HOT_LAYER_PRIMARY;
    assert.equal(isHotLayerPrimaryReadsEnabled(), true);
    process.env.MSGF_HOT_LAYER_PRIMARY = "0";
    assert.equal(isHotLayerPrimaryReadsEnabled(), false);
    if (prev) process.env.MSGF_HOT_LAYER_PRIMARY = prev;
    else delete process.env.MSGF_HOT_LAYER_PRIMARY;
  });

  test("readActiveSliceFast returns miss without redis", async () => {
    const r = await readActiveSliceFast("entity-no-redis-test");
    assert.equal(r.hit, false);
    assert.ok(r.readLatencyNs >= 0);
  });
});
