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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isPulseIdempotencyEnabled } from "../lib/services/pulse-idempotency.js";

describe("pulse-idempotency", () => {
  test("enabled by default unless explicitly off", () => {
    const prev = process.env.MSGF_PULSE_IDEMPOTENCY_ENABLED;
    delete process.env.MSGF_PULSE_IDEMPOTENCY_ENABLED;
    assert.equal(isPulseIdempotencyEnabled(), true);
    process.env.MSGF_PULSE_IDEMPOTENCY_ENABLED = "false";
    assert.equal(isPulseIdempotencyEnabled(), false);
    if (prev === undefined) delete process.env.MSGF_PULSE_IDEMPOTENCY_ENABLED;
    else process.env.MSGF_PULSE_IDEMPOTENCY_ENABLED = prev;
  });
});
