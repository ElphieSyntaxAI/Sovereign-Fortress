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
 * Shared OpenAI/Anthropic-compatible gateway handler (Shadow Proxy + Active Governance).
 */

import { after } from "next/server";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  authenticateGatewayKey,
  extractMsgfKeyFromRequest,
  extractUpstreamApiKey,
  GatewayAuthError,
} from "@/lib/gateway/auth";
import { runActiveOrchestrator } from "@/lib/gateway/active-orchestrator";
import {
  MSGF_MODE_HEADER,
  type GatewayResolvedAuth,
  type MsgfGatewayMode,
  type MsgfGatewayProvider,
} from "@/lib/gateway/types";
import {
  extractModelFromBody,
  extractPromptTextFromBody,
  isStreamingBody,
  runShadowFastPath,
} from "@/lib/gateway/shadow-fast-path";
import { processShadowEvaluation } from "@/lib/shadow-eval/shadow-evaluator";
import { recordMeteredProviderUsage } from "@/lib/services/provider-usage-meter";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_PARENT_AGENT_ID_HEADER,
  MSGF_PROMPT_HASH_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import {
  evaluateAndMaybeAbortSwarm,
  hashMandate,
  parseAgentIdentityFromHeaders,
  type SwarmAgentIdentity,
} from "@/lib/services/swarm-guard";

function parseMode(req: NextRequest): MsgfGatewayMode {
  const raw = req.headers.get(MSGF_MODE_HEADER)?.trim().toLowerCase();
  if (raw === "active") return "active";
  return "shadow";
}

export class GatewayHttpError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super("gateway_error");
    this.status = status;
    this.body = body;
  }
}

export async function resolveGatewayAuth(
  req: NextRequest,
  provider: MsgfGatewayProvider
): Promise<GatewayResolvedAuth> {
  const mode = parseMode(req);
  const upstreamApiKey = extractUpstreamApiKey(req, provider);
  if (!upstreamApiKey) {
    throw new GatewayHttpError(401, {
      error: {
        message:
          provider === "anthropic"
            ? "Missing Anthropic x-api-key (pass-through to upstream)."
            : "Missing OpenAI Authorization Bearer key (pass-through to upstream).",
        type: "authentication_error",
        code: "upstream_key_required",
      },
    });
  }

  const msgfKey = extractMsgfKeyFromRequest(req);
  const rawTenant =
    req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    null;

  try {
    const keyAuth = await authenticateGatewayKey(msgfKey, rawTenant, req);
    const requested = mode;
    const resolvedMode = keyAuth.forceShadowMode ? "shadow" : requested;
    return {
      tenantId: keyAuth.tenantId,
      msgfKeyPresent: keyAuth.msgfKeyPresent,
      upstreamApiKey,
      mode: resolvedMode,
    };
  } catch (e) {
    if (e instanceof GatewayAuthError) {
      throw new GatewayHttpError(e.status, e.body);
    }
    throw e;
  }
}

function jsonError(err: GatewayHttpError): Response {
  return new Response(JSON.stringify(err.body), {
    status: err.status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleProviderGateway(params: {
  req: NextRequest;
  provider: MsgfGatewayProvider;
  upstreamPath: string;
  endpointLabel: string;
}): Promise<Response> {
  let auth: GatewayResolvedAuth;
  try {
    auth = await resolveGatewayAuth(params.req, params.provider);
  } catch (e) {
    if (e instanceof GatewayHttpError) return jsonError(e);
    throw e;
  }

  const rawBody = await params.req.text();
  let parsedBody: unknown = {};
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return new Response(
      JSON.stringify({
        error: { message: "Invalid JSON body", type: "invalid_request_error" },
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const model = extractModelFromBody(parsedBody);
  const promptText = extractPromptTextFromBody(params.provider, parsedBody);
  const stream = isStreamingBody(parsedBody);
  const entityId =
    params.req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() || auth.tenantId;
  const gwTrace =
    params.req.headers.get(MSGF_PROMPT_HASH_HEADER)?.trim()?.toLowerCase() ||
    `gw_${Date.now()}`;

  let admin: SupabaseClient | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  let swarmIdentity: SwarmAgentIdentity | null = null;

  // Phase 7/9: budget + circuit breaker must run before upstream dispatch.
  let forceFallbackSmallBrain = false;
  if (admin) {
    try {
      const { checkTenantBudgetBeforeDispatch } = await import(
        "@/lib/services/tenant-budget"
      );
      const clientPromptHashPre = params.req.headers.get(MSGF_PROMPT_HASH_HEADER)?.trim();
      const preTrace =
        clientPromptHashPre && /^[0-9a-f]{16,128}$/i.test(clientPromptHashPre)
          ? clientPromptHashPre.toLowerCase()
          : `gw_pre_${Date.now()}`;
      const budget = await checkTenantBudgetBeforeDispatch(admin, {
        tenant_id: auth.tenantId,
        estimated_cost_usd: 0.002,
        trace_id: preTrace,
        parent_agent_id: params.req.headers.get(MSGF_PARENT_AGENT_ID_HEADER),
        safety_critical: auth.mode === "active",
      });
      if (!budget.ok) {
        if (budget.action === "fallback_small_brain") {
          forceFallbackSmallBrain = true;
        } else {
          return new Response(
            JSON.stringify({
              error: {
                message: `Tenant budget / circuit blocked dispatch (${budget.reason}).`,
                type: "budget_exceeded_error",
                code: budget.reason,
              },
            }),
            {
              status: 429,
              headers: {
                "content-type": "application/json",
                "retry-after": "60",
              },
            }
          );
        }
      }
    } catch (budgetErr) {
      console.warn("[provider-gateway] pre-dispatch budget check failed:", budgetErr);
    }
  }

  try {
    const identity = parseAgentIdentityFromHeaders({
      headers: params.req.headers,
      tenantId: auth.tenantId,
      entityId,
      mandateSeed: promptText,
    });
    if (auth.mode === "active") {
      await evaluateAndMaybeAbortSwarm({
        admin,
        identity,
        traceId: gwTrace,
        product: "gateway",
        toolNameHash: model ? hashMandate(model) : null,
      });
    }
    swarmIdentity = identity;
  } catch (swarmErr) {
    if (swarmErr instanceof PulseHttpError) {
      return new Response(JSON.stringify(swarmErr.body), {
        status: swarmErr.status,
        headers: { "content-type": "application/json" },
      });
    }
    console.warn("[provider-gateway] swarm guard failed:", swarmErr);
  }

  const effectiveMode =
    forceFallbackSmallBrain && auth.mode === "active" ? "shadow" : auth.mode;

  const fast =
    effectiveMode === "active"
      ? await runActiveOrchestrator({
          req: params.req,
          provider: params.provider,
          upstreamPath: params.upstreamPath,
          upstreamApiKey: auth.upstreamApiKey,
          rawBody,
          parsedBody,
          promptText,
          model,
          tenantId: auth.tenantId,
          endpointLabel: params.endpointLabel,
          admin,
        })
      : await runShadowFastPath({
          req: params.req,
          provider: params.provider,
          upstreamPath: params.upstreamPath,
          upstreamApiKey: auth.upstreamApiKey,
          rawBody,
          parsedBody,
          promptText,
          model,
        });

  after(async () => {
    try {
      const usage = await fast.usagePromise;
      const clientPromptHash = params.req.headers.get(MSGF_PROMPT_HASH_HEADER)?.trim();
      const lineageHash =
        clientPromptHash && /^[0-9a-f]{16,128}$/i.test(clientPromptHash)
          ? clientPromptHash.toLowerCase()
          : fast.promptHash;

      if (auth.mode === "active" && !fast.skipBackgroundMeter) {
        await recordMeteredProviderUsage(
          {
            tenantId: auth.tenantId,
            purpose: "other",
            endpoint: params.endpointLabel,
            promptHash: lineageHash,
            admin,
          },
          {
            provider: params.provider === "openai" ? "openai" : "anthropic",
            model: usage.model || model,
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            total_tokens: usage.total_tokens,
          }
        );
      }

      // Non-blocking Session Replay + harm classify (plan Phase 5)
      if (admin) {
        try {
          const { emitPromptSession } = await import("@/lib/services/prompt-sessions");
          const { emitModelFitness, inferFitnessLabel } = await import(
            "@/lib/services/model-fitness"
          );
          const { recordTenantSpend } = await import("@/lib/services/tenant-budget");
          const { enqueueSiemExport } = await import("@/lib/services/siem-exporter");

          emitPromptSession(admin, {
            tenant_id: auth.tenantId,
            trace_id: lineageHash || `gw_${Date.now()}`,
            product: "gateway",
            prompt_hash: lineageHash ?? null,
            prompt_text: promptText?.slice(0, 50_000) ?? "",
            completion_text: "",
            model_provider: params.provider,
            model_id: usage.model || model,
            tokens_in: usage.input_tokens ?? 0,
            tokens_out: usage.output_tokens ?? 0,
            entity_id:
              params.req.headers.get("x-msgf-entity-id")?.trim() || auth.tenantId,
          });

          emitModelFitness(admin, {
            tenant_id: auth.tenantId,
            product: "gateway",
            purpose: effectiveMode,
            model_provider: params.provider,
            model_id: usage.model || model || "unknown",
            prompt_hash: lineageHash ?? null,
            label: inferFitnessLabel({
              usedBigBrain: effectiveMode === "active",
              lowDrift: true,
            }),
            tokens_in: usage.input_tokens ?? 0,
            tokens_out: usage.output_tokens ?? 0,
            trace_id: lineageHash ?? null,
          });

          const est =
            ((usage.input_tokens ?? 0) + (usage.output_tokens ?? 0)) * 0.000002;
          await recordTenantSpend(admin, auth.tenantId, est);

          enqueueSiemExport(admin, {
            tenant_id: auth.tenantId,
            kind: "prompt_session",
            severity: "info",
            summary: `Gateway ${effectiveMode} ${usage.model || model}`,
            trace_id: lineageHash ?? null,
          });
        } catch (bg) {
          console.warn("[provider-gateway] governance emit failed:", bg);
        }
      }

      if (!fast.skipShadowEval) {
        await processShadowEvaluation({
          tenantId: auth.tenantId,
          endpoint: params.endpointLabel,
          provider: params.provider,
          mode: effectiveMode,
          stream,
          model: usage.model || model,
          promptText,
          usage,
          admin,
          swarmIdentity,
        });
      }
    } catch (e) {
      console.warn("[provider-gateway] background eval failed:", e);
    }
  });

  return fast.response;
}
