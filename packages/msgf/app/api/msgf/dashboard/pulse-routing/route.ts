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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * GET /api/msgf/dashboard/pulse-routing?tenant_id=
 * 24h Pulse routing mix (local vs global) from Redis counters.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { getPulseRoutingMix24h } from "@/lib/services/pulse-routing-stats";

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

    void createAdminClient();
    const mix = await getPulseRoutingMix24h(tenantId);

    return NextResponse.json({
      ok: true,
      mix,
      note: "Estimated without MSGF uses token-usage-estimate; with MSGF reflects local_gateway and bypass routing.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "pulse-routing stats failed";
    console.error("[dashboard/pulse-routing]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
