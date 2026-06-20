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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * P1 — workspace IDE settings builder tests.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildIdeWorkspaceSettings,
  formatIdeSettingsJson,
} from "../lib/workspace-ide-setup.js";

describe("workspace-ide-setup P1", () => {
  test("buildIdeWorkspaceSettings strips trailing slash on apiUrl", () => {
    const s = buildIdeWorkspaceSettings({
      apiUrl: "https://elphiesgatedai.elphiesyntax.com/",
      tenantKey: "deckhostwmsgf/deck_host",
      authToken: "jwt-token",
    });
    assert.equal(s["msgf.enabled"], true);
    assert.equal(s["msgf.apiUrl"], "https://elphiesgatedai.elphiesyntax.com");
    assert.equal(s["msgf.tenantKey"], "deckhostwmsgf/deck_host");
    assert.equal(s["msgf.authToken"], "jwt-token");
  });

  test("formatIdeSettingsJson is valid JSON with msgf keys", () => {
    const json = formatIdeSettingsJson(
      buildIdeWorkspaceSettings({
        apiUrl: "https://example.com",
        tenantKey: "t/a",
        authToken: "x",
        devSession: true,
      })
    );
    const parsed = JSON.parse(json) as Record<string, unknown>;
    assert.equal(parsed["msgf.devSession"], true);
    assert.ok(typeof parsed["msgf.apiUrl"] === "string");
  });
});
