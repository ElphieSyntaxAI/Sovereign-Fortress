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
 * Estimates LLM token spend for "ungated" (pre-MSGF) vs MSGF-routed Author/Pulse paths.
 * Used by `scripts/track-author-msgf-token-savings.ts` and eco rollups — not billing truth.
 */

import { MSGF_CREDIT_RESERVE_CHUNK } from "@/lib/credit-reservation";
import { MSGF_PAID_INDIVIDUAL_CONVERGE_DEBIT } from "@/lib/services/paid-individual-usage";

/** One full dual-provider CONVERGE call (Gemini + Claude) — naive per-save baseline. */
export const MSGF_NAIVE_DUAL_CONVERGE_TOKENS =
  Number(process.env.MSGF_NAIVE_DUAL_CONVERGE_TOKENS?.trim()) ||
  MSGF_PAID_INDIVIDUAL_CONVERGE_DEBIT * 2;

/** Local gateway / bypass path — DEFEND + hot layer, no global CONVERGE wall clock. */
export const MSGF_LOCAL_GATEWAY_BASE_TOKENS =
  Number(process.env.MSGF_LOCAL_GATEWAY_BASE_TOKENS?.trim()) || 120;

export type MsgfPulseRoutingKind =
  | "local_gateway"
  | "converge_bypass"
  | "converge_soft_cap_degraded"
  | "converge_timeout_degraded"
  | "dual_model_local"
  | "global_converge"
  | "unknown";

/** Alias for brain-routing and dashboard modules. */
export type PulseRoutingKind = MsgfPulseRoutingKind;

export type TokenUsageEstimateInput = {
  /** Serialized pulse body or manuscript excerpt length (chars). */
  contentChars: number;
  keystrokeCount?: number;
  /** HAL chunk packets (175-word windows); naive baseline charges per packet. */
  packetCount?: number;
  routing?: string | null;
  /** When Author HAL telemetry is trusted, MSGF may skip redundant cloud checks. */
  authorHalTrusted?: boolean;
};

export type TokenUsageEstimate = {
  tokens: number;
  model: string;
  routing: MsgfPulseRoutingKind;
};

function charsToTokens(chars: number): number {
  return Math.max(0, Math.floor(chars / 4));
}

export function normalizePulseRouting(raw: string | null | undefined): MsgfPulseRoutingKind {
  const r = raw?.trim().toLowerCase() ?? "";
  if (r === "local_gateway") return "local_gateway";
  if (r === "converge_bypass") return "converge_bypass";
  if (r === "converge_soft_cap_degraded") return "converge_soft_cap_degraded";
  if (r === "converge_timeout_degraded") return "converge_timeout_degraded";
  if (r.includes("dual_model") || r === "dual_model") return "dual_model_local";
  if (r === "global_converge" || r.includes("converge")) return "global_converge";
  return "unknown";
}

/**
 * Ungated baseline: every HAL chunk / save runs full dual-model cloud CONVERGE on full context.
 */
export function estimateNaiveUngatedTokens(input: TokenUsageEstimateInput): TokenUsageEstimate {
  const packets = Math.max(1, Math.floor(input.packetCount ?? 1));
  const contextTokens = charsToTokens(input.contentChars) + Math.min(256, (input.keystrokeCount ?? 0) * 8);
  const perPacket = MSGF_NAIVE_DUAL_CONVERGE_TOKENS + contextTokens;
  return {
    tokens: perPacket * packets,
    model: "naive_dual_converge_per_packet",
    routing: "global_converge",
  };
}

/**
 * MSGF-routed estimate from Pulse `routing` (and optional Author HAL trust).
 */
export function estimateMsgfRoutedTokens(input: TokenUsageEstimateInput): TokenUsageEstimate {
  const routing = normalizePulseRouting(input.routing);
  const packets = Math.max(1, Math.floor(input.packetCount ?? 1));
  const contextTokens = charsToTokens(input.contentChars);

  if (input.authorHalTrusted && routing === "local_gateway") {
    return {
      tokens: Math.max(MSGF_LOCAL_GATEWAY_BASE_TOKENS, Math.floor(contextTokens * 0.15)) * packets,
      model: "author_hal_trusted_local",
      routing,
    };
  }

  switch (routing) {
    case "local_gateway":
    case "converge_bypass":
    case "converge_soft_cap_degraded":
    case "converge_timeout_degraded":
      return {
        tokens: (MSGF_LOCAL_GATEWAY_BASE_TOKENS + contextTokens) * packets,
        model: "local_gateway_or_bypass",
        routing,
      };
    case "dual_model_local":
      return {
        tokens: (MSGF_CREDIT_RESERVE_CHUNK + contextTokens) * packets,
        model: "tenant_dual_model_local",
        routing,
      };
    case "global_converge":
      return {
        tokens: (MSGF_NAIVE_DUAL_CONVERGE_TOKENS + contextTokens) * packets,
        model: "global_dual_converge",
        routing,
      };
    default:
      return {
        tokens: (MSGF_LOCAL_GATEWAY_BASE_TOKENS + contextTokens) * packets,
        model: "unknown_routing_conservative_local",
        routing: "unknown",
      };
  }
}

export type TokenSavingsComparison = {
  before_msgf: TokenUsageEstimate;
  after_msgf: TokenUsageEstimate;
  tokens_saved: number;
  savings_pct: number;
};

export function compareTokenUsage(
  before: TokenUsageEstimate,
  after: TokenUsageEstimate
): TokenSavingsComparison {
  const tokens_saved = Math.max(0, before.tokens - after.tokens);
  const savings_pct =
    before.tokens > 0 ? Math.round((tokens_saved / before.tokens) * 1000) / 10 : 0;
  return { before_msgf: before, after_msgf: after, tokens_saved, savings_pct };
}

/** Pull `routing` from MSGF Pulse JSON (BFF-wrapped or direct). */
export function routingFromPulseResponse(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const nested = o.msgf_pulse;
  if (nested && typeof nested === "object") {
    const fromNested = routingFromPulseResponse(nested);
    if (fromNested) return fromNested;
  }
  const data = o.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.routing === "string") return d.routing;
  }
  if (typeof o.routing === "string") return o.routing;
  return null;
}
