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
