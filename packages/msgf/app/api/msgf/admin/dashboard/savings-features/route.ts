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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
/**
 * GET /api/msgf/admin/dashboard/savings-features?tenant_id=
 * Operator-only savings summary (same payload as tenant dashboard; GLOBAL/COMPANY admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  assertSessionOperatorIsAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import { getSavingsFeaturesSummary24h } from "@/lib/services/savings-features-stats";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get("tenant_id")?.trim();
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenant_id is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const op = await resolveSessionDashboardOperator(admin, user);
    assertSessionOperatorIsAdmin(op);

    const summary = await getSavingsFeaturesSummary24h(tenantId, "admin");

    return NextResponse.json({
      ok: true,
      operator_role: op.role,
      summary,
      note: "Admin view includes Big Brain (global CONVERGE, promotions) and Small Brain counters per tenant.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "admin savings-features failed";
    const status = message.includes("admin") || message.includes("Unauthorized") ? 403 : 500;
    console.error("[admin/dashboard/savings-features]", e);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
