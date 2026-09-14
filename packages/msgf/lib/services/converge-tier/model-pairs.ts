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
import type { ConvergeModelPair, ConvergeTier } from "@/lib/services/converge-tier/types";

const DEFAULT_PAIRS: Record<ConvergeTier, ConvergeModelPair> = {
  TIER_1: {
    tier: "TIER_1",
    modelA: { provider: "openai", modelId: "gpt-4o-mini" },
    modelB: { provider: "anthropic", modelId: "claude-3-5-haiku-20241022" },
  },
  TIER_2: {
    tier: "TIER_2",
    modelA: { provider: "anthropic", modelId: "claude-3-5-sonnet-20241022" },
    modelB: { provider: "openai", modelId: "gpt-4o" },
  },
  TIER_3: {
    tier: "TIER_3",
    modelA: { provider: "anthropic", modelId: "claude-3-5-sonnet-20241022" },
    modelB: { provider: "openai", modelId: "gpt-4o" },
  },
};

function envModel(tier: ConvergeTier, slot: "A" | "B"): string | null {
  const key = `MSGF_CONVERGE_${tier}_${slot}_MODEL`;
  return process.env[key]?.trim() || null;
}

export function resolveModelPairForTier(tier: ConvergeTier): ConvergeModelPair {
  const base = DEFAULT_PAIRS[tier];
  const aOverride = envModel(tier, "A");
  const bOverride = envModel(tier, "B");
  return {
    tier,
    modelA: aOverride
      ? { ...base.modelA, modelId: aOverride }
      : base.modelA,
    modelB: bOverride
      ? { ...base.modelB, modelId: bOverride }
      : base.modelB,
  };
}

export function convergeRoutingProfileForTier(tier: ConvergeTier): string {
  const pair = resolveModelPairForTier(tier);
  return `tier_${tier.toLowerCase()}:${pair.modelA.modelId}:${pair.modelB.modelId}`;
}
