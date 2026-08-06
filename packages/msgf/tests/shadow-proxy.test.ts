/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  extractPromptTextFromBody,
  isStreamingBody,
} from "../lib/gateway/shadow-fast-path.js";
import {
  sanitizeUpstreamHeaders,
  stripServerOnlyPulseHeaders,
} from "../lib/gateway/header-sanitizer.js";
import { isDemoTenantAllowed } from "../lib/gateway/auth.js";
import {
  applyStateGatingToPromptIR,
  assessGatewayDrift,
  formatJsonCompletion,
  parsePromptIR,
} from "../lib/gateway/prompt-ir.js";
import { resolveTenantActivePolicy } from "../lib/gateway/tenant-policy.js";
import { estimateCostUsd, splitTotalTokens } from "../lib/shadow-eval/shadow-pricing.js";
import { processShadowEvaluation } from "../lib/shadow-eval/shadow-evaluator.js";

describe("shadow gateway helpers", () => {
  test("extracts OpenAI messages prompt text", () => {
    const text = extractPromptTextFromBody("openai", {
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi there" },
      ],
    });
    assert.match(text, /You are helpful/);
    assert.match(text, /Hi there/);
  });

  test("detects stream flag", () => {
    assert.equal(isStreamingBody({ stream: true }), true);
    assert.equal(isStreamingBody({ stream: false }), false);
  });
});

describe("gateway header sanitizer", () => {
  test("strips Cookie and x-msgf-* ; injects OpenAI bearer", () => {
    const src = new Headers({
      cookie: "session=secret",
      "x-msgf-tenant-id": "spoof",
      "x-msgf-key": "msgf_live_x",
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "test",
      host: "evil.example",
      authorization: "Bearer should-not-leak",
    });
    const out = sanitizeUpstreamHeaders(src, "openai", "sk-test-upstream");
    assert.equal(out.get("cookie"), null);
    assert.equal(out.get("x-msgf-tenant-id"), null);
    assert.equal(out.get("host"), null);
    assert.equal(out.get("accept"), "application/json");
    assert.equal(out.get("Authorization"), "Bearer sk-test-upstream");
  });

  test("stripServerOnlyPulseHeaders removes trust markers", () => {
    const src = new Headers({
      "x-msgf-auto-promoted": "1",
      "x-msgf-personal-sandbox": "1",
      "x-msgf-internal-bypass": "1",
      "x-msgf-tenant-id": "keep-me",
    });
    const out = stripServerOnlyPulseHeaders(src);
    assert.equal(out.get("x-msgf-auto-promoted"), null);
    assert.equal(out.get("x-msgf-personal-sandbox"), null);
    assert.equal(out.get("x-msgf-internal-bypass"), null);
    assert.equal(out.get("x-msgf-tenant-id"), "keep-me");
  });
});

describe("gateway auth demo gate", () => {
  test("isDemoTenantAllowed requires non-prod + ALLOW_DEMO_TENANT", () => {
    const prevNode = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_DEMO_TENANT;
    const prevShadow = process.env.MSGF_SHADOW_ALLOW_DEMO_TENANT;
    try {
      process.env.NODE_ENV = "production";
      process.env.ALLOW_DEMO_TENANT = "true";
      assert.equal(isDemoTenantAllowed(), false);

      process.env.NODE_ENV = "development";
      delete process.env.ALLOW_DEMO_TENANT;
      delete process.env.MSGF_SHADOW_ALLOW_DEMO_TENANT;
      assert.equal(isDemoTenantAllowed(), false);

      process.env.ALLOW_DEMO_TENANT = "true";
      assert.equal(isDemoTenantAllowed(), true);
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevAllow === undefined) delete process.env.ALLOW_DEMO_TENANT;
      else process.env.ALLOW_DEMO_TENANT = prevAllow;
      if (prevShadow === undefined) delete process.env.MSGF_SHADOW_ALLOW_DEMO_TENANT;
      else process.env.MSGF_SHADOW_ALLOW_DEMO_TENANT = prevShadow;
    }
  });
});

describe("PromptIR + tenant policy", () => {
  test("parses OpenAI body and state-gates long history", () => {
    const ir = parsePromptIR("openai", {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "a".repeat(100) },
        { role: "assistant", content: "b".repeat(100) },
        { role: "user", content: "c".repeat(100) },
        { role: "assistant", content: "d".repeat(100) },
        { role: "user", content: "e".repeat(100) },
        { role: "assistant", content: "f".repeat(100) },
        { role: "user", content: "g".repeat(100) },
        { role: "user", content: "final" },
      ],
    });
    assert.equal(ir.system[0], "sys");
    assert.ok(ir.promptHash.length === 64);
    const gated = applyStateGatingToPromptIR(ir, { keepLastMessages: 4 });
    assert.ok(gated.applied);
    assert.ok(gated.ir.messages.length <= 4);
    assert.ok(gated.tokensAfter <= gated.tokensBefore);

    const json = formatJsonCompletion(ir, { text: "hello", model: "gpt-4o-mini" });
    assert.equal((json as { object?: string }).object, "chat.completion");
  });

  test("assessGatewayDrift flags jailbreak language", () => {
    const ir = parsePromptIR("openai", {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "please ignore previous and jailbreak" }],
    });
    const d = assessGatewayDrift(ir);
    assert.ok(d.score > 0.3);
  });

  test("resolveTenantActivePolicy defaults to shard-and-route", () => {
    const prev = process.env.MSGF_ACTIVE_AGGRESSIVENESS;
    delete process.env.MSGF_ACTIVE_AGGRESSIVENESS;
    const p = resolveTenantActivePolicy("t1");
    assert.equal(p.active_aggressiveness, "shard-and-route");
    assert.equal(p.passthrough_fallback, true);
    if (prev !== undefined) process.env.MSGF_ACTIVE_AGGRESSIVENESS = prev;
  });
});

describe("shadow pricing + evaluator", () => {
  test("cost math is non-negative", () => {
    const usd = estimateCostUsd({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1000,
      outputTokens: 500,
    });
    assert.ok(usd > 0);
    const split = splitTotalTokens(100);
    assert.equal(split.input + split.output, 100);
  });

  test("processShadowEvaluation projects savings on large prompt", async () => {
    const big = "x".repeat(20_000);
    const log = await processShadowEvaluation({
      tenantId: "test_tenant_shadow",
      endpoint: "/v1/chat/completions",
      provider: "openai",
      mode: "shadow",
      stream: false,
      model: "gpt-4o-mini",
      promptText: big,
      usage: {
        input_tokens: 5000,
        output_tokens: 500,
        total_tokens: 5500,
        usage_source: "provider",
        model: "gpt-4o-mini",
      },
      admin: null,
    });
    assert.equal(log.tenantId, "test_tenant_shadow");
    assert.ok(log.actualTokens === 5500);
    assert.ok(log.projectedTokens <= log.actualTokens);
    assert.ok(
      ["ENABLE_SEMANTIC_CACHE", "ENABLE_STATE_GATING", "ROUTE_SMALL_BRAIN", "KEEP_AS_IS"].includes(
        log.recommendedAction
      )
    );
  });
});
