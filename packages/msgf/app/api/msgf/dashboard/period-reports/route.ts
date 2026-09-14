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
 * GET  /api/msgf/dashboard/period-reports?tenant_id=
 * POST /api/msgf/dashboard/period-reports  { tenant_id, kinds?: ["weekly","monthly"] }
 *
 * Last 3 weekly + monthly history of metered consumption / proven savings.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import {
  DashboardTenantAccessError,
  validateDashboardTenantAccess,
} from "@/lib/auth/dashboard-guard";
import {
  getPeriodSavingsReportsBundle,
  logCurrentPeriodReports,
} from "@/lib/services/period-savings-reports";
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

async function assertTenant(
  admin: ReturnType<typeof createAdminClient>,
  user: { id: string; email?: string | null },
  tenantId: string
): Promise<NextResponse | null> {
  try {
    await validateDashboardTenantAccess(admin, { user: user as import("@supabase/supabase-js").User }, tenantId);
    return null;
  } catch (e) {
    if (e instanceof DashboardTenantAccessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    throw e;
  }
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

    const admin = createAdminClient();
    const tenantId = await resolveTenantId(
      admin,
      user.id,
      req.nextUrl.searchParams.get("tenant_id")
    );

    const denied = await assertTenant(admin, user, tenantId);
    if (denied) return denied;

    const weeklyCount = Number(req.nextUrl.searchParams.get("weekly_count") ?? "3");
    const monthlyHistory = Number(req.nextUrl.searchParams.get("monthly_history") ?? "12");

    const bundle = await getPeriodSavingsReportsBundle({
      admin,
      tenantId,
      userId: user.id,
      weeklyCount: Number.isFinite(weeklyCount) ? Math.min(Math.max(weeklyCount, 1), 8) : 3,
      monthlyHistory: Number.isFinite(monthlyHistory)
        ? Math.min(Math.max(monthlyHistory, 1), 36)
        : 12,
      persistCurrent: true,
    });

    return NextResponse.json({ ok: true, ...bundle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "period-reports failed";
    console.error("[dashboard/period-reports]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    const body = (await req.json().catch(() => ({}))) as {
      tenant_id?: string;
      kinds?: Array<"weekly" | "monthly">;
    };

    const admin = createAdminClient();
    const tenantId = await resolveTenantId(admin, user.id, body.tenant_id);

    const denied = await assertTenant(admin, user, tenantId);
    if (denied) return denied;

    const logged = await logCurrentPeriodReports({
      admin,
      tenantId,
      userId: user.id,
      kinds: body.kinds,
    });

    const bundle = await getPeriodSavingsReportsBundle({
      admin,
      tenantId,
      userId: user.id,
      persistCurrent: false,
    });

    return NextResponse.json({ ok: true, logged, ...bundle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "period-reports log failed";
    console.error("[dashboard/period-reports POST]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
