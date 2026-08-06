/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
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
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";

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
    return {
      tenantId: keyAuth.tenantId,
      msgfKeyPresent: keyAuth.msgfKeyPresent,
      upstreamApiKey,
      mode,
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

  let admin: SupabaseClient | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  const fast =
    auth.mode === "active"
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

      if (auth.mode === "active" && !fast.skipBackgroundMeter) {
        await recordMeteredProviderUsage(
          {
            tenantId: auth.tenantId,
            purpose: "other",
            endpoint: params.endpointLabel,
            promptHash: fast.promptHash,
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

      if (!fast.skipShadowEval) {
        await processShadowEvaluation({
          tenantId: auth.tenantId,
          endpoint: params.endpointLabel,
          provider: params.provider,
          mode: auth.mode,
          stream,
          model: usage.model || model,
          promptText,
          usage,
          admin,
        });
      }
    } catch (e) {
      console.warn("[provider-gateway] background eval failed:", e);
    }
  });

  return fast.response;
}
