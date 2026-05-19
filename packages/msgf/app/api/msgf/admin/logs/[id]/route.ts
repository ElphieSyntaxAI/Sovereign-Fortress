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
 * Distribution Build ID: MSGF-463028d-20260519T150411Z-internal
 */
import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  assertOperatorMayActAsEntity,
  MsgfOperatorGateError,
  resolveDashboardOperator,
} from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { getAdminNarrativeLogById } from "@/lib/services/msgf-admin-logs";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * GET /api/msgf/admin/logs/:id — full narrative log for HITL ops review.
 * Requires service-role Bearer. Returns keystrokes_plain_text + models_disagree snapshot.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(
        req,
        { ok: false, error: "Developers cannot load admin narrative logs." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const logId = id?.trim();
    if (!logId) {
      return adminJson(req, { ok: false, error: "Log id required." }, { status: 400 });
    }

    const log = await getAdminNarrativeLogById({ adminSupabase: admin, id: logId });

    if (!log) {
      return adminJson(req, { ok: false, error: "Narrative log not found." }, { status: 404 });
    }

    const actorId = log.actor_id?.trim();
    if (actorId) {
      await assertOperatorMayActAsEntity(admin, op, actorId);
    }

    return adminJson(req, { ok: true, log });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    if (e instanceof MsgfOperatorGateError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to load narrative log.";
    console.error("[admin/logs/:id] GET", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
