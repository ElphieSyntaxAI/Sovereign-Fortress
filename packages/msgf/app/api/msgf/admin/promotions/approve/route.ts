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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveDashboardOperator } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { promoteLocalCacheToVaultCore } from "@/lib/services/global-promotion";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

const approveBodySchema = z.object({
  cache_id: z.string().uuid(),
  /** Must match the row’s `tenant_id` (dev project silo). */
  tenant_id: z.string().min(1),
  /** Optional dashboard note visible in vault narrative metadata. */
  admin_note: z.string().max(4000).optional(),
  /** Operator UUID or stable id (falls back to header / default). */
  promoted_by_actor_id: z.string().min(1).max(256).optional(),
});

/**
 * POST /api/msgf/admin/promotions/approve
 * Promotes one pending entry from `local_state_cache` into `vault_core` (global pillar_vectors).
 *
 * Auth: `Authorization: Bearer` (service role or MSGF_ADMIN_API_KEY).
 * Audit: `x-msgf-promoted-by: <operator_user_id>` (optional; overrides body.promoted_by_actor_id).
 */
export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role !== "GLOBAL_ADMIN") {
      return adminJson(
        req,
        { ok: false, error: "Promoting to global vault_core requires a global operator." },
        { status: 403 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = approveBodySchema.safeParse(json);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const headerActor = req.headers.get("x-msgf-promoted-by")?.trim();
    const promotedByActorId =
      headerActor ||
      parsed.data.promoted_by_actor_id ||
      process.env.MSGF_PROMOTION_DEFAULT_ACTOR?.trim() ||
      "msgf_service_admin";

    let result;
    try {
      result = await promoteLocalCacheToVaultCore({
        adminSupabase: admin,
        cacheId: parsed.data.cache_id,
        originatingTenantId: parsed.data.tenant_id,
        promotedByActorId,
        adminNote: parsed.data.admin_note,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Promotion failed.";
      const lower = message.toLowerCase();
      if (lower.includes("not found")) {
        return adminJson(req, { ok: false, error: message }, { status: 404 });
      }
      if (lower.includes("not pending") || lower.includes("no content")) {
        return adminJson(req, { ok: false, error: message }, { status: 409 });
      }
      throw err;
    }

    const { ok: _resultOk, ...resultBody } = result;
    return adminJson(req, {
      ok: true,
      ...resultBody,
      audit: {
        suggested_by_entity_id: result.suggested_by_entity_id,
        suggested_by_tenant_id: result.suggested_by_tenant_id,
        promoted_by_actor_id: result.promoted_by_actor_id,
        vault_narrative_log_id: result.vault_narrative_log_id,
      },
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to approve promotion.";
    console.error("[admin/promotions/approve] POST", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
