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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import { computeConsensusAgreementScore } from "@/lib/services/consensus-output-comparison";
import {
  runTenantAnthropicValidation,
  runTenantGeminiValidation,
  DUAL_MODEL_GATEWAY_AGREEMENT_THRESHOLD,
} from "@/lib/services/dual-model-consensus-gateway";
import { resolveModelPairForTier } from "@/lib/services/converge-tier/model-pairs";
import { scrubConvergeLogText } from "@/lib/services/converge-tier/scrubber";
import type {
  ConvergeTier,
  TierConvergeAttempt,
  TierConvergeResult,
} from "@/lib/services/converge-tier/types";
import { msgfRedisKey, redisSet } from "@/lib/redis";

export const TIER_ESCALATION_ORDER: ConvergeTier[] = ["TIER_1", "TIER_2", "TIER_3"];

export type TierConvergeProvider = {
  callModel: (params: {
    provider: "openai" | "anthropic" | "google";
    modelId: string;
    prompt: string;
    geminiKey?: string;
    anthropicKey?: string;
    openaiKey?: string;
  }) => Promise<string>;
};

async function defaultProviderCall(params: {
  provider: "openai" | "anthropic" | "google";
  modelId: string;
  prompt: string;
  geminiKey?: string;
  anthropicKey?: string;
  openaiKey?: string;
}): Promise<string> {
  if (params.provider === "google" && params.geminiKey?.trim()) {
    process.env.MSGF_TENANT_VALIDATION_GEMINI_MODEL = params.modelId;
    return runTenantGeminiValidation(params.geminiKey, params.prompt);
  }
  if (params.provider === "anthropic" && params.anthropicKey?.trim()) {
    process.env.MSGF_TENANT_VALIDATION_ANTHROPIC_MODEL = params.modelId;
    return runTenantAnthropicValidation(params.anthropicKey, params.prompt);
  }
  if (params.provider === "openai" && params.openaiKey?.trim()) {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: params.openaiKey.trim() });
    const res = await client.chat.completions.create({
      model: params.modelId,
      messages: [{ role: "user", content: params.prompt }],
      max_tokens: 360,
      temperature: 0.1,
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }
  // Fallback: treat as google/anthropic via BYOK keys when provider maps loosely
  if (params.provider === "google" && params.geminiKey?.trim()) {
    return runTenantGeminiValidation(params.geminiKey, params.prompt);
  }
  if (params.anthropicKey?.trim()) {
    return runTenantAnthropicValidation(params.anthropicKey, params.prompt);
  }
  throw new Error(`No BYOK key for provider ${params.provider}`);
}

async function runDualAtTier(params: {
  tier: ConvergeTier;
  prompt: string;
  provider?: TierConvergeProvider;
  geminiKey?: string;
  anthropicKey?: string;
  openaiKey?: string;
}): Promise<TierConvergeAttempt> {
  const pair = resolveModelPairForTier(params.tier);
  const call = params.provider?.callModel ?? defaultProviderCall;

  const results = await Promise.allSettled([
    call({
      provider: pair.modelA.provider,
      modelId: pair.modelA.modelId,
      prompt: params.prompt,
      geminiKey: params.geminiKey,
      anthropicKey: params.anthropicKey,
      openaiKey: params.openaiKey,
    }),
    call({
      provider: pair.modelB.provider,
      modelId: pair.modelB.modelId,
      prompt: params.prompt,
      geminiKey: params.geminiKey,
      anthropicKey: params.anthropicKey,
      openaiKey: params.openaiKey,
    }),
  ]);

  const outA = results[0].status === "fulfilled" ? results[0].value : "";
  const outB = results[1].status === "fulfilled" ? results[1].value : "";
  const agreementScore = computeConsensusAgreementScore(outA, outB);
  const agreed = agreementScore >= DUAL_MODEL_GATEWAY_AGREEMENT_THRESHOLD;

  return {
    tier: params.tier,
    modelA: pair.modelA.modelId,
    modelB: pair.modelB.modelId,
    agreementScore,
    agreed,
  };
}

export async function recordConvergeTierTelemetry(params: {
  tenantId: string;
  projectOrigin?: string | null;
  finalTier: ConvergeTier;
  escalated: boolean;
  hitlRequired?: boolean;
}): Promise<void> {
  try {
    const key = msgfRedisKey(
      "converge-tier",
      params.tenantId,
      params.projectOrigin?.trim() || "default"
    );
    await redisSet(
      key,
      JSON.stringify({
        final_tier: params.finalTier,
        escalated: params.escalated,
        hitl_required: params.hitlRequired === true,
        ts: new Date().toISOString(),
      }),
      3600
    );
  } catch {
    /* fail-open telemetry */
  }
}

/**
 * Run tiered dual CONVERGE with escalation ladder.
 */
export async function runTieredConverge(params: {
  startTier: ConvergeTier;
  prompt: string;
  tenantId: string;
  projectOrigin?: string | null;
  provider?: TierConvergeProvider;
  geminiKey?: string;
  anthropicKey?: string;
  openaiKey?: string;
}): Promise<TierConvergeResult> {
  const attempts: TierConvergeAttempt[] = [];
  const startIdx = TIER_ESCALATION_ORDER.indexOf(params.startTier);
  const tiers = TIER_ESCALATION_ORDER.slice(Math.max(0, startIdx));

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    try {
      const attempt = await runDualAtTier({
        tier,
        prompt: params.prompt,
        provider: params.provider,
        geminiKey: params.geminiKey,
        anthropicKey: params.anthropicKey,
        openaiKey: params.openaiKey,
      });
      attempts.push(attempt);

      if (attempt.agreed) {
        await recordConvergeTierTelemetry({
          tenantId: params.tenantId,
          projectOrigin: params.projectOrigin,
          finalTier: tier,
          escalated: i > 0,
        });
        return {
          ok: true,
          finalTier: tier,
          agreementScore: attempt.agreementScore,
          resolution: scrubConvergeLogText(
            `Tier ${tier} consensus OK (score=${attempt.agreementScore.toFixed(2)})`
          ),
          attempts,
          escalated: i > 0,
        };
      }
    } catch (e) {
      const msg = scrubConvergeLogText(e instanceof Error ? e.message : "converge_failed");
      console.warn(`[converge-tier] ${tier} failed:`, msg);
    }
  }

  const finalTier = tiers[tiers.length - 1] ?? "TIER_3";
  await recordConvergeTierTelemetry({
    tenantId: params.tenantId,
    projectOrigin: params.projectOrigin,
    finalTier,
    escalated: true,
    hitlRequired: true,
  });

  return {
    ok: false,
    error: scrubConvergeLogText(`All tiers disagreed through ${finalTier}`),
    finalTier,
    attempts,
    hitlRequired: true,
    quarantineRecommended: finalTier === "TIER_3",
  };
}

export function isConvergeTierEnabled(): boolean {
  const v = process.env.MSGF_CONVERGE_TIER_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
