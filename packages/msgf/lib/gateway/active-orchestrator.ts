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
 * Phase 2 Active Governance Orchestrator — policy router for x-msgf-mode: active.
 *
 * Launch scope: hash completion cache + state-gate prune + sharded single-model
 * upstream. Dual/TRI chat wire synthesis and embedding semantic cache are out.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getGatewayCompletionCache,
  setGatewayCompletionCache,
} from "@/lib/gateway/completion-cache";
import {
  applyStateGatingToPromptIR,
  assessGatewayDrift,
  formatResponseFromPromptIR,
  parsePromptIR,
  rebuildProviderBody,
  type PromptIR,
} from "@/lib/gateway/prompt-ir";
import {
  runShadowFastPath,
  type ShadowFastPathResult,
} from "@/lib/gateway/shadow-fast-path";
import { resolveTenantActivePolicy } from "@/lib/gateway/tenant-policy";
import type { CapturedProviderUsage, MsgfGatewayProvider } from "@/lib/gateway/types";
import { MSGF_PROJECT_ORIGIN_HEADER } from "@/lib/msgf-http-headers";
import {
  recordProvenAvoidance,
  type ProvenAvoidanceRecord,
} from "@/lib/services/proven-savings";
import { getRollingConvergeBaselineTokens } from "@/lib/services/provider-usage-meter";

function auditHeaders(params: {
  routing: string;
  tokensSaved: number;
  cacheHit: boolean;
}): Record<string, string> {
  return {
    "x-msgf-routing": params.routing,
    "x-msgf-tokens-saved": String(Math.max(0, Math.floor(params.tokensSaved))),
    "x-msgf-cache-hit": params.cacheHit ? "1" : "0",
  };
}

function withAuditHeaders(
  response: Response,
  headers: Record<string, string>
): Response {
  const out = new Headers(response.headers);
  for (const [k, v] of Object.entries(headers)) {
    out.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: out,
  });
}

async function recordGatewayProven(params: {
  tenantId: string;
  reason: ProvenAvoidanceRecord["reason"];
  tokensAvoided: number;
  baselineTokens: number;
  localTokens: number;
  projectOrigin?: string;
  admin?: SupabaseClient | null;
  promptHash?: string;
  endpoint?: string;
  provider?: string;
}): Promise<void> {
  if (params.tokensAvoided <= 0) return;
  await recordProvenAvoidance(
    {
      tenant_id: params.tenantId,
      reason: params.reason,
      tokens_avoided: params.tokensAvoided,
      baseline_tokens: params.baselineTokens,
      local_tokens: params.localTokens,
      evidence: "proven_avoidance",
      baseline_source:
        params.baselineTokens > 0 ? "rolling_metered_median" : "none",
      sample_count: params.baselineTokens > 0 ? 1 : 0,
      routing_strategy: params.reason,
      prompt_hash: params.promptHash,
      endpoint: params.endpoint,
      provider: params.provider,
    },
    {
      projectOrigin: params.projectOrigin,
      admin: params.admin,
    }
  );
}

/**
 * Active path entry — replaces pass-through-only Phase 1 behavior.
 */
export async function runActiveOrchestrator(params: {
  req: Request;
  provider: MsgfGatewayProvider;
  upstreamPath: string;
  upstreamApiKey: string;
  rawBody: string;
  parsedBody: unknown;
  promptText: string;
  model: string;
  tenantId: string;
  endpointLabel: string;
  admin: SupabaseClient | null;
}): Promise<ShadowFastPathResult> {
  const policy = resolveTenantActivePolicy(params.tenantId, {
    headerAggressiveness: params.req.headers.get("x-msgf-active-aggressiveness"),
  });

  const projectOrigin =
    params.req.headers.get(MSGF_PROJECT_ORIGIN_HEADER)?.trim() || null;

  try {
    let ir = parsePromptIR(params.provider, params.parsedBody, projectOrigin);

    // Step A — hash completion cache
    const cached = await getGatewayCompletionCache(
      params.tenantId,
      ir.promptHash,
      policy.active_aggressiveness
    );
    if (cached) {
      const baseline = await getRollingConvergeBaselineTokens(params.tenantId, 1);
      const tokensSaved = Math.max(
        0,
        (baseline?.tokens ?? Math.ceil(params.promptText.length / 4)) -
          Math.ceil(cached.text.length / 4)
      );
      const avoided = tokensSaved || Math.ceil(params.promptText.length / 4);
      void recordGatewayProven({
        tenantId: params.tenantId,
        reason: "gateway_cache_hit",
        tokensAvoided: avoided,
        baselineTokens: baseline?.tokens ?? Math.ceil(params.promptText.length / 4),
        localTokens: Math.ceil(cached.text.length / 4),
        projectOrigin: projectOrigin ?? undefined,
        admin: params.admin,
        promptHash: ir.promptHash,
        endpoint: params.endpointLabel,
        provider: params.provider,
      });

      const response = formatResponseFromPromptIR(
        ir,
        { text: cached.text, model: cached.model || ir.model },
        auditHeaders({
          routing: "SEMANTIC_CACHE_HIT",
          tokensSaved: avoided,
          cacheHit: true,
        })
      );

      const usage: CapturedProviderUsage = {
        input_tokens: 0,
        output_tokens: Math.max(1, Math.floor(cached.text.length / 4)),
        total_tokens: Math.max(1, Math.floor(cached.text.length / 4)),
        usage_source: "provider",
        model: cached.model || ir.model,
      };

      return {
        response,
        usagePromise: Promise.resolve(usage),
        skipShadowEval: false,
        skipBackgroundMeter: true,
        promptHash: ir.promptHash,
        routing: "SEMANTIC_CACHE_HIT",
        tokensSaved: avoided,
      };
    }

    // Step B — state-gating
    const gated = applyStateGatingToPromptIR(ir);
    ir = gated.ir;
    const gateSaved = Math.max(0, gated.tokensBefore - gated.tokensAfter);

    if (policy.active_aggressiveness === "cache-only") {
      return await passThroughSharded({
        ...params,
        ir,
        routing: gated.applied ? "STATE_GATED_PASSTHROUGH" : "PASSTHROUGH",
        tokensSaved: gateSaved,
        reason: gated.applied ? "gateway_state_gate" : undefined,
      });
    }

    // Step C — drift classification (+ fitness feedback: prefer Small Brain on over-provision)
    const drift = assessGatewayDrift(ir);
    let preferSmallFromFitness = false;
    if (params.admin) {
      try {
        const { listModelFitnessRollups, fitnessSuggestsSmallBrain } = await import(
          "@/lib/services/model-fitness"
        );
        const rows = await listModelFitnessRollups(params.admin, {
          tenant_id: params.tenantId,
          prompt_class: "gateway",
          limit: 8,
        });
        const forModel = rows.find((r) => r.model_id === ir.model) ?? rows[0];
        if (forModel && fitnessSuggestsSmallBrain(forModel)) {
          preferSmallFromFitness = true;
        }
      } catch {
        /* fitness read must never block gateway */
      }
    }
    const wantConsensus =
      policy.active_aggressiveness === "full-consensus" &&
      drift.escalate &&
      !preferSmallFromFitness;

    // Step D — sharded single-model upstream
    const routing = wantConsensus
      ? "STATE_GATED_CONVERGE"
      : gated.applied
        ? drift.escalate && !preferSmallFromFitness
          ? "STATE_GATED_ESCALATE_UPSTREAM"
          : "STATE_GATED_SMALL_BRAIN"
        : "SMALL_BRAIN_UPSTREAM";

    return await passThroughSharded({
      ...params,
      ir,
      routing,
      tokensSaved: gateSaved,
      reason: gated.applied ? "gateway_state_gate" : "gateway_small_brain",
      cacheOnSuccess: true,
      aggressiveness: policy.active_aggressiveness,
    });
  } catch (e) {
    console.warn("[active-orchestrator] falling back to pass-through:", e);
    if (!policy.passthrough_fallback) {
      throw e;
    }
    const fast = await runShadowFastPath({
      req: params.req,
      provider: params.provider,
      upstreamPath: params.upstreamPath,
      upstreamApiKey: params.upstreamApiKey,
      rawBody: params.rawBody,
      parsedBody: params.parsedBody,
      promptText: params.promptText,
      model: params.model,
    });
    return {
      ...fast,
      response: withAuditHeaders(
        fast.response,
        auditHeaders({
          routing: "PASSTHROUGH_FALLBACK",
          tokensSaved: 0,
          cacheHit: false,
        })
      ),
      routing: "PASSTHROUGH_FALLBACK",
    };
  }
}

async function passThroughSharded(params: {
  req: Request;
  provider: MsgfGatewayProvider;
  upstreamPath: string;
  upstreamApiKey: string;
  promptText: string;
  model: string;
  tenantId: string;
  endpointLabel: string;
  admin: SupabaseClient | null;
  ir: PromptIR;
  routing: string;
  tokensSaved: number;
  reason?: ProvenAvoidanceRecord["reason"];
  cacheOnSuccess?: boolean;
  aggressiveness?: import("@/lib/gateway/tenant-policy").ActiveAggressiveness;
}): Promise<ShadowFastPathResult> {
  const bodyObj = rebuildProviderBody(params.ir);
  const rawBody = JSON.stringify(bodyObj);

  if (params.reason && params.tokensSaved > 0) {
    void recordGatewayProven({
      tenantId: params.tenantId,
      reason: params.reason,
      tokensAvoided: params.tokensSaved,
      baselineTokens: params.tokensSaved,
      localTokens: 0,
      projectOrigin: params.ir.project_origin,
      admin: params.admin,
      promptHash: params.ir.promptHash,
      endpoint: params.endpointLabel,
      provider: params.provider,
    });
  }

  const fast = await runShadowFastPath({
    req: params.req,
    provider: params.provider,
    upstreamPath: params.upstreamPath,
    upstreamApiKey: params.upstreamApiKey,
    rawBody,
    parsedBody: bodyObj,
    promptText: params.promptText,
    model: params.model,
  });

  if (params.cacheOnSuccess && params.aggressiveness && !params.ir.stream) {
    void (async () => {
      try {
        const clone = fast.response.clone();
        const text = await clone.text();
        const json = JSON.parse(text) as Record<string, unknown>;
        let assistant = "";
        if (params.provider === "openai") {
          const choices = json.choices as
            | Array<{ message?: { content?: string } }>
            | undefined;
          assistant = choices?.[0]?.message?.content ?? "";
        } else {
          const content = json.content as
            | Array<{ type?: string; text?: string }>
            | undefined;
          assistant =
            content
              ?.filter((c) => c.type === "text")
              .map((c) => c.text ?? "")
              .join("") ?? "";
        }
        if (assistant.trim()) {
          await setGatewayCompletionCache(
            params.tenantId,
            params.ir.promptHash,
            params.aggressiveness!,
            { text: assistant, model: params.model }
          );
        }
      } catch {
        /* ignore cache warm failures */
      }
    })();
  }

  return {
    ...fast,
    response: withAuditHeaders(
      fast.response,
      auditHeaders({
        routing: params.routing,
        tokensSaved: params.tokensSaved,
        cacheHit: false,
      })
    ),
    promptHash: params.ir.promptHash,
    routing: params.routing,
    tokensSaved: params.tokensSaved,
  };
}
