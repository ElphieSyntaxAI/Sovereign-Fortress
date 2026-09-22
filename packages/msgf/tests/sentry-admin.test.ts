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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildSentryIssuePermalink,
  normalizeSentryIssue,
  readSentryAdminConfig,
  sentryAdminStatusPayload,
  sentryModeLabel,
} from "../lib/services/sentry-admin.ts";

describe("sentry-admin config", () => {
  test("unconfigured without token or org", () => {
    const cfg = readSentryAdminConfig({} as NodeJS.ProcessEnv);
    assert.equal(cfg.configured, false);
    assert.equal(sentryModeLabel(cfg), "unconfigured");
  });

  test("configured when token and org present", () => {
    const cfg = readSentryAdminConfig({
      SENTRY_AUTH_TOKEN: "sntrys_test",
      SENTRY_ORG_SLUG: "acme",
      SENTRY_PROJECT_SLUG: "starmap",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.configured, true);
    assert.equal(cfg.orgSlug, "acme");
    assert.equal(cfg.projectSlug, "starmap");
    assert.equal(sentryModeLabel(cfg), "org+project");
    const status = sentryAdminStatusPayload(cfg);
    assert.equal(status.configured, true);
    assert.equal(status.org_slug, "acme");
    assert.ok(!("authToken" in status));
  });
});

describe("sentry-admin permalink + normalize", () => {
  test("buildSentryIssuePermalink with and without project", () => {
    assert.equal(
      buildSentryIssuePermalink({ orgSlug: "acme", issueId: "123" }),
      "https://sentry.io/organizations/acme/issues/123/"
    );
    assert.equal(
      buildSentryIssuePermalink({
        orgSlug: "acme",
        issueId: "123",
        projectSlug: "starmap",
      }),
      "https://sentry.io/organizations/acme/issues/123/?project=starmap"
    );
  });

  test("normalizeSentryIssue maps API fields", () => {
    const issue = normalizeSentryIssue(
      {
        id: "99",
        shortId: "STARMAP-1",
        title: "TypeError: boom",
        culprit: "app.rb in call",
        status: "unresolved",
        level: "error",
        count: "12",
        userCount: 3,
        firstSeen: "2026-01-01T00:00:00Z",
        lastSeen: "2026-07-01T00:00:00Z",
        project: { slug: "starmap" },
      },
      { baseUrl: "https://sentry.io", orgSlug: "acme", projectSlug: null }
    );
    assert.ok(issue);
    assert.equal(issue!.shortId, "STARMAP-1");
    assert.equal(issue!.projectSlug, "starmap");
    assert.ok(issue!.permalink?.includes("/issues/99/"));
  });

  test("normalizeSentryIssue returns null without id", () => {
    assert.equal(
      normalizeSentryIssue({}, { baseUrl: "https://sentry.io", orgSlug: "acme", projectSlug: null }),
      null
    );
  });
});
