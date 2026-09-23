/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildCustomEndpointHeaders } from "../lib/services/model-routing/custom-endpoint.js";
import {
  CUSTOM_OPENAI_COMPATIBLE,
  HOSTED_ENDPOINT_CATALOG,
  applyCatalogDefaults,
  resolveEndpointBaseURL,
} from "../lib/services/model-routing/types.js";
import { routeWithinPreset } from "../lib/services/model-routing/preset-router.js";

describe("hosted endpoint catalog", () => {
  test("API-key mode resolves Gemma / Qwen / DeepSeek catalog URLs", () => {
    assert.equal(
      resolveEndpointBaseURL({
        displayName: "Gemma 3",
        baseURL: "https://ignored.example/v1",
        credentialMode: "api_key",
      }),
      HOSTED_ENDPOINT_CATALOG["Gemma 3"].baseURL
    );
    assert.equal(
      resolveEndpointBaseURL({
        displayName: "Qwen 3",
        baseURL: "",
        credentialMode: "api_key",
      }),
      HOSTED_ENDPOINT_CATALOG["Qwen 3"].baseURL
    );
    assert.equal(
      resolveEndpointBaseURL({
        displayName: "DeepSeek R1",
        baseURL: "",
        credentialMode: "api_key",
      }),
      HOSTED_ENDPOINT_CATALOG["DeepSeek R1"].baseURL
    );
  });

  test("HTTPS mode keeps the typed URL", () => {
    const typed = "https://tunnel.example/v1";
    assert.equal(
      resolveEndpointBaseURL({
        displayName: "Gemma 3",
        baseURL: typed,
        credentialMode: "https",
      }),
      typed
    );
  });

  test("applyCatalogDefaults fills model and auth style for Gemma", () => {
    const resolved = applyCatalogDefaults({
      providerId: "eco-1",
      displayName: "Gemma 3",
      baseURL: "",
      modelName: "",
      maxTokens: 4096,
      costPer1kInput: 0.05,
      costPer1kOutput: 0.1,
      isEcoModel: true,
      providerKind: CUSTOM_OPENAI_COMPATIBLE,
      credentialMode: "api_key",
    });
    assert.equal(resolved.baseURL, HOSTED_ENDPOINT_CATALOG["Gemma 3"].baseURL);
    assert.equal(resolved.modelName, "gemma-3-4b-it");
    assert.equal(resolved.authHeaderStyle, "bearer");
  });

  test("Bearer and x-goog-api-key header styles", () => {
    const bearer = buildCustomEndpointHeaders(CUSTOM_OPENAI_COMPATIBLE, "k1", "bearer");
    assert.equal(bearer.get("authorization"), "Bearer k1");
    const goog = buildCustomEndpointHeaders(CUSTOM_OPENAI_COMPATIBLE, "k2", "x-goog-api-key");
    assert.equal(goog.get("x-goog-api-key"), "k2");
    assert.equal(goog.get("authorization"), null);
  });

  test("medium drift uses DeepSeek when useForReasoning is on", () => {
    const decision = routeWithinPreset({
      preset: "eco_trio",
      band: "medium",
      ecoEndpoints: [
        {
          providerId: "eco-1",
          displayName: "Gemma 3",
          baseURL: "https://a.example/v1",
          modelName: "gemma",
          maxTokens: 1,
          costPer1kInput: 0.01,
          costPer1kOutput: 0.01,
          isEcoModel: true,
          providerKind: CUSTOM_OPENAI_COMPATIBLE,
        },
      ],
      reasoningEndpoint: {
        providerId: "reasoning-1",
        displayName: "DeepSeek R1",
        baseURL: HOSTED_ENDPOINT_CATALOG["DeepSeek R1"].baseURL,
        modelName: "deepseek-reasoner",
        maxTokens: 1,
        costPer1kInput: 1,
        costPer1kOutput: 1,
        isEcoModel: false,
        providerKind: CUSTOM_OPENAI_COMPATIBLE,
        useForReasoning: true,
      },
    });
    assert.equal(decision.action, "dispatch");
    if (decision.action === "dispatch") {
      assert.equal(decision.endpoints?.[0]?.displayName, "DeepSeek R1");
    }
  });
});
