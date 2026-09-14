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
import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { listArbitrateAudits } from "@/lib/services/arbitrate-audit";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    await resolveOperatorForAdminRequest(req, admin);

    const id = req.nextUrl.searchParams.get("id");
    const origin = req.nextUrl.searchParams.get("project_origin");
    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 25;

    const rows = await listArbitrateAudits(admin, {
      id,
      projectOrigin: origin,
      limit: Number.isFinite(limit) ? limit : 25,
    });

    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to list audits." },
      { status: 500 }
    );
  }
}
