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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { MSGF_PROJECT_ORIGIN_HEADER } from "../lib/msgf-http-headers.js";
import {
  extractProjectOriginFromTrackingRequest,
  normalizeProjectOrigin,
  personalDashboardProjectOrigins,
  stampProjectOriginOnPayload,
  tenantKeyLooksLikeProjectOrigin,
} from "../lib/services/project-tracking-rails.js";

describe("project-tracking-rails", () => {
  test("tenantKeyLooksLikeProjectOrigin accepts org/repo only", () => {
    assert.equal(tenantKeyLooksLikeProjectOrigin("ElphieSyntax/DealStar"), true);
    assert.equal(tenantKeyLooksLikeProjectOrigin("author_ecosystem"), false);
    assert.equal(tenantKeyLooksLikeProjectOrigin("My Local Folder"), false);
    assert.equal(tenantKeyLooksLikeProjectOrigin(""), false);
  });

  test("extractProjectOriginFromTrackingRequest prefers header then body", () => {
    const req = new Request("https://example.com/api/msgf/pulse", {
      headers: {
        [MSGF_PROJECT_ORIGIN_HEADER]: "org/from-header",
        "X-MSGF-Tenant-Key": "org/from-tenant-key",
      },
      method: "POST",
    });

    assert.equal(
      extractProjectOriginFromTrackingRequest(req as never, {
        project_origin: "org/from-body",
      }),
      "org/from-header"
    );

    const ideReq = new Request("https://example.com/api/msgf/pulse", {
      headers: { "X-MSGF-Tenant-Key": "org/ide-key" },
      method: "POST",
    });
    assert.equal(
      extractProjectOriginFromTrackingRequest(ideReq as never, undefined, { idePulse: true }),
      "org/ide-key"
    );
    assert.equal(
      extractProjectOriginFromTrackingRequest(ideReq as never, undefined, { idePulse: false }),
      undefined
    );
  });

  test("stampProjectOriginOnPayload writes body and metadata", () => {
    const stamped = stampProjectOriginOnPayload(
      { keystrokes: [], metadata: { trace: "t1" } },
      "org/repo"
    ) as Record<string, unknown>;
    assert.equal(stamped.project_origin, "org/repo");
    assert.deepEqual(stamped.metadata, { trace: "t1", project_origin: "org/repo" });
  });

  test("personalDashboardProjectOrigins scopes to a single mapping", () => {
    assert.deepEqual(personalDashboardProjectOrigins(["org/a"]), ["org/a"]);
    assert.deepEqual(personalDashboardProjectOrigins(["org/a", "org/b"]), []);
    assert.deepEqual(personalDashboardProjectOrigins([]), []);
  });

  test("normalizeProjectOrigin strips stray trailing quotes", () => {
    assert.equal(normalizeProjectOrigin('Andrew/dealstar_pro"'), "Andrew/dealstar_pro");
    assert.equal(normalizeProjectOrigin("Andrew/DECKHOST_PRO"), "Andrew/DECKHOST_PRO");
  });
});
