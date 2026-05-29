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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * Record estimated token savings from MSGF Pulse routing into eco rollups.
 */

import { ecoAggregatorClient } from "@/lib/services/EcoAggregatorClient";
import { extractProjectOriginFromPulseBody } from "@/lib/utils/pulse-eco-context";
import {
  compareTokenUsage,
  estimateMsgfRoutedTokens,
  estimateNaiveUngatedTokens,
} from "@/lib/services/token-usage-estimate";

export type PulseEcoSavingsInput = {
  tenantId: string;
  entityId: string;
  routing: string;
  pulseText: string;
  keystrokeCount?: number;
  authorHalTrusted?: boolean;
  rawBody?: unknown;
};

export function estimatePulseRoutingTokenSavings(params: {
  routing: string;
  contentChars: number;
  keystrokeCount?: number;
  authorHalTrusted?: boolean;
}): {
  tokens_saved: number;
  without_msgf: number;
  with_msgf: number;
  savings_pct: number;
} {
  const before = estimateNaiveUngatedTokens({
    contentChars: params.contentChars,
    keystrokeCount: params.keystrokeCount ?? 0,
    packetCount: 1,
  });
  const after = estimateMsgfRoutedTokens({
    contentChars: params.contentChars,
    keystrokeCount: params.keystrokeCount ?? 0,
    packetCount: 1,
    routing: params.routing,
    authorHalTrusted: params.authorHalTrusted,
  });
  const cmp = compareTokenUsage(before, after);
  return {
    tokens_saved: cmp.tokens_saved,
    without_msgf: before.tokens,
    with_msgf: after.tokens,
    savings_pct: cmp.savings_pct,
  };
}

/**
 * Fire-and-forget eco rollup for local_gateway / bypass (and optional global delta).
 */
export function recordPulseEcoSavings(input: PulseEcoSavingsInput): void {
  const contentChars = input.pulseText?.length ?? 0;
  const { tokens_saved } = estimatePulseRoutingTokenSavings({
    routing: input.routing,
    contentChars,
    keystrokeCount: input.keystrokeCount,
    authorHalTrusted: input.authorHalTrusted,
  });

  if (tokens_saved <= 0) return;

  const projectOrigin =
    extractProjectOriginFromPulseBody(input.rawBody) ?? input.tenantId.trim();

  void ecoAggregatorClient.sendGlobalTelemetryPayload(input.tenantId, tokens_saved, {
    userId: input.entityId,
    projectOrigin,
  });
}
