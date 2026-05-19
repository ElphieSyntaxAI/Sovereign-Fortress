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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  assertOperatorCanAccessIncident,
  MsgfOperatorGateError,
  resolveDashboardOperator,
} from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";

import {
  patchIncidentBodySchema,
  resolveAdminIncident,
} from "@/lib/services/admin-incident-resolve";

import {
  getMsgfIncidentById,
  listMsgfIncidents,
  type MsgfIncidentStatus,
} from "@/lib/services/msgf-incidents";

import { createAdminClient } from "@/utils/supabase/admin";

/** Legacy collection PATCH — includes `id` in body. Prefer PATCH `/incidents/:id`. */

const patchBodySchema = patchIncidentBodySchema.extend({
  id: z.string().uuid(),
});

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * GET — list ARBITRATE incidents (service-role Bearer required).
 *
 * PATCH — resolve / reopen (legacy: `{ id, status, … }`). Prefer `/incidents/:id`.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(
        req,
        { ok: false, error: "Developers may only trigger self-heal; incident queue is restricted." },
        { status: 403 }
      );
    }

    if (op.role === "COMPANY_ADMIN" && !op.companyId) {
      return adminJson(
        req,
        { ok: false, error: "Company admin requires company_id on p4_profiles." },
        { status: 403 }
      );
    }

    const statusParam = req.nextUrl.searchParams.get("status")?.trim();
    const status =
      statusParam === "pending" || statusParam === "resolved"
        ? (statusParam as MsgfIncidentStatus)
        : undefined;

    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");

    const { incidents, count } = await listMsgfIncidents({
      adminSupabase: admin,
      status,
      companyId: op.role === "COMPANY_ADMIN" ? op.companyId ?? undefined : undefined,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return adminJson(req, {
      ok: true,
      operator_role: op.role,
      dashboard_view: op.dashboardView,
      can_promote_to_global: op.canPromoteToGlobal,
      incidents,
      count,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to list incidents.";
    console.error("[admin/incidents] GET", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(
        req,
        { ok: false, error: "Developers cannot resolve incidents via the admin queue." },
        { status: 403 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = patchBodySchema.safeParse(json);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, ...body } = parsed.data;
    const existing = await getMsgfIncidentById({ adminSupabase: admin, id });
    if (!existing) {
      return adminJson(req, { ok: false, error: "Incident not found." }, { status: 404 });
    }

    await assertOperatorCanAccessIncident(admin, op, existing);

    const result = await resolveAdminIncident({
      adminSupabase: admin,
      incidentId: id,
      body,
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
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    if (e instanceof MsgfOperatorGateError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to update incident.";
    console.error("[admin/incidents] PATCH", e);
    const status = msg.includes("not found") ? 404 : 500;
    return adminJson(req, { ok: false, error: msg }, { status });
  }
}
