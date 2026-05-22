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

    const summary = await getSavingsFeaturesSummary24h(tenantId);

    return NextResponse.json({
      ok: true,
      operator_role: op.role,
      summary,
      note: "Admin view includes full feature catalog and per-tenant Redis counters (24h).",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "admin savings-features failed";
    const status = message.includes("admin") || message.includes("Unauthorized") ? 403 : 500;
    console.error("[admin/dashboard/savings-features]", e);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
