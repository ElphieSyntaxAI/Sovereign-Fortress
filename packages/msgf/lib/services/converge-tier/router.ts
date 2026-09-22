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
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  classifyCodeDelta,
  deriveCodeDeltaFromPulseContext,
  type ClassifierPathOverride,
} from "@/lib/services/converge-tier/classifier";
import { loadClassifierOverridesForCompany } from "@/lib/services/converge-tier/company-tier-overrides";
import {
  isConvergeTierEnabled,
  runTieredConverge,
  type TierConvergeProvider,
} from "@/lib/services/converge-tier/converge-runner";
import { convergeRoutingProfileForTier } from "@/lib/services/converge-tier/model-pairs";
import {
  quarantineVaultFromTierDisagreement,
  type TierQuarantineResult,
} from "@/lib/services/converge-tier/tier-quarantine";
import type {
  ClassifierResult,
  CodeDeltaPayload,
  ConvergeTier,
  TierConvergeResult,
} from "@/lib/services/converge-tier/types";

export type RouteCodeDeltaResult = {
  classification: ClassifierResult;
  converge?: TierConvergeResult;
  routingProfile: string;
  /** Set when T3 disagreement auto-quarantined Vault wins. */
  quarantine?: TierQuarantineResult;
};

export function parseForcedConvergeTierHeader(
  header: string | null | undefined
): ConvergeTier | null {
  const v = header?.trim().toUpperCase();
  if (v === "TIER_1" || v === "T1") return "TIER_1";
  if (v === "TIER_2" || v === "T2") return "TIER_2";
  if (v === "TIER_3" || v === "T3") return "TIER_3";
  return null;
}

export async function routeCodeDelta(params: {
  payload: CodeDeltaPayload;
  admin?: SupabaseClient;
  pathOverrides?: ClassifierPathOverride[];
  forcedTier?: ConvergeTier | null;
  /** When set + tier enabled, runs full tiered converge. */
  convergePrompt?: string;
  tenantId?: string;
  projectOrigin?: string | null;
  provider?: TierConvergeProvider;
  geminiKey?: string;
  anthropicKey?: string;
  openaiKey?: string;
  /** Optional lineage / known Vault ids to prefer for T3 quarantine. */
  vaultVectorIds?: string[];
  pulseTraceId?: string | null;
  entityId?: string | null;
}): Promise<RouteCodeDeltaResult> {
  let overrides = params.pathOverrides ?? [];
  if (params.admin && params.payload.companyId) {
    const companyRules = await loadClassifierOverridesForCompany(
      params.admin,
      params.payload.companyId
    );
    overrides = [...overrides, ...companyRules];
  }

  const classification = params.forcedTier
    ? {
        tier: params.forcedTier,
        riskScore: params.forcedTier === "TIER_3" ? 0.99 : 0.5,
        reasons: ["forced_tier_header"],
        durationMs: 0,
      }
    : classifyCodeDelta(params.payload, { pathOverrides: overrides });

  const routingProfile = convergeRoutingProfileForTier(classification.tier);

  if (
    !isConvergeTierEnabled() ||
    !params.convergePrompt?.trim() ||
    !params.tenantId?.trim()
  ) {
    return { classification, routingProfile };
  }

  const converge = await runTieredConverge({
    startTier: classification.tier,
    prompt: params.convergePrompt,
    tenantId: params.tenantId,
    projectOrigin: params.projectOrigin,
    provider: params.provider,
    geminiKey: params.geminiKey,
    anthropicKey: params.anthropicKey,
    openaiKey: params.openaiKey,
  });

  let quarantine: TierQuarantineResult | undefined;
  if (
    !converge.ok &&
    converge.quarantineRecommended &&
    params.admin
  ) {
    quarantine = await quarantineVaultFromTierDisagreement(params.admin, {
      tenantId: params.tenantId,
      companyId: params.payload.companyId,
      projectOrigin: params.projectOrigin ?? params.payload.projectOrigin,
      paths: params.payload.paths,
      vectorIds: params.vaultVectorIds,
      finalTier: converge.finalTier,
      attempts: converge.attempts,
      pulseTraceId: params.pulseTraceId,
      entityId: params.entityId,
    });
  }

  return { classification, converge, routingProfile, quarantine };
}

export { deriveCodeDeltaFromPulseContext };
