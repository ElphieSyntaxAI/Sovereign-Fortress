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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * GET /api/msgf/dashboard/security-snapshot?tenant_id=&project_origin=
 * Dev + tenant security counters (24h Redis) and IDE workspace settings probe.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { buildSecurityIdeContext } from "@/lib/services/security-dev-settings";
import { buildSecuritySnapshot } from "@/lib/services/security-snapshot";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createSupabaseServerClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const tenantIdParam = req.nextUrl.searchParams.get("tenant_id")?.trim();
    const projectOrigin = req.nextUrl.searchParams.get("project_origin")?.trim() || null;

    if (!tenantIdParam && !projectOrigin) {
      return NextResponse.json(
        { ok: false, error: "tenant_id or project_origin is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const hdrs = await headers();
    const requestHost = requestHostFromHeaders(hdrs) ?? null;
    const supabase = createSupabaseServerClient(cookieStore, requestHost);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const ideContext = await buildSecurityIdeContext(
      admin,
      session,
      requestHost,
      projectOrigin
    );

    const statsTenantKey =
      projectOrigin?.trim() ||
      ideContext.selectedProjectOrigin?.trim() ||
      tenantIdParam?.trim() ||
      ideContext.tenantKey;

    const snapshot = await buildSecuritySnapshot(statsTenantKey, ideContext);

    return NextResponse.json({
      ok: true,
      snapshot,
      heal_tenant_id: tenantIdParam ?? session.user.id,
      note: "Stats use project_origin when mapped. Dev lens shows Workspace IDE settings + connectivity checks.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "security-snapshot failed";
    console.error("[dashboard/security-snapshot]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
