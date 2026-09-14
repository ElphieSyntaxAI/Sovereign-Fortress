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
 * GET /api/msgf/admin/docusign/envelopes — company DocuSign envelope status (session or Bearer admin).
 */

import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { docuSignModeLabel } from "@/lib/services/docusign-gateway";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);

    if (op.role === "DEVELOPER") {
      return NextResponse.json({ ok: false, error: "Operators only." }, { status: 403 });
    }

    const companyId = op.companyId;
    if (op.role === "COMPANY_ADMIN" && !companyId) {
      return NextResponse.json({ ok: false, error: "Company admin requires company_id." }, { status: 403 });
    }

    let query = admin
      .from("msgf_docusign_envelopes")
      .select(
        "id, invite_id, user_id, company_id, envelope_id, signing_url, status, completed_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
    const emails = new Map<string, string>();
    for (const uid of userIds) {
      const { data: authUser } = await admin.auth.admin.getUserById(uid);
      if (authUser.user?.email) emails.set(uid, authUser.user.email);
    }

    return NextResponse.json({
      ok: true,
      mode: docuSignModeLabel(),
      operator_role: op.role,
      envelopes: (data ?? []).map((row) => ({
        ...row,
        email: row.user_id ? emails.get(row.user_id as string) ?? null : null,
      })),
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to list envelopes.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
