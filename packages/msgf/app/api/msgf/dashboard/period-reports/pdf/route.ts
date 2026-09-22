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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * GET /api/msgf/dashboard/period-reports/pdf?tenant_id=&scope=all|weekly|monthly
 * Downloads a PDF of metered consumption + proven savings reports.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import {
  DashboardTenantAccessError,
  validateDashboardTenantAccess,
} from "@/lib/auth/dashboard-guard";
import { getPeriodSavingsReportsBundle } from "@/lib/services/period-savings-reports";
import { buildPeriodSavingsReportPdf } from "@/lib/utils/period-report-pdf";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

async function resolveTenantId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  requested?: string | null
): Promise<string> {
  if (requested?.trim()) return requested.trim();
  const { data } = await admin
    .from("p4_profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  const fromProfile =
    typeof data?.tenant_id === "string" && data.tenant_id.trim() ? data.tenant_id.trim() : null;
  return fromProfile || userId;
}

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

    const scopeRaw = req.nextUrl.searchParams.get("scope")?.trim().toLowerCase() ?? "all";
    const scope =
      scopeRaw === "weekly" || scopeRaw === "monthly" || scopeRaw === "all" ? scopeRaw : "all";

    const admin = createAdminClient();
    const tenantId = await resolveTenantId(
      admin,
      user.id,
      req.nextUrl.searchParams.get("tenant_id")
    );

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

    const bundle = await getPeriodSavingsReportsBundle({
      admin,
      tenantId,
      userId: user.id,
      weeklyCount: 3,
      monthlyHistory: 12,
      persistCurrent: true,
    });

    const pdf = buildPeriodSavingsReportPdf(bundle, scope);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `msgf-${scope}-savings-report-${stamp}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "period-reports pdf failed";
    console.error("[dashboard/period-reports/pdf]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
