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
  parseAnthropicUsage,
  parseGeminiUsage,
  parseOpenAiStyleUsage,
} from "../lib/services/provider-usage-meter.js";
import { isEcoProvenOnlyEnabled } from "../lib/services/EcoAggregatorClient.js";
import { calculateEcoSavings, ECO_METHODOLOGY_SHORT } from "../lib/utils/ecoCalculator.js";

describe("provider-usage-meter parsers", () => {
  test("parseAnthropicUsage sums input/output", () => {
    const sample = parseAnthropicUsage(
      { input_tokens: 100, output_tokens: 40 },
      "claude-3-5-sonnet"
    );
    assert.ok(sample);
    assert.equal(sample.total_tokens, 140);
    assert.equal(sample.provider, "anthropic");
  });

  test("parseGeminiUsage reads usageMetadata", () => {
    const sample = parseGeminiUsage(
      { promptTokenCount: 80, candidatesTokenCount: 20, totalTokenCount: 100 },
      "gemini-2.0-flash"
    );
    assert.ok(sample);
    assert.equal(sample.total_tokens, 100);
    assert.equal(sample.provider, "google");
  });

  test("parseOpenAiStyleUsage for xAI", () => {
    const sample = parseOpenAiStyleUsage(
      { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
      "grok-2",
      "xai"
    );
    assert.ok(sample);
    assert.equal(sample.provider, "xai");
    assert.equal(sample.total_tokens, 60);
  });
});

describe("eco proven-only gate", () => {
  test("defaults to proven-only enabled", () => {
    const prev = process.env.MSGF_ECO_PROVEN_ONLY;
    delete process.env.MSGF_ECO_PROVEN_ONLY;
    assert.equal(isEcoProvenOnlyEnabled(), true);
    process.env.MSGF_ECO_PROVEN_ONLY = "0";
    assert.equal(isEcoProvenOnlyEnabled(), false);
    if (prev === undefined) delete process.env.MSGF_ECO_PROVEN_ONLY;
    else process.env.MSGF_ECO_PROVEN_ONLY = prev;
  });

  test("methodology string is non-empty for public disclaimers", () => {
    assert.ok(ECO_METHODOLOGY_SHORT.length > 20);
    const eco = calculateEcoSavings(1_000_000);
    assert.equal(eco.grid_compute_prevented_kwh, 0.4);
  });
});
