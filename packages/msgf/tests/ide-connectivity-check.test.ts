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
/**
 * P1 — IDE connectivity check unit tests.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NextRequest } from "next/server";

import { runIdeConnectivityChecks } from "../lib/services/ide-connectivity-check.js";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_IDE_PULSE_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "../lib/msgf-http-headers.js";

function ideProbeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/msgf/ide/connectivity-check", {
    headers: new Headers(headers),
  });
}

describe("ide-connectivity-check", () => {
  test("fails when x-msgf-ide-pulse header missing", async () => {
    const checks = await runIdeConnectivityChecks(
      ideProbeRequest({
        [MSGF_TENANT_KEY_HEADER]: "tenant_test",
        [MSGF_ENTITY_ID_HEADER]: "entity-1",
        authorization: "Bearer test",
      })
    );
    assert.equal(checks.some((c) => c.name === "ide_headers" && !c.ok), true);
  });

  test("fails when bearer missing", async () => {
    const checks = await runIdeConnectivityChecks(
      ideProbeRequest({
        [MSGF_IDE_PULSE_HEADER]: "1",
        [MSGF_TENANT_KEY_HEADER]: "tenant_test",
        [MSGF_ENTITY_ID_HEADER]: "entity-1",
      })
    );
    const auth = checks.find((c) => c.name === "auth_bearer");
    assert.ok(auth);
    assert.equal(auth.ok, false);
    assert.equal(auth.error_code, "AUTH_MISSING");
  });

  test("passes tenant_key check when tenant present", async () => {
    const checks = await runIdeConnectivityChecks(
      ideProbeRequest({
        [MSGF_IDE_PULSE_HEADER]: "1",
        [MSGF_TENANT_KEY_HEADER]: "deckhostwmsgf/deck_host",
        [MSGF_ENTITY_ID_HEADER]: "entity-1",
      })
    );
    const tenant = checks.find((c) => c.name === "tenant_key");
    assert.ok(tenant?.ok);
  });
});
