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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Static $/1M token price table for shadow projected bill math (not invoices).
 */

export type PriceRow = { inputPerMillion: number; outputPerMillion: number };

const DEFAULT_OPENAI: PriceRow = { inputPerMillion: 2.5, outputPerMillion: 10 };
const DEFAULT_ANTHROPIC: PriceRow = { inputPerMillion: 3, outputPerMillion: 15 };

const MODEL_PRICES: Record<string, PriceRow> = {
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "o4-mini": { inputPerMillion: 1.1, outputPerMillion: 4.4 },
  "claude-3-5-sonnet": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-3-5-sonnet-20241022": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-3-7-sonnet": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-sonnet-4": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-opus-4": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-3-haiku": { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  "claude-3-5-haiku": { inputPerMillion: 0.8, outputPerMillion: 4 },
};

export function resolvePriceRow(
  provider: "openai" | "anthropic",
  model: string
): PriceRow {
  const key = model.trim().toLowerCase();
  if (MODEL_PRICES[key]) return MODEL_PRICES[key]!;
  for (const [prefix, row] of Object.entries(MODEL_PRICES)) {
    if (key.startsWith(prefix) || key.includes(prefix)) return row;
  }
  return provider === "anthropic" ? DEFAULT_ANTHROPIC : DEFAULT_OPENAI;
}

export function estimateCostUsd(params: {
  provider: "openai" | "anthropic";
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const row = resolvePriceRow(params.provider, params.model);
  const input = Math.max(0, params.inputTokens) / 1_000_000;
  const output = Math.max(0, params.outputTokens) / 1_000_000;
  const usd = input * row.inputPerMillion + output * row.outputPerMillion;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** Split total tokens into ~70% input / 30% output when only total is known. */
export function splitTotalTokens(total: number): { input: number; output: number } {
  const t = Math.max(0, Math.floor(total));
  const input = Math.floor(t * 0.7);
  return { input, output: t - input };
}
