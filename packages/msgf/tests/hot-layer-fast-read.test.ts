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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
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
