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

import {
  envSigningProviderDefault,
  signingMockMode,
} from "../lib/services/signing/resolveSigningProvider.ts";
import { DocuSignSigningProvider } from "../lib/services/signing/DocuSignSigningProvider.ts";
import { DropboxSignSigningProvider } from "../lib/services/signing/DropboxSignSigningProvider.ts";
import {
  buildCrashQueryTokens,
  DEFAULT_SENTRY_VAULT_MATCH_THRESHOLD,
  extractPathTokens,
  pickBestVaultMatch,
  scoreVaultCandidate,
} from "../lib/services/sentry-vault-match.ts";
import { parseSentryWebhookPayload } from "../lib/services/sentry-vault-quarantine.ts";

describe("signing resolver helpers", () => {
  test("envSigningProviderDefault reads SIGNING_PROVIDER", () => {
    const prev = process.env.SIGNING_PROVIDER;
    process.env.SIGNING_PROVIDER = "dropbox_sign";
    assert.equal(envSigningProviderDefault(), "dropbox_sign");
    process.env.SIGNING_PROVIDER = "docusign";
    assert.equal(envSigningProviderDefault(), "docusign");
    if (prev === undefined) delete process.env.SIGNING_PROVIDER;
    else process.env.SIGNING_PROVIDER = prev;
  });

  test("signingMockMode honors MSGF_SIGNING_MOCK and MSGF_DOCUSIGN_MOCK", () => {
    const a = process.env.MSGF_SIGNING_MOCK;
    const b = process.env.MSGF_DOCUSIGN_MOCK;
    const nodeEnv = process.env.NODE_ENV;
    const deploy = process.env.DEPLOY_ENV;
    delete process.env.MSGF_SIGNING_MOCK;
    delete process.env.MSGF_DOCUSIGN_MOCK;
    delete process.env.DEPLOY_ENV;
    process.env.NODE_ENV = "test";
    assert.equal(signingMockMode(), false);
    process.env.MSGF_SIGNING_MOCK = "1";
    assert.equal(signingMockMode(), true);
    delete process.env.MSGF_SIGNING_MOCK;
    process.env.MSGF_DOCUSIGN_MOCK = "true";
    assert.equal(signingMockMode(), true);
    process.env.NODE_ENV = "production";
    process.env.DEPLOY_ENV = "production";
    process.env.MSGF_SIGNING_MOCK = "1";
    assert.equal(signingMockMode(), false);
    if (a === undefined) delete process.env.MSGF_SIGNING_MOCK;
    else process.env.MSGF_SIGNING_MOCK = a;
    if (b === undefined) delete process.env.MSGF_DOCUSIGN_MOCK;
    else process.env.MSGF_DOCUSIGN_MOCK = b;
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    if (deploy === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = deploy;
  });

  test("Dropbox Sign parseWebhook detects all_signed", () => {
    const p = new DropboxSignSigningProvider();
    const parsed = p.parseWebhook(
      JSON.stringify({
        event: { event_type: "signature_request_all_signed" },
        signature_request: {
          signature_request_id: "sr_abc",
          metadata: { invite_id: "inv-1" },
        },
      }),
      new Headers()
    );
    assert.ok(parsed);
    assert.equal(parsed!.completed, true);
    assert.equal(parsed!.external_request_id, "sr_abc");
    assert.equal(parsed!.invite_id, "inv-1");
  });

  test("DocuSign parseWebhook detects envelope-completed", () => {
    const p = new DocuSignSigningProvider();
    const parsed = p.parseWebhook(
      JSON.stringify({
        event: "envelope-completed",
        envelopeId: "env-1",
        inviteId: "inv-2",
      }),
      new Headers()
    );
    assert.ok(parsed);
    assert.equal(parsed!.completed, true);
    assert.equal(parsed!.external_request_id, "env-1");
  });
});

describe("sentry-vault-match", () => {
  test("low confidence does not quarantine", () => {
    const match = pickBestVaultMatch(
      {
        issueId: "1",
        title: "TypeError somewhere",
        frames: [{ filename: "unrelated.ts" }],
      },
      [
        {
          id: "v1",
          content: "totally different vault win about auth cookies",
          metadata: { file_path: "lib/auth.ts" },
          quarantine_status: "NONE",
        },
      ],
      DEFAULT_SENTRY_VAULT_MATCH_THRESHOLD
    );
    assert.equal(match, null);
  });

  test("high path overlap quarantines above threshold", () => {
    const signal = {
      issueId: "42",
      title: "Cannot read property of undefined in pulse-pipeline",
      culprit: "lib/services/pulse-pipeline/converge.ts",
      frames: [
        {
          filename: "packages/msgf/lib/services/pulse-pipeline/converge.ts",
          function: "runConverge",
        },
      ],
    };
    const tokens = buildCrashQueryTokens(signal);
    assert.ok(tokens.includes("converge.ts") || tokens.some((t) => t.includes("converge")));

    const scored = scoreVaultCandidate(tokens, {
      id: "vec-9",
      content: "Fixed null access in runConverge pulse-pipeline converge.ts",
      metadata: {
        file_path: "packages/msgf/lib/services/pulse-pipeline/converge.ts",
        project_origin: "msgf",
      },
    }, extractPathTokens(signal.frames));
    assert.ok(scored.confidence >= 0.75, `confidence=${scored.confidence}`);

    const match = pickBestVaultMatch(signal, [
      {
        id: "vec-9",
        content: "Fixed null access in runConverge pulse-pipeline converge.ts",
        metadata: {
          file_path: "packages/msgf/lib/services/pulse-pipeline/converge.ts",
        },
        quarantine_status: "NONE",
      },
    ]);
    assert.ok(match);
    assert.equal(match!.vectorId, "vec-9");
  });

  test("parseSentryWebhookPayload reads issue alert shape", () => {
    const signal = parseSentryWebhookPayload({
      action: "created",
      data: {
        issue: {
          id: "999",
          title: "Boom in auth",
          culprit: "lib/auth.ts",
          project: { slug: "msgf" },
          tags: [
            { key: "company_id", value: "co-1" },
            { key: "project_origin", value: "msgf" },
          ],
        },
      },
    });
    assert.ok(signal);
    assert.equal(signal!.issueId, "999");
    assert.equal(signal!.companyId, "co-1");
    assert.equal(signal!.projectOrigin, "msgf");
  });
});
