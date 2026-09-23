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
import type { SupabaseClient } from "@supabase/supabase-js";

import { CryptoService } from "@/lib/crypto/CryptoService";
import type { ShadowFastPathResult } from "@/lib/gateway/shadow-fast-path";
import type { MSGFConsensusConfig } from "@/lib/services/consensus/msgf-consensus-config";
import { dispatchCustomEndpoints } from "@/lib/services/model-routing/custom-endpoint";
import {
  arbitrationPendingBody,
  buildHitlArbitrationItem,
  classifyRoutingDrift,
  provenTokensFromEcoDelta,
  routeWithinPreset,
  type PresetId,
} from "@/lib/services/model-routing/preset-router";
import type { StoredCustomEndpoint } from "@/lib/services/model-routing/types";
import {
  getTenantConsensusConfig,
  readStoredEcoEndpointsForScope,
  readStoredReasoningEndpointForScope,
} from "@/lib/services/tenant-consensus-config";

function asPreset(profileId: string | undefined): PresetId {
  if (
    profileId === "solo_fast" ||
    profileId === "balanced_dual" ||
    profileId === "bias_mitigated_dual" ||
    profileId === "gemini_grok_dual" ||
    profileId === "tri_tribunal" ||
    profileId === "custom_byok" ||
    profileId === "eco_trio"
  ) {
    return profileId;
  }
  return "balanced_dual";
}

function hitlResult(params: {
  preset: PresetId;
  projectOrigin: string;
  promptHash?: string;
}): ShadowFastPathResult {
  const secret =
    process.env.MSGF_SKIP_AUDIT_SECRET?.trim() ||
    process.env.MSGF_OPS_CRON_SECRET?.trim() ||
    "msgf-hitl";
  const item = buildHitlArbitrationItem({
    preset: params.preset,
    projectOrigin: params.projectOrigin,
    secret,
  });
  const response = new Response(arbitrationPendingBody(item), {
    status: 202,
    headers: {
      "content-type": "application/json",
      "x-msgf-routing": item.routing,
    },
  });
  return {
    response,
    usagePromise: Promise.resolve({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      usage_source: "estimated",
      model: "hitl",
    }),
    skipShadowEval: true,
    skipBackgroundMeter: true,
    promptHash: params.promptHash,
    routing: item.routing,
    tokensSaved: 0,
  };
}

export async function dispatchStoredEcoEndpoints(params: {
  config: MSGFConsensusConfig;
  promptChars: number;
  logicDriftScore?: number;
  p1Risk?: boolean;
  parsedBody: unknown;
  storedEndpoints?: StoredCustomEndpoint[];
  reasoningEndpoint?: StoredCustomEndpoint | null;
  fetchImpl?: typeof fetch;
  cloudRun?: boolean;
}): Promise<{ response: Response; tokensSaved: number; routing: string } | { hitl: true; preset: PresetId }> {
  const preset = asPreset(params.config.profileId);
  const band = classifyRoutingDrift({
    promptChars: params.promptChars,
    logicDriftScore: params.logicDriftScore,
    p1Risk: params.p1Risk,
  });
  const stored: StoredCustomEndpoint[] = params.storedEndpoints ?? [];
  const decision = routeWithinPreset({
    preset,
    band,
    ecoEndpoints: stored,
    reasoningEndpoint: params.reasoningEndpoint,
  });
  if (decision.action === "hitl") return { hitl: true, preset: decision.preset };
  if (decision.action !== "dispatch" || preset !== "eco_trio" || !decision.endpoints?.length) {
    return { hitl: true, preset };
  }
  const dispatched = await dispatchCustomEndpoints({
    gates: { p1Pass: true, cacheHit: false, swarmAbort: false, p6Pass: true },
    endpoints: decision.endpoints,
    parsedBody: params.parsedBody,
    fetchImpl: params.fetchImpl,
    cloudRun: params.cloudRun,
    resolveApiKey: async (endpoint) => {
      if (!endpoint.apiKeyCipher) return null;
      return CryptoService.decryptKey(endpoint.apiKeyCipher);
    },
  });
  const localChars = Math.max(1, Math.ceil(params.promptChars / 4));
  const usedReasoning =
    band === "medium" &&
    Boolean(params.reasoningEndpoint?.useForReasoning) &&
    decision.endpoints[0]?.providerId === params.reasoningEndpoint?.providerId;
  return {
    response: dispatched.response,
    tokensSaved: provenTokensFromEcoDelta(params.promptChars, localChars),
    routing: usedReasoning
      ? "ECO_REASONING_MEDIUM"
      : band === "low"
        ? "ECO_TRIO_LOW"
        : "ECO_TRIO_MEDIUM",
  };
}

export async function maybeRoutePreset(params: {
  admin: SupabaseClient | null;
  tenantId: string;
  projectOrigin?: string;
  promptText: string;
  logicDriftScore: number;
  p1Risk: boolean;
  parsedBody: unknown;
  promptHash?: string;
}): Promise<ShadowFastPathResult | null> {
  if (!params.admin) return null;
  const config = await getTenantConsensusConfig({
    admin: params.admin,
    tenantId: params.tenantId,
    projectOrigin: params.projectOrigin,
  });
  const preset = asPreset(config.profileId);
  const band = classifyRoutingDrift({
    promptChars: params.promptText.length,
    logicDriftScore: params.logicDriftScore,
    p1Risk: params.p1Risk,
  });
  const decision = routeWithinPreset({
    preset,
    band,
    ecoEndpoints: (config.customEcoEndpoints ?? []).map((endpoint) => ({ ...endpoint })),
    reasoningEndpoint: config.customReasoningEndpoint
      ? { ...config.customReasoningEndpoint }
      : null,
  });
  if (decision.action === "frontier") return null;
  if (decision.action === "hitl") {
    return hitlResult({
      preset: decision.preset,
      projectOrigin: params.projectOrigin ?? "",
      promptHash: params.promptHash,
    });
  }
  if (preset !== "eco_trio") return null;
  const stored = await readStoredEcoEndpointsForScope({
    admin: params.admin,
    tenantId: params.tenantId,
    projectOrigin: params.projectOrigin,
  });
  const reasoning = await readStoredReasoningEndpointForScope({
    admin: params.admin,
    tenantId: params.tenantId,
    projectOrigin: params.projectOrigin,
  });
  let eco: Awaited<ReturnType<typeof dispatchStoredEcoEndpoints>>;
  try {
    eco = await dispatchStoredEcoEndpoints({
      config,
      storedEndpoints: stored,
      reasoningEndpoint: reasoning,
      promptChars: params.promptText.length,
      logicDriftScore: params.logicDriftScore,
      p1Risk: params.p1Risk,
      parsedBody: params.parsedBody,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "custom endpoint rejected";
    return {
      response: new Response(JSON.stringify({ error: { message, type: "invalid_request_error" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
      usagePromise: Promise.resolve({
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        usage_source: "estimated",
        model: "eco_trio",
      }),
      skipShadowEval: true,
      skipBackgroundMeter: true,
      promptHash: params.promptHash,
      routing: "ECO_TRIO_REJECTED",
      tokensSaved: 0,
    };
  }
  if ("hitl" in eco) {
    return hitlResult({
      preset: eco.preset,
      projectOrigin: params.projectOrigin ?? "",
      promptHash: params.promptHash,
    });
  }
  return {
    response: eco.response,
    usagePromise: Promise.resolve({
      input_tokens: Math.ceil(params.promptText.length / 4),
      output_tokens: 0,
      total_tokens: Math.ceil(params.promptText.length / 4),
      usage_source: "estimated",
      model: "eco_trio",
    }),
    skipShadowEval: true,
    skipBackgroundMeter: false,
    promptHash: params.promptHash,
    routing: eco.routing,
    tokensSaved: eco.tokensSaved,
  };
}
