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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Record Pulse routing savings — estimate for ops dashboards; proven eco only
 * when a metered CONVERGE baseline exists.
 */

import { extractProjectOriginFromPulseBody } from "@/lib/utils/pulse-eco-context";
import {
  compareTokenUsage,
  estimateMsgfRoutedTokens,
  estimateNaiveUngatedTokens,
} from "@/lib/services/token-usage-estimate";
import {
  computeProvenPulseAvoidance,
  recordEstimatedSavingsTokens,
  recordProvenAvoidance,
} from "@/lib/services/proven-savings";

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
 * Fire-and-forget: ops estimate always; eco rollup only when proveable.
 */
export function recordPulseEcoSavings(input: PulseEcoSavingsInput): void {
  const contentChars = input.pulseText?.length ?? 0;
  const { tokens_saved } = estimatePulseRoutingTokenSavings({
    routing: input.routing,
    contentChars,
    keystrokeCount: input.keystrokeCount,
    authorHalTrusted: input.authorHalTrusted,
  });

  if (tokens_saved > 0) {
    void recordEstimatedSavingsTokens(input.tenantId, tokens_saved);
  }

  const projectOrigin =
    extractProjectOriginFromPulseBody(input.rawBody) ?? input.tenantId.trim();

  void (async () => {
    const proven = await computeProvenPulseAvoidance({
      tenantId: input.tenantId,
      routing: input.routing,
      contentChars,
    });
    if (!proven) return;
    await recordProvenAvoidance(proven, {
      userId: input.entityId,
      projectOrigin,
    });
  })();
}
