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
/**
 * GET/PATCH /api/msgf/admin/bug-inbox
 * Operator triage for Sentinel / report-issue rows in p4_active_incidents.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  dismissBugInboxItem,
  listBugInbox,
  promoteBugInboxItem,
  type BugInboxStatus,
} from "@/lib/services/bug-inbox";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

async function requireInboxOperator(req: NextRequest) {
  const admin = createAdminClient();
  const op = await resolveOperatorForAdminRequest(req, admin);
  if (op.role === "DEVELOPER") {
    throw new MsgfAdminAuthError("Operators only.", 403);
  }
  if (!op.operatorUserId) {
    throw new MsgfAdminAuthError("Operator user id required.", 403);
  }
  return { admin, op };
}

export async function GET(req: NextRequest) {
  try {
    const { admin, op } = await requireInboxOperator(req);
    const statusRaw = req.nextUrl.searchParams.get("status")?.trim() || "open";
    const status = (
      ["open", "promoted", "dismissed", "all"].includes(statusRaw)
        ? statusRaw
        : "open"
    ) as BugInboxStatus | "all";
    const q = req.nextUrl.searchParams.get("q");
    const tenantId = req.nextUrl.searchParams.get("tenant_id");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "40");

    const projectOrigin = req.nextUrl.searchParams.get("project_origin")?.trim() || "";
    const listed = await listBugInbox({
      admin,
      status,
      q,
      tenantId,
      companyId: op.role === "COMPANY_ADMIN" ? op.companyId : null,
      limit: Number.isFinite(limit) ? limit : 40,
    });
    const rows = projectOrigin
      ? listed.rows.filter((row) => String(row.location ?? "").includes(projectOrigin))
      : listed.rows;

    return adminJson(req, {
      ok: true,
      count: projectOrigin ? rows.length : listed.count,
      rows,
      operator_role: op.role,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "List failed.";
    console.error("[admin/bug-inbox] GET", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}

const patchSchema = z
  .object({
    id: z.string().uuid(),
    action: z.enum(["promote", "dismiss"]),
    note: z.string().max(1000).optional().nullable(),
  })
  .strict();

export async function PATCH(req: NextRequest) {
  try {
    const { admin, op } = await requireInboxOperator(req);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON." }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: "Invalid body.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const companyId = op.role === "COMPANY_ADMIN" ? op.companyId : null;

    if (parsed.data.action === "promote") {
      const result = await promoteBugInboxItem({
        admin,
        id: parsed.data.id,
        operatorUserId: op.operatorUserId!,
        note: parsed.data.note,
        companyId,
      });
      return adminJson(req, {
        ok: true,
        action: "promote",
        row: result.row,
        msgf_incident_id: result.msgf_incident_id,
      });
    }

    const row = await dismissBugInboxItem({
      admin,
      id: parsed.data.id,
      note: parsed.data.note,
      companyId,
    });
    return adminJson(req, { ok: true, action: "dismiss", row });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Update failed.";
    console.error("[admin/bug-inbox] PATCH", e);
    const status = /not found|outside your company|Dismissed/i.test(msg) ? 400 : 500;
    return adminJson(req, { ok: false, error: msg }, { status });
  }
}
