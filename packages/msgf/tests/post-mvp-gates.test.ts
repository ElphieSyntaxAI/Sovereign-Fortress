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
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveSessionPermissions } from "../lib/platform-rbac.ts";
import {
  isPostMvpFeatureEnabled,
  postMvpDisabledPayload,
  postMvpGateSnapshot,
} from "../lib/post-mvp-gates.ts";

describe("post-MVP feature gates", () => {
  test("default snapshot is all off", () => {
    assert.deepEqual(postMvpGateSnapshot({}), {
      signing: false,
      dropbox_archive: false,
      mcp_product: false,
      author_fan_hub: false,
      author_helper: false,
    });
  });

  test("opt-in via env flag", () => {
    assert.equal(isPostMvpFeatureEnabled("signing", {}), false);
    assert.equal(
      isPostMvpFeatureEnabled("signing", { MSGF_POST_MVP_SIGNING: "1" }),
      true
    );
    assert.equal(
      isPostMvpFeatureEnabled("mcp_product", { MSGF_POST_MVP_MCP: "true" }),
      true
    );
    assert.equal(
      isPostMvpFeatureEnabled("author_fan_hub", { AUTHOR_POST_MVP_FAN_HUB: "yes" }),
      true
    );
  });

  test("disabled payload names the feature and env", () => {
    const payload = postMvpDisabledPayload("dropbox_archive");
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "feature_gated");
    assert.equal(payload.feature, "dropbox_archive");
    assert.match(payload.message, /MSGF_POST_MVP_DROPBOX_ARCHIVE=1/);
  });

  test("pending signatures do not lock the IDE while signing is gated", () => {
    const prev = process.env.MSGF_POST_MVP_SIGNING;
    delete process.env.MSGF_POST_MVP_SIGNING;
    try {
      const permissions = resolveSessionPermissions({
        isIndependentSandbox: false,
        teamPlatformRole: "dev",
        accountStatus: "pending_signatures",
      });
      assert.equal(permissions.isDocuSignLocked, false);
    } finally {
      if (prev === undefined) delete process.env.MSGF_POST_MVP_SIGNING;
      else process.env.MSGF_POST_MVP_SIGNING = prev;
    }
  });

  test("pending signatures lock the IDE only when signing is enabled", () => {
    const prev = process.env.MSGF_POST_MVP_SIGNING;
    process.env.MSGF_POST_MVP_SIGNING = "1";
    try {
      const permissions = resolveSessionPermissions({
        isIndependentSandbox: false,
        teamPlatformRole: "dev",
        accountStatus: "pending_signatures",
      });
      assert.equal(permissions.isDocuSignLocked, true);
    } finally {
      if (prev === undefined) delete process.env.MSGF_POST_MVP_SIGNING;
      else process.env.MSGF_POST_MVP_SIGNING = prev;
    }
  });
});
