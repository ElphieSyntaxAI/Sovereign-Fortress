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

import { dispatchCustomEndpoints } from "../lib/services/model-routing/custom-endpoint.js";
import {
  buildHitlArbitrationItem,
  classifyRoutingDrift,
  provenTokensFromEcoDelta,
  routeWithinPreset,
  signHitlPayload,
} from "../lib/services/model-routing/preset-router.js";
import { CUSTOM_OPENAI_COMPATIBLE, type StoredCustomEndpoint } from "../lib/services/model-routing/types.js";
import { configFromTenantPreset } from "../lib/services/consensus/msgf-consensus-config.js";

function eco(name: string, input: number, output: number): StoredCustomEndpoint {
  return {
    providerId: name,
    displayName: name,
    baseURL: `https://${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.example/v1`,
    modelName: name,
    maxTokens: 2048,
    costPer1kInput: input,
    costPer1kOutput: output,
    isEcoModel: true,
    providerKind: CUSTOM_OPENAI_COMPATIBLE,
  };
}

const trio = [eco("Phi-3", 0.2, 0.2), eco("Qwen 2.5", 0.05, 0.05), eco("Mixtral", 0.1, 0.1)];

describe("preset router", () => {
  test("downgrades a short low-drift Eco Trio prompt to the cheapest SLM and records savings", () => {
    const band = classifyRoutingDrift({ promptChars: 40, logicDriftScore: 0.05 });
    assert.equal(band, "low");
    const decision = routeWithinPreset({ preset: "eco_trio", band, ecoEndpoints: trio });
    assert.equal(decision.action, "dispatch");
    if (decision.action !== "dispatch") return;
    assert.equal(decision.width, 1);
    assert.equal(decision.endpoints?.[0]?.displayName, "Qwen 2.5");
    assert.equal(provenTokensFromEcoDelta(4000, 1000), 750);
  });

  test("medium drift uses the two cheapest Eco Trio SLMs", () => {
    const decision = routeWithinPreset({
      preset: "eco_trio",
      band: "medium",
      ecoEndpoints: trio,
    });
    assert.equal(decision.action, "dispatch");
    if (decision.action !== "dispatch") return;
    assert.deepEqual(
      decision.endpoints?.map((endpoint) => endpoint.displayName),
      ["Qwen 2.5", "Mixtral"]
    );
  });

  test("high drift or P1 risk on Eco Trio queues HITL and does not select SLMs", () => {
    assert.equal(classifyRoutingDrift({ promptChars: 20, p1Risk: true }), "high");
    const decision = routeWithinPreset({ preset: "eco_trio", band: "high", ecoEndpoints: trio });
    assert.equal(decision.action, "hitl");
    if (decision.action !== "hitl") return;
    assert.equal(decision.queue, "/admin/ops");
    const item = buildHitlArbitrationItem({
      preset: "eco_trio",
      projectOrigin: "owner/repo",
      secret: "test-secret",
      now: "2026-09-23T00:00:00.000Z",
    });
    const body = JSON.stringify({
      preset: "eco_trio",
      project_origin: "owner/repo",
      queue: "/admin/ops",
      remediation_state: "PENDING_HUMAN_ARBITRATION",
      ts: "2026-09-23T00:00:00.000Z",
    });
    assert.equal(item.signature, signHitlPayload(body, "test-secret"));
    assert.equal(item.remediation_state, "PENDING_HUMAN_ARBITRATION");
  });

  test("SOLO_FAST stays one model and Tri-Tribunal is the frontier high-drift path", () => {
    const solo = routeWithinPreset({ preset: "solo_fast", band: "medium" });
    assert.equal(solo.action, "dispatch");
    if (solo.action === "dispatch") assert.equal(solo.width, 1);
    const soloHigh = routeWithinPreset({ preset: "solo_fast", band: "high" });
    assert.equal(soloHigh.action, "hitl");
    const dualHigh = routeWithinPreset({ preset: "balanced_dual", band: "high" });
    assert.equal(dualHigh.action, "hitl");
    const frontier = routeWithinPreset({ preset: "tri_tribunal", band: "high" });
    assert.equal(frontier.action, "frontier");
    const ecoPreset = configFromTenantPreset("eco_trio", ["google", "anthropic"]);
    assert.ok(!("error" in ecoPreset));
    if ("error" in ecoPreset) return;
    assert.equal(ecoPreset.profileId, "eco_trio");
    assert.equal(ecoPreset.defaultProvider, "google");
    assert.deepEqual(ecoPreset.providers, ["google", "anthropic"]);
  });

  test("429 on Balanced Dual width and Eco Trio routine failover keeps a response", async () => {
    const dual = routeWithinPreset({ preset: "balanced_dual", band: "medium" });
    assert.equal(dual.action, "dispatch");
    if (dual.action === "dispatch") assert.equal(dual.width, 2);

    let calls = 0;
    const result = await dispatchCustomEndpoints({
      gates: { p1Pass: true, cacheHit: false, swarmAbort: false, p6Pass: true },
      endpoints: [trio[1]!, trio[2]!],
      parsedBody: { messages: [] },
      cloudRun: true,
      fetchImpl: (async () => {
        calls += 1;
        return new Response("limited", { status: calls === 1 ? 429 : 200 });
      }) as typeof fetch,
    });
    assert.equal(calls, 2);
    assert.equal(result.response.status, 200);
    assert.equal(result.endpoint.displayName, "Mixtral");
  });
});
