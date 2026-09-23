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
/**
 * xAI / Grok tenant validation — same JSON verdict contract as Gemini/Claude.
 */

import {
  runWithLlmTimeout,
} from "@/lib/services/cost-runaway-guard";
import {
  parseOpenAiStyleUsage,
  recordMeteredProviderUsage,
  type ProviderMeterContext,
} from "@/lib/services/provider-usage-meter";

export async function runTenantXaiValidation(
  apiKey: string,
  prompt: string,
  meter?: ProviderMeterContext
): Promise<string> {
  const modelId =
    process.env.MSGF_XAI_MODEL?.trim() ||
    process.env.MSGF_TENANT_VALIDATION_XAI_MODEL?.trim() ||
    "grok-2-latest";
  const base = (process.env.MSGF_XAI_API_BASE?.trim() || "https://api.x.ai/v1").replace(
    /\/$/,
    ""
  );

  return runWithLlmTimeout("dual_model.tenant.xai", async (signal) => {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        temperature: 0.1,
        max_tokens: 360,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`xAI validation failed (${res.status})`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: unknown;
      model?: string;
    };
    if (meter) {
      const sample = parseOpenAiStyleUsage(json.usage, json.model || modelId, "xai");
      if (sample) void recordMeteredProviderUsage(meter, sample);
    }
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    return text;
  });
}

export function platformXaiApiKey(): string | null {
  return process.env.XAI_API_KEY?.trim() || null;
}
