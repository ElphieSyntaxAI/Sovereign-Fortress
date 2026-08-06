/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * GET /api/msgf/dashboard/shadow-eval?tenant_id=
 * 24h Shadow Proxy projected savings summary + recent rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import {
  DashboardTenantAccessError,
  validateDashboardTenantAccess,
} from "@/lib/auth/dashboard-guard";
import {
  getShadowEvalSummary24h,
  listRecentShadowEvaluations,
} from "@/lib/shadow-eval/shadow-ledger";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const hdrs = await headers();
    const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    let tenantId = req.nextUrl.searchParams.get("tenant_id")?.trim() || "";
    if (!tenantId) {
      const { data } = await admin
        .from("p4_profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      tenantId =
        (typeof data?.tenant_id === "string" && data.tenant_id.trim()) || user.id;
    }

    try {
      await validateDashboardTenantAccess(admin, { user }, tenantId);
    } catch (e) {
      if (e instanceof DashboardTenantAccessError) {
        return NextResponse.json(
          { ok: false, error: e.message },
          { status: e.status }
        );
      }
      throw e;
    }

    const [summary, recent] = await Promise.all([
      getShadowEvalSummary24h(tenantId),
      listRecentShadowEvaluations(admin, tenantId, 15).catch(() => []),
    ]);

    return NextResponse.json({
      ok: true,
      summary,
      recent,
      note: "Shadow projected USD is simulated savings from pass-through traffic — not proven eco.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "shadow-eval failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
