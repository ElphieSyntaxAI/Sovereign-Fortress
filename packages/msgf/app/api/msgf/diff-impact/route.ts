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
 * POST /api/msgf/diff-impact — AI diff → governance-memory blast radius.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import {
  DashboardTenantAccessError,
  validateDashboardTenantAccess,
} from "@/lib/auth/dashboard-guard";
import { computeDiffImpact } from "@/lib/services/diff-impact";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

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

    const body = (await req.json()) as {
      tenant_id?: string;
      project_origin?: string;
      trace_id?: string;
      files?: Array<{ path: string; patch?: string }>;
    };

    const admin = createAdminClient();
    let tenantId = body.tenant_id?.trim() || "";
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
        return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
      }
      throw e;
    }

    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length === 0) {
      return NextResponse.json({ ok: false, error: "files required" }, { status: 400 });
    }

    const report = await computeDiffImpact(admin, {
      tenant_id: tenantId,
      project_origin: body.project_origin ?? null,
      files,
      trace_id: body.trace_id ?? null,
    });

    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "diff-impact failed" },
      { status: 500 }
    );
  }
}
