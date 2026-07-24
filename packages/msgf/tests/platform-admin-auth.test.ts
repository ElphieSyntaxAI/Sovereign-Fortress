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
import { describe, it } from "node:test";

import {
  buildMsgfAdminSignInUrl,
  buildMsgfAuthCallbackUrl,
  resolveMsgfAppOrigin,
} from "@elphie-syntax/core/platform-admin-auth";
import {
  buildMsgfAuthorHandoffUrl,
  resolveMsgfAuthorHandoffEntryUrl,
  sanitizeAuthorReturnToUrl,
} from "@elphie-syntax/core/operator-handoff-url";

describe("platform-admin-auth", () => {
  it("resolveMsgfAppOrigin prefers env", () => {
    assert.equal(
      resolveMsgfAppOrigin({ env: { MSGF_APP_URL: "https://example.test/" } }),
      "https://example.test"
    );
  });

  it("buildMsgfAdminSignInUrl includes next and from", () => {
    const url = new URL(
      buildMsgfAdminSignInUrl({
        origin: "http://127.0.0.1:3001",
        next: "/admin/portal",
        from: "author",
      })
    );
    assert.equal(url.pathname, "/admin/sign-in");
    assert.equal(url.searchParams.get("next"), "/admin/portal");
    assert.equal(url.searchParams.get("from"), "author");
  });

  it("buildMsgfAuthorHandoffUrl points at MSGF handoff route", () => {
    const href = buildMsgfAuthorHandoffUrl(
      "http://127.0.0.1:3001",
      "http://127.0.0.1:5173/dashboard"
    );
    const u = new URL(href);
    assert.equal(u.pathname, "/api/msgf/admin/author-handoff");
    assert.equal(u.searchParams.get("return_to"), "http://127.0.0.1:5173/dashboard");
  });

  it("resolveMsgfAuthorHandoffEntryUrl uses MSGF_APP_URL", () => {
    const href = resolveMsgfAuthorHandoffEntryUrl("https://authorecosystem.elphiesyntax.com/home", {
      MSGF_APP_URL: "https://elphiesgatedai.elphiesyntax.com",
    });
    const u = new URL(href);
    assert.equal(u.host, "elphiesgatedai.elphiesyntax.com");
    assert.equal(u.pathname, "/api/msgf/admin/author-handoff");
    assert.equal(u.searchParams.get("return_to"), "https://authorecosystem.elphiesyntax.com/home");
  });

  it("sanitizeAuthorReturnToUrl blocks arbitrary hosts", () => {
    assert.equal(
      sanitizeAuthorReturnToUrl("https://evil.test/dashboard", "http://127.0.0.1:5173/dashboard"),
      "http://127.0.0.1:5173/dashboard"
    );
  });

  it("buildMsgfAuthCallbackUrl preserves search and hash", () => {
    const href = buildMsgfAuthCallbackUrl({
      origin: "http://127.0.0.1:3001",
      search: "?code=abc&next=%2Fadmin%2Fportal",
      hash: "#access_token=x",
    });
    assert.ok(href.startsWith("http://127.0.0.1:3001/auth/callback?"));
    assert.ok(href.includes("code=abc"));
    assert.ok(href.endsWith("#access_token=x"));
  });
});
