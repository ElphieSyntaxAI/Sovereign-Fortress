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
 * Async Shadow Eval — simulate MSGF optimization without blocking the live provider path.
 * Results are projected only (never feed proven eco).
 */

import { createHash } from "node:crypto";

import {
  buildConvergeCacheRedisKey,
  computeConvergeContentHash,
} from "@/lib/services/converge-cache";
import { redisGet, redisSet } from "@/lib/redis";
import { getRollingConvergeBaselineTokens } from "@/lib/services/provider-usage-meter";
import {
  MSGF_LOCAL_GATEWAY_BASE_TOKENS,
  MSGF_NAIVE_DUAL_CONVERGE_TOKENS,
} from "@/lib/services/token-usage-estimate";
import { writeShadowEvaluationLog } from "@/lib/shadow-eval/shadow-ledger";
import { markShadowTrialFirstEval } from "@/lib/services/shadow-trial";
import {
  estimateCostUsd,
  splitTotalTokens,
} from "@/lib/shadow-eval/shadow-pricing";
import {
  classifyShadowPromptSignals,
  pickShadowRecommendedAction,
} from "@/lib/shadow-eval/shadow-proof";
import type {
  CapturedProviderUsage,
  MsgfGatewayMode,
  MsgfGatewayProvider,
  ShadowEvaluationLog,
  ShadowRecommendedAction,
} from "@/lib/gateway/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ShadowEvalInput = {
  tenantId: string;
  endpoint: string;
  provider: MsgfGatewayProvider;
  mode: MsgfGatewayMode;
  stream: boolean;
  model: string;
  promptText: string;
  usage: CapturedProviderUsage;
  admin?: SupabaseClient | null;
};

function promptHash(text: string): string {
  return createHash("sha256").update(text.slice(0, 32_768), "utf8").digest("hex");
}

function estimateStateGatingReduction(promptChars: number): number {
  // Large prompts benefit more from sharding / pack context (P5-style).
  if (promptChars < 2_000) return 0.05;
  if (promptChars < 8_000) return 0.18;
  if (promptChars < 32_000) return 0.32;
  return 0.45;
}

function wouldPreferSmallBrain(promptChars: number, promptText: string): boolean {
  const lower = promptText.toLowerCase();
  const escalateHints =
    /\b(refactor entire|architecture|security audit|production incident|migrate database)\b/.test(
      lower
    );
  if (escalateHints) return false;
  return promptChars < 12_000;
}

function shadowSimCacheKey(tenantId: string, promptText: string): string {
  const contentHash = computeConvergeContentHash({ pulseText: promptText });
  return buildConvergeCacheRedisKey(tenantId, contentHash, "shadow_proxy:sim");
}

async function probeSemanticCacheHit(
  tenantId: string,
  promptText: string
): Promise<boolean> {
  try {
    const hit = await redisGet(shadowSimCacheKey(tenantId, promptText));
    return Boolean(hit?.trim());
  } catch {
    return false;
  }
}

/** Warm the sim cache so the next identical prompt is a counted duplicate / cache hit. */
async function warmSemanticCache(tenantId: string, promptText: string): Promise<void> {
  try {
    await redisSet(shadowSimCacheKey(tenantId, promptText), "1", 86_400);
  } catch {
    /* shadow eval must never throw */
  }
}

export async function processShadowEvaluation(
  input: ShadowEvalInput
): Promise<ShadowEvaluationLog> {
  const promptText = input.promptText || "";
  const promptChars = promptText.length;
  const actualTokens = Math.max(0, input.usage.total_tokens);
  const split =
    input.usage.input_tokens + input.usage.output_tokens > 0
      ? { input: input.usage.input_tokens, output: input.usage.output_tokens }
      : splitTotalTokens(actualTokens);

  const actualCostUSD = estimateCostUsd({
    provider: input.provider,
    model: input.model || input.usage.model,
    inputTokens: split.input,
    outputTokens: split.output,
  });

  const cacheHit = await probeSemanticCacheHit(input.tenantId, promptText);
  const signals = classifyShadowPromptSignals(promptText);
  const stateGateReduction = estimateStateGatingReduction(promptChars);
  const smallBrain = wouldPreferSmallBrain(promptChars, promptText);

  let projectedTokens = actualTokens;
  let fallbackAction: ShadowRecommendedAction = "KEEP_AS_IS";

  if (cacheHit) {
    projectedTokens = Math.max(0, Math.floor(actualTokens * 0.02));
    fallbackAction = "ENABLE_SEMANTIC_CACHE";
  } else if (smallBrain) {
    const baseline = await getRollingConvergeBaselineTokens(input.tenantId, 2);
    const convergeCost =
      baseline && baseline.tokens > 0 ? baseline.tokens : MSGF_NAIVE_DUAL_CONVERGE_TOKENS;
    const localCost =
      MSGF_LOCAL_GATEWAY_BASE_TOKENS + Math.floor(promptChars / 4) * (1 - stateGateReduction);
    // If unoptimized path looks like full CONVERGE-class spend, project local.
    if (actualTokens >= convergeCost * 0.5 || actualTokens > localCost * 2) {
      projectedTokens = Math.max(1, Math.floor(localCost));
      fallbackAction =
        stateGateReduction >= 0.18 ? "ENABLE_STATE_GATING" : "ROUTE_SMALL_BRAIN";
    } else if (stateGateReduction >= 0.18) {
      projectedTokens = Math.max(
        1,
        Math.floor(actualTokens * (1 - stateGateReduction))
      );
      fallbackAction = "ENABLE_STATE_GATING";
    }
  } else if (stateGateReduction >= 0.18) {
    projectedTokens = Math.max(1, Math.floor(actualTokens * (1 - stateGateReduction)));
    fallbackAction = "ENABLE_STATE_GATING";
  }

  const recommendedAction = pickShadowRecommendedAction({
    cacheHit,
    signals,
    fallback: fallbackAction,
  });

  const projSplit = splitTotalTokens(projectedTokens);
  const projectedCostUSD = estimateCostUsd({
    provider: input.provider,
    model: input.model || input.usage.model,
    inputTokens: projSplit.input,
    outputTokens: projSplit.output,
  });

  const savingsPotentialUSD = Math.max(
    0,
    Math.round((actualCostUSD - projectedCostUSD) * 1_000_000) / 1_000_000
  );

  const log: ShadowEvaluationLog = {
    tenantId: input.tenantId,
    endpoint: input.endpoint,
    provider: input.provider,
    mode: input.mode,
    stream: input.stream,
    promptHash: promptHash(promptText),
    actualTokens,
    actualCostUSD,
    projectedTokens,
    projectedCostUSD,
    savingsPotentialUSD,
    recommendedAction,
    usageSource: input.usage.usage_source,
    model: input.model || input.usage.model || "unknown",
    timestamp: Date.now(),
  };

  await writeShadowEvaluationLog(input.admin ?? null, log);
  if (input.admin) {
    try {
      await markShadowTrialFirstEval(input.admin, log.tenantId);
    } catch (e) {
      console.warn("[shadow-eval] first-eval clock failed:", e);
    }
  }
  await warmSemanticCache(input.tenantId, promptText);
  return log;
}
