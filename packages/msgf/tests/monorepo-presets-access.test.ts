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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { shouldShowMonorepoWorkspacePresets } from "../lib/monorepo-presets-access";

const env = process.env;

afterEach(() => {
  process.env = env;
});

describe("shouldShowMonorepoWorkspacePresets", () => {
  it("shows presets for @elphiesyntax.com emails", () => {
    delete process.env.MSGF_SHOW_MONOREPO_PRESETS;
    delete process.env.MSGF_MONOREPO_PRESET_EMAIL_SUFFIXES;
    delete process.env.MSGF_GLOBAL_ADMIN_EMAILS;
    assert.equal(shouldShowMonorepoWorkspacePresets("dev@elphiesyntax.com"), true);
  });

  it("hides presets for external customer emails", () => {
    delete process.env.MSGF_SHOW_MONOREPO_PRESETS;
    delete process.env.MSGF_MONOREPO_PRESET_EMAIL_SUFFIXES;
    delete process.env.MSGF_GLOBAL_ADMIN_EMAILS;
    assert.equal(shouldShowMonorepoWorkspacePresets("jessica@dealstar.io"), false);
  });

  it("shows presets for MSGF_GLOBAL_ADMIN_EMAILS allowlist", () => {
    delete process.env.MSGF_SHOW_MONOREPO_PRESETS;
    process.env.MSGF_GLOBAL_ADMIN_EMAILS = "ops@example.com";
    assert.equal(shouldShowMonorepoWorkspacePresets("ops@example.com"), true);
  });

  it("respects MSGF_MONOREPO_PRESET_EMAIL_SUFFIXES override", () => {
    delete process.env.MSGF_SHOW_MONOREPO_PRESETS;
    delete process.env.MSGF_GLOBAL_ADMIN_EMAILS;
    process.env.MSGF_MONOREPO_PRESET_EMAIL_SUFFIXES = "dealstar.io";
    assert.equal(shouldShowMonorepoWorkspacePresets("jessica@dealstar.io"), true);
    assert.equal(shouldShowMonorepoWorkspacePresets("other@example.com"), false);
  });
});
