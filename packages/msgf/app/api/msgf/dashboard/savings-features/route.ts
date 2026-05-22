/**
 * GET /api/msgf/dashboard/savings-features?tenant_id=
 * 24h token-savings feature counters + catalog (user + operator dashboards).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getSavingsFeaturesSummary24h } from "@/lib/services/savings-features-stats";
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

    const summary = await getSavingsFeaturesSummary24h(tenantId, "user");

    return NextResponse.json({
      ok: true,
      summary,
      note: "Small Brain features and local heals for your workspace(s). Big Brain escalations are reviewed on the admin ops dashboard.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "savings-features stats failed";
    console.error("[dashboard/savings-features]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
