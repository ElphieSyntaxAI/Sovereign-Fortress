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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Unified Provider Gateway types — OpenAI/Anthropic-compatible Shadow Proxy.
 */

export type MsgfGatewayMode = "shadow" | "active";

export type MsgfGatewayProvider = "openai" | "anthropic";

export type ShadowRecommendedAction =
  | "ENABLE_SEMANTIC_CACHE"
  | "ENABLE_STATE_GATING"
  | "ROUTE_SMALL_BRAIN"
  | "FLAG_RETRY_LOOP"
  | "FLAG_POLICY_DRIFT"
  | "FLAG_BOT_SWARM"
  | "KEEP_AS_IS";

export type ShadowUsageSource = "provider" | "estimated";

export type GatewayResolvedAuth = {
  tenantId: string;
  msgfKeyPresent: boolean;
  upstreamApiKey: string;
  mode: MsgfGatewayMode;
};

export type CapturedProviderUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  usage_source: ShadowUsageSource;
  model: string;
};

export type ShadowEvaluationLog = {
  tenantId: string;
  endpoint: string;
  provider: MsgfGatewayProvider;
  mode: MsgfGatewayMode;
  stream: boolean;
  promptHash: string;
  actualTokens: number;
  actualCostUSD: number;
  projectedTokens: number;
  projectedCostUSD: number;
  savingsPotentialUSD: number;
  recommendedAction: ShadowRecommendedAction;
  usageSource: ShadowUsageSource;
  model: string;
  timestamp: number;
  p7PromoteCount?: number;
  p7BlockCount?: number;
  p7Deferred?: Array<{
    resource_key: string;
    ledger: string;
    kind: string;
    outcome: "good" | "bad";
  }>;
};

export const MSGF_MODE_HEADER = "x-msgf-mode";
export const MSGF_KEY_HEADER = "x-msgf-key";
