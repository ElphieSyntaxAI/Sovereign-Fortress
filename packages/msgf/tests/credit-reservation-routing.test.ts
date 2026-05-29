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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * Route-aware credit reservation amounts.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  MSGF_CREDIT_RESERVE_CHUNK,
  MSGF_PULSE_LOCAL_RESERVE_CHUNK,
  isCreditReservationEnabled,
  resolveIngestCreditReserveAmount,
  resolvePulseCreditReserveAmount,
} from "../lib/credit-reservation.js";

describe("credit-reservation routing", () => {
  test("explicit MSGF_CREDIT_RESERVATION_ENABLED=1 turns reservation on", () => {
    const prevEnabled = process.env.MSGF_CREDIT_RESERVATION_ENABLED;
    process.env.MSGF_CREDIT_RESERVATION_ENABLED = "1";
    assert.equal(isCreditReservationEnabled(), true);
    if (prevEnabled === undefined) delete process.env.MSGF_CREDIT_RESERVATION_ENABLED;
    else process.env.MSGF_CREDIT_RESERVATION_ENABLED = prevEnabled;
  });

  test("forceGlobalHint uses full reserve chunk", () => {
    assert.equal(
      resolvePulseCreditReserveAmount({ authorHalPresent: true, idePulse: true, forceGlobalHint: true }),
      MSGF_CREDIT_RESERVE_CHUNK
    );
  });

  test("Author HAL IDE pulse uses smaller reserve than global", () => {
    const local = resolvePulseCreditReserveAmount({
      authorHalPresent: true,
      idePulse: true,
    });
    assert.ok(local < MSGF_CREDIT_RESERVE_CHUNK);
    assert.equal(local, MSGF_PULSE_LOCAL_RESERVE_CHUNK);
  });

  test("ingest with no changed files uses light reserve", () => {
    const light = resolveIngestCreditReserveAmount(0, false);
    assert.ok(light < MSGF_CREDIT_RESERVE_CHUNK);
  });
});
