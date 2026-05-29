/**
 * POST /api/msgf/confirm-pack — verify pack in Redis + audit guided session.
 */

import { NextRequest, NextResponse } from "next/server";

import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { ConfirmPackBodySchema } from "@/lib/schemas/prompt-optimizer";
import { IdePackAuthError, resolveIdePackActor } from "@/lib/services/ide-pack-auth";
import {
  addContextSavingsTokens,
  getPackFromRedis,
  incrementGuidedSession,
  insertContextPackTransaction,
} from "@/lib/services/pack-registry";
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = ConfirmPackBodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const tenantKey = sanitizeTenantScope(parsed.data.tenantKey);
    const { admin, token, entityId } = await resolveIdePackActor(req, tenantKey);

    const pack = await getPackFromRedis(parsed.data.packId);
    if (!pack) {
      return json(
        req,
        { ok: false, error: "Pack not found or expired (24h TTL)." },
        { status: 404 }
      );
    }

    if (sanitizeTenantScope(pack.tenantKey) !== tenantKey) {
      return json(
        req,
        { ok: false, error: "Pack tenant does not match request." },
        { status: 403 }
      );
    }

    const contextTokensSaved = Math.max(
      0,
      Math.floor((pack.naiveCharCount - pack.shardedCharCount) / 4)
    );

    const guidedCount = await incrementGuidedSession(tenantKey);
    await addContextSavingsTokens(tenantKey, contextTokensSaved);

    const audit = await insertContextPackTransaction({
      admin,
      packId: pack.packId,
      tenantKey,
      entityId,
      userId: token.user_id,
      naiveCharCount: pack.naiveCharCount,
      shardedCharCount: pack.shardedCharCount,
      userIntent: pack.userIntent,
    });

    return json(req, {
      ok: true,
      packId: pack.packId,
      guided_sessions_24h: guidedCount,
      context_savings_tokens: contextTokensSaved,
      audit_ok: audit.ok,
      audit_warning: audit.ok ? undefined : audit.error,
    });
  } catch (e) {
    if (e instanceof IdePackAuthError) {
      return json(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "confirm-pack failed";
    console.error("[confirm-pack]", e);
    return json(req, { ok: false, error: msg }, { status: 500 });
  }
}
