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
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import {
  applyVaultQuarantineHitl,
  listQuarantinedVaultRows,
} from "@/lib/services/vault-quarantine-hitl";
import { createAdminClient } from "@/utils/supabase/admin";

async function requireQuarantineOperator(req: NextRequest) {
  const admin = createAdminClient();
  const op = await resolveOperatorForAdminRequest(req, admin);
  if (op.role === "DEVELOPER") {
    throw new MsgfAdminAuthError("Operators only.", 403);
  }
  return { admin, op };
}

export async function GET(req: NextRequest) {
  try {
    const { admin, op } = await requireQuarantineOperator(req);
    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 40;
    const companyId =
      op.role === "COMPANY_ADMIN" ? (op.companyId ?? null) : req.nextUrl.searchParams.get("company_id");

    const projectOrigin = req.nextUrl.searchParams.get("project_origin")?.trim() || "";
    const rows = (await listQuarantinedVaultRows(admin, {
      companyId,
      limit: Number.isFinite(limit) ? limit : 40,
    })).filter((r) => {
      if (!projectOrigin) return true;
      const origin =
        r.metadata && typeof r.metadata.project_origin === "string"
          ? r.metadata.project_origin
          : "";
      return origin === projectOrigin;
    });

    return NextResponse.json({
      ok: true,
      count: rows.length,
      rows: rows.map((r) => ({
        id: r.id,
        quarantine_status: r.quarantine_status,
        quarantine_reason: r.quarantine_reason,
        quarantine_sentry_issue_id: r.quarantine_sentry_issue_id,
        quarantine_at: r.quarantine_at,
        project_origin:
          r.metadata && typeof r.metadata.project_origin === "string"
            ? r.metadata.project_origin
            : null,
        company_id:
          r.metadata && typeof r.metadata.company_id === "string" ? r.metadata.company_id : null,
        content_preview: (r.content ?? "").slice(0, 180),
      })),
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "List failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

const postSchema = z
  .object({
    vector_id: z.string().uuid(),
    action: z.enum(["DEMOTE_TO_HALL", "RESTORE_TO_VAULT"]),
    note: z.string().max(1000).optional().nullable(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const { admin, op } = await requireQuarantineOperator(req);
    const json = await req.json();
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
    }

    const result = await applyVaultQuarantineHitl(admin, {
      vectorId: parsed.data.vector_id,
      action: parsed.data.action,
      operatorUserId: op.operatorUserId ?? "unknown-operator",
      note: parsed.data.note,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      hall_narrative_log_id: result.hall_narrative_log_id ?? null,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "HITL action failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
