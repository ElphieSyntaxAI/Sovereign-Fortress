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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  assertOperatorCanAccessIncident,
  MsgfOperatorGateError,
} from "@/lib/msgf-operator-access";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  patchIncidentBodySchema,
  resolveAdminIncident,
} from "@/lib/services/admin-incident-resolve";
import { getMsgfIncidentById } from "@/lib/services/msgf-incidents";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * PATCH /api/msgf/admin/incidents/:id
 *
 * Resolves or reopens an incident. Body may include `mitigation_action` (`Session Only` | `Global Fix`).
 * On resolve: Vault arbitration + P2 education beats, then optional `msgf_rules` global mitigation.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(
        req,
        { ok: false, error: "Developers cannot resolve incidents via the admin queue." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const incidentId = id?.trim();
    if (!incidentId) {
      return adminJson(req, { ok: false, error: "Incident id required." }, { status: 400 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = patchIncidentBodySchema.safeParse(json);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await getMsgfIncidentById({ adminSupabase: admin, id: incidentId });
    if (!existing) {
      return adminJson(req, { ok: false, error: "Incident not found." }, { status: 404 });
    }

    await assertOperatorCanAccessIncident(admin, op, existing);

    const result = await resolveAdminIncident({
      adminSupabase: admin,
      incidentId,
      body: parsed.data,
      isAdmin: true,
      operator: op,
    });

    return adminJson(req, {
      ok: true,
      incident: result.incident,
      ...(result.arbitration_beat_log_id
        ? { arbitration_beat_log_id: result.arbitration_beat_log_id }
        : {}),
      ...(result.education_vault_log_id
        ? { education_vault_log_id: result.education_vault_log_id }
        : {}),
      ...(result.global_mitigation_id ? { global_mitigation_id: result.global_mitigation_id } : {}),
      ...(result.global_rules_updated != null
        ? { global_rules_updated: result.global_rules_updated }
        : {}),
      ...(result.global_promotion_status
        ? { global_promotion_status: result.global_promotion_status }
        : {}),
      ...(result.local_cache_id ? { local_cache_id: result.local_cache_id } : {}),
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    if (e instanceof MsgfOperatorGateError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to update incident.";
    console.error("[admin/incidents/:id] PATCH", e);
    const status = msg.includes("not found") ? 404 : 500;
    return adminJson(req, { ok: false, error: msg }, { status });
  }
}
