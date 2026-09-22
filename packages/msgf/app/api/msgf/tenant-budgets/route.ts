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
 * GET/PUT /api/msgf/tenant-budgets — hard dollar/token quotas.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import {
  DashboardTenantAccessError,
  validateDashboardTenantAccess,
} from "@/lib/auth/dashboard-guard";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

async function resolveTenant(
  req: NextRequest,
  bodyTenant?: string
): Promise<{ admin: ReturnType<typeof createAdminClient>; tenantId: string; userId: string }> {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new DashboardTenantAccessError("Unauthorized", 401);

  const admin = createAdminClient();
  let tenantId = bodyTenant?.trim() || req.nextUrl.searchParams.get("tenant_id")?.trim() || "";
  if (!tenantId) {
    const { data } = await admin
      .from("p4_profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    tenantId =
      (typeof data?.tenant_id === "string" && data.tenant_id.trim()) || user.id;
  }
  await validateDashboardTenantAccess(admin, { user }, tenantId);
  return { admin, tenantId, userId: user.id };
}

export async function GET(req: NextRequest) {
  try {
    const { admin, tenantId } = await resolveTenant(req);
    const { data, error } = await admin
      .from("msgf_tenant_budgets")
      .select(
        "tenant_id, monthly_dollar_cap, current_month_spend, spend_month, max_session_tokens, rapid_retry_threshold, budget_exceeded_action, updated_at"
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      budget: data ?? {
        tenant_id: tenantId,
        monthly_dollar_cap: 0,
        current_month_spend: 0,
        max_session_tokens: 200000,
        rapid_retry_threshold: 10,
        budget_exceeded_action: "block",
      },
    });
  } catch (e) {
    if (e instanceof DashboardTenantAccessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "budget get failed" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tenant_id?: string;
      monthly_dollar_cap?: number;
      max_session_tokens?: number;
      rapid_retry_threshold?: number;
      budget_exceeded_action?: "block" | "fallback_small_brain";
    };
    const { admin, tenantId } = await resolveTenant(req, body.tenant_id);

    const { error } = await admin.from("msgf_tenant_budgets").upsert(
      {
        tenant_id: tenantId,
        monthly_dollar_cap: Number(body.monthly_dollar_cap ?? 0),
        max_session_tokens: Number(body.max_session_tokens ?? 200000),
        rapid_retry_threshold: Number(body.rapid_retry_threshold ?? 10),
        budget_exceeded_action: body.budget_exceeded_action ?? "block",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, tenant_id: tenantId });
  } catch (e) {
    if (e instanceof DashboardTenantAccessError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "budget save failed" },
      { status: 500 }
    );
  }
}
