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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertSafeCustomEndpointUrl,
  buildCustomEndpointBody,
  customEndpointDispatchGate,
  customEndpointRequestUrl,
  dispatchCustomEndpoints,
  pickScopedEcoEndpoints,
} from "../lib/services/model-routing/custom-endpoint.js";
import {
  CUSTOM_ANTHROPIC,
  CUSTOM_OPENAI_COMPATIBLE,
  publicCustomEndpoint,
  validateEcoTrioEndpoints,
} from "../lib/services/model-routing/types.js";
import { consensusConfigFromStoredRow } from "../lib/services/tenant-consensus-config.js";
import type { StoredCustomEndpoint } from "../lib/services/model-routing/types.js";

const OPEN_GATES = { p1Pass: true, cacheHit: false, swarmAbort: false, p6Pass: true };

function slot(partial: Partial<StoredCustomEndpoint> & Pick<StoredCustomEndpoint, "providerId" | "modelName" | "baseURL">): StoredCustomEndpoint {
  return {
    displayName: partial.providerId,
    maxTokens: 1024,
    costPer1kInput: 0.1,
    costPer1kOutput: 0.1,
    isEcoModel: true,
    providerKind: CUSTOM_OPENAI_COMPATIBLE,
    ...partial,
  };
}

describe("custom endpoint gateway gates", () => {
  test("does not fetch when P1, cache, or swarm abort fails", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response("nope", { status: 200 });
    };
    const endpoint = slot({
      providerId: "phi",
      modelName: "phi3",
      baseURL: "http://localhost:11434/v1",
    });
    for (const gates of [
      { ...OPEN_GATES, p1Pass: false },
      { ...OPEN_GATES, cacheHit: true },
      { ...OPEN_GATES, swarmAbort: true },
      { ...OPEN_GATES, p6Pass: false },
    ]) {
      await assert.rejects(() =>
        dispatchCustomEndpoints({
          gates,
          endpoints: [endpoint],
          parsedBody: { messages: [{ role: "user", content: "hi" }] },
          cloudRun: false,
          fetchImpl: fetchImpl as typeof fetch,
        })
      );
    }
    assert.equal(calls, 0);
    assert.equal(customEndpointDispatchGate({ ...OPEN_GATES, p1Pass: false }).ok, false);
  });

  test("fetches an allowed tunnel only after the gates, with the saved model", async () => {
    let seenUrl = "";
    let seenBody = "";
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      seenUrl = String(url);
      seenBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const result = await dispatchCustomEndpoints({
      gates: OPEN_GATES,
      endpoints: [
        slot({
          providerId: "phi",
          modelName: "phi3",
          baseURL: "https://ollama.tenant.com/v1",
        }),
      ],
      parsedBody: { messages: [{ role: "user", content: "hi" }] },
      cloudRun: true,
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(result.attempted, 1);
    assert.equal(seenUrl, "https://ollama.tenant.com/v1/chat/completions");
    assert.match(seenBody, /"model":"phi3"/);
    assert.equal(result.response.headers.get("content-type"), "application/json");
  });

  test("builds anthropic messages shape and passes SSE through", async () => {
    const body = buildCustomEndpointBody(CUSTOM_ANTHROPIC, "qwen", {
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    });
    assert.equal(body.model, "qwen");
    assert.equal(
      customEndpointRequestUrl("https://ollama.tenant.com/v1", CUSTOM_ANTHROPIC),
      "https://ollama.tenant.com/v1/messages"
    );
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: hi\n\n"));
        controller.close();
      },
    });
    const result = await dispatchCustomEndpoints({
      gates: OPEN_GATES,
      endpoints: [
        slot({
          providerId: "qwen",
          modelName: "qwen",
          baseURL: "https://ollama.tenant.com/v1",
          providerKind: CUSTOM_ANTHROPIC,
        }),
      ],
      parsedBody: body,
      cloudRun: true,
      fetchImpl: (async () =>
        new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        })) as typeof fetch,
    });
    assert.equal(result.response.headers.get("content-type"), "text/event-stream");
    assert.match(await result.response.text(), /data: hi/);
  });

  test("rejects link-local, metadata, and Cloud Run loopback", () => {
    assert.throws(() =>
      assertSafeCustomEndpointUrl("http://169.254.1.1/v1", { cloudRun: false, privateHostAllowed: true })
    );
    assert.throws(() =>
      assertSafeCustomEndpointUrl("http://169.254.169.254/computeMetadata/v1/", {
        cloudRun: true,
        privateHostAllowed: true,
      })
    );
    assert.throws(() =>
      assertSafeCustomEndpointUrl("http://metadata.google.internal/", {
        cloudRun: true,
        privateHostAllowed: true,
      })
    );
    assert.throws(() =>
      assertSafeCustomEndpointUrl("http://localhost:11434/v1", { cloudRun: true, privateHostAllowed: false })
    );
    assert.throws(() =>
      assertSafeCustomEndpointUrl("http://10.0.0.5/v1", { cloudRun: true, privateHostAllowed: false })
    );
    assert.doesNotThrow(() =>
      assertSafeCustomEndpointUrl("http://10.0.0.5/v1", { cloudRun: true, privateHostAllowed: true })
    );
    assert.doesNotThrow(() =>
      assertSafeCustomEndpointUrl("http://localhost:11434/v1", { cloudRun: false, privateHostAllowed: false })
    );
  });

  test("keeps project endpoints off another project and hides the API key", () => {
    const projectA = [slot({ providerId: "a", modelName: "phi3", baseURL: "https://a.example/v1" })];
    const projectB = [slot({ providerId: "b", modelName: "qwen", baseURL: "https://b.example/v1" })];
    assert.equal(pickScopedEcoEndpoints(projectB, projectA)[0]?.providerId, "b");
    assert.equal(pickScopedEcoEndpoints(null, projectA)[0]?.providerId, "a");
    const pub = publicCustomEndpoint({ ...projectA[0]!, apiKeyCipher: "abc" });
    assert.equal(pub.apiKeyConfigured, true);
    assert.equal("apiKeyCipher" in pub, false);
    assert.equal("apiKey" in pub, false);
  });

  test("rejects Eco Trio saves with fewer than three eco models", () => {
    const one = validateEcoTrioEndpoints([
      {
        providerId: "phi",
        displayName: "Phi-3",
        baseURL: "https://ollama.tenant.com/v1",
        modelName: "phi3",
        maxTokens: 1024,
        costPer1kInput: 0.1,
        costPer1kOutput: 0.1,
        isEcoModel: true,
        providerKind: CUSTOM_OPENAI_COMPATIBLE,
      },
    ]);
    assert.equal(one.ok, false);
  });

  test("does not treat an Eco Trio row as a metered TRI fallback", () => {
    const config = consensusConfigFromStoredRow({
      profile_id: "eco_trio",
      mode: "TRI",
      providers: ["google", "anthropic"],
      strictness: "MAJORITY",
      default_provider: "google",
      custom_eco_endpoints: [
        slot({ providerId: "phi", modelName: "phi3", baseURL: "https://a.example/v1", apiKeyCipher: "secret" }),
      ],
    });
    assert.equal(config.profileId, "eco_trio");
    assert.deepEqual(config.providers, ["google", "anthropic"]);
    assert.equal(config.customEcoEndpoints?.[0]?.apiKeyConfigured, true);
    assert.notEqual(config.profileId, "balanced_dual");
  });
});
