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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
/**
 * Anthropic direct API fallback for environments where Vertex partner-model
 * access is not enabled yet. Gemini remains on Vertex; this preserves
 * dual-provider consensus instead of bypassing CONVERGE.
 */

export function isAnthropicPublisherModelPath(modelPath: string): boolean {
  return modelPath.includes("/publishers/anthropic/models/");
}

export async function runAnthropicDirectPublisherModel(params: {
  modelPath: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for direct Anthropic fallback.");
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const model =
    process.env.MSGF_ANTHROPIC_API_MODEL?.trim() ||
    process.env.MSGF_DIRECT_ANTHROPIC_MODEL?.trim() ||
    "claude-sonnet-4-6";

  const msg = await client.messages.create({
    model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    messages: [{ role: "user", content: params.prompt }],
  });

  return msg.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}
