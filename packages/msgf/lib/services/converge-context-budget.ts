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
 * Token budget for CONVERGE prompts (vault, beats, P2, DEFEND) — not billing truth.
 */

export const MSGF_CONVERGE_MAX_CONTEXT_TOKENS =
  Number(process.env.MSGF_CONVERGE_MAX_CONTEXT_TOKENS?.trim()) || 2400;

/** Approximate chars per token for English-heavy context blocks. */
export function charsForTokenBudget(tokens: number): number {
  return Math.max(0, Math.floor(tokens) * 4);
}

export function estimateTokensFromChars(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

export function trimTextToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = charsForTokenBudget(maxTokens);
  const t = text.trim();
  if (t.length <= maxChars) return t;
  const suffix = "\n…[context truncated for CONVERGE budget]";
  const keep = Math.max(0, maxChars - suffix.length);
  return `${t.slice(0, keep)}${suffix}`;
}

export type ConvergeShardableContext = {
  vaultCrossRefContext: string;
  beatsContext: string;
  p2FlowDirective: string;
  defendConstraints: string;
};

export type ConvergeContextBudgetResult = ConvergeShardableContext & {
  context_budget_applied: boolean;
  estimated_tokens_before: number;
  estimated_tokens_after: number;
};

const TRIM_PRIORITY: (keyof ConvergeShardableContext)[] = [
  "p2FlowDirective",
  "beatsContext",
  "vaultCrossRefContext",
  "defendConstraints",
];

/**
 * Trim shardable CONVERGE blocks to {@link MSGF_CONVERGE_MAX_CONTEXT_TOKENS}.
 * DEFEND is trimmed last; P2/beats/vault absorb cuts first.
 */
export function applyConvergeShardableContextBudget(
  ctx: ConvergeShardableContext,
  maxTokens: number = MSGF_CONVERGE_MAX_CONTEXT_TOKENS
): ConvergeContextBudgetResult {
  const working = { ...ctx };
  const before = estimateBlockTokens(working);

  if (before <= maxTokens) {
    return {
      ...working,
      context_budget_applied: false,
      estimated_tokens_before: before,
      estimated_tokens_after: before,
    };
  }

  let remaining = before - maxTokens;
  for (const key of TRIM_PRIORITY) {
    if (remaining <= 0) break;
    const block = working[key];
    const blockTokens = estimateTokensFromChars(block.length);
    if (blockTokens <= 0) continue;
    const cut = Math.min(remaining, Math.max(0, blockTokens - 48));
    if (cut <= 0) continue;
    const newMax = Math.max(48, blockTokens - cut);
    working[key] = trimTextToTokenBudget(block, newMax);
    remaining -= cut;
  }

  if (remaining > 0) {
    for (const key of TRIM_PRIORITY) {
      if (remaining <= 0) break;
      const blockTokens = estimateTokensFromChars(working[key].length);
      const target = Math.max(32, blockTokens - remaining);
      working[key] = trimTextToTokenBudget(working[key], target);
      remaining = estimateBlockTokens(working) - maxTokens;
      if (remaining <= 0) break;
    }
  }

  const after = estimateBlockTokens(working);
  return {
    ...working,
    context_budget_applied: true,
    estimated_tokens_before: before,
    estimated_tokens_after: after,
  };
}

function estimateBlockTokens(ctx: ConvergeShardableContext): number {
  return (
    estimateTokensFromChars(ctx.vaultCrossRefContext.length) +
    estimateTokensFromChars(ctx.beatsContext.length) +
    estimateTokensFromChars(ctx.p2FlowDirective.length) +
    estimateTokensFromChars(ctx.defendConstraints.length)
  );
}
