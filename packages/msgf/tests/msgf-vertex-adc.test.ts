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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  SERVICE_ACCOUNT_PATH,
  resolveVertexKeyFilename,
  vertexClientAuthOptions,
  vertexPredictionClientOptions,
} from "../lib/msgf-vertex.ts";
import { resolveAnthropicApiKey } from "../lib/services/anthropic-direct-fallback.ts";

describe("vertex ADC vs local key file", () => {
  test("Cloud Run without a key file uses ADC (empty auth options)", () => {
    const env = {
      K_SERVICE: "msgf-api-staging",
      GCP_PROJECT_ID: "msgf-shield",
    };
    assert.equal(resolveVertexKeyFilename(env, () => false), undefined);
    assert.deepEqual(vertexClientAuthOptions(env, () => false), {});
  });

  test("local service-account.json is used when the file exists", () => {
    const env = {};
    const exists = (p: string) => p === SERVICE_ACCOUNT_PATH;
    assert.equal(resolveVertexKeyFilename(env, exists), SERVICE_ACCOUNT_PATH);
    assert.deepEqual(vertexClientAuthOptions(env, exists), {
      keyFilename: SERVICE_ACCOUNT_PATH,
    });
  });

  test("GOOGLE_APPLICATION_CREDENTIALS wins only when that file exists", () => {
    const gac = "/tmp/real-sa.json";
    const env = { GOOGLE_APPLICATION_CREDENTIALS: gac };
    assert.equal(
      resolveVertexKeyFilename(env, (p) => p === gac),
      gac
    );
    assert.equal(resolveVertexKeyFilename(env, () => false), undefined);
    assert.deepEqual(vertexClientAuthOptions(env, () => false), {});
  });

  test("PredictionServiceClient options use REST fallback and omit missing key files", () => {
    const env = { K_SERVICE: "msgf-api-staging", GCP_PROJECT_ID: "msgf-shield" };
    assert.deepEqual(
      vertexPredictionClientOptions("us-central1-aiplatform.googleapis.com", env, () => false),
      {
        apiEndpoint: "us-central1-aiplatform.googleapis.com",
        fallback: "rest",
        projectId: "msgf-shield",
      }
    );
  });
});

describe("Anthropic platform key alias", () => {
  test("uses MASTER_ANTHROPIC_KEY when ANTHROPIC_API_KEY is unset", () => {
    assert.equal(
      resolveAnthropicApiKey({ MASTER_ANTHROPIC_KEY: "master-key" }),
      "master-key"
    );
    assert.equal(
      resolveAnthropicApiKey({
        ANTHROPIC_API_KEY: "direct-key",
        MASTER_ANTHROPIC_KEY: "master-key",
      }),
      "direct-key"
    );
    assert.equal(resolveAnthropicApiKey({}), undefined);
  });
});
