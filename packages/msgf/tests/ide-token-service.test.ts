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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * P4 — IDE token mint/hash unit tests.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  hashIdeToken,
  mintIdeTokenPlain,
} from "../lib/services/ide-token-service.js";
import { fingerprintWorkspace } from "../lib/services/registered-workspace-service.js";
import { buildVscodeIdeSetupUri } from "../lib/workspace-ide-deep-link.js";

describe("ide-token-service", () => {
  test("mint produces msgf_ide_ prefix", () => {
    const t = mintIdeTokenPlain();
    assert.match(t, /^msgf_ide_[A-Za-z0-9_-]+$/);
  });

  test("hash is 64 hex chars", () => {
    const h = hashIdeToken(mintIdeTokenPlain());
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]+$/);
  });
});

describe("registered-workspace-service", () => {
  test("fingerprint is stable", () => {
    const a = fingerprintWorkspace({
      userId: "u1",
      workspaceName: "deckhost",
    });
    const b = fingerprintWorkspace({
      userId: "u1",
      workspaceName: "deckhost",
    });
    assert.equal(a, b);
  });
});

describe("workspace-ide-deep-link", () => {
  test("builds vscode uri", () => {
    const uri = buildVscodeIdeSetupUri({
      "msgf.apiUrl": "https://example.com",
      "msgf.tenantKey": "tenant/demo",
      "msgf.authToken": "msgf_ide_test",
      "msgf.role": "dev",
    });
    assert.match(uri, /^vscode:\/\/elphiesyntax\.msgf-pulse-guard\/setup\?/);
    assert.match(uri, /tenantKey=/);
  });
});
