/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildWorkspaceSetupPrompt } from "../lib/workspace-setup-prompt.js";

describe("workspace setup prompt", () => {
  test("includes the tenant, mapped origins, one origin per app, download, and msgf.enabled", () => {
    const text = buildWorkspaceSetupPrompt({
      tenantKey: "tenant_alpha",
      existingOrigins: ["owner/billing"],
    });
    assert.match(text, /Tenant key: tenant_alpha/);
    assert.match(text, /owner\/billing/);
    assert.match(text, /one project origin per app/i);
    assert.match(text, /\/api\/downloads\/pulse-guard/);
    assert.match(text, /"msgf.enabled": true/);
    assert.match(text, /Already mapped/);
  });
});
