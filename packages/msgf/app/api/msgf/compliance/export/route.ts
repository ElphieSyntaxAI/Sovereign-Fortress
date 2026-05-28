/**
 * GET /api/msgf/compliance/export?tenant_id=&from=&to=
 */

import { NextRequest, NextResponse } from "next/server";

import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { parseHealQueueTenantQuery } from "@/lib/schemas/heal-queue";
import { fetchComplianceExport } from "@/lib/services/compliance-export-service";
import { createAdminClient } from "@/utils/supabase/admin";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  try {
    const { tenant_id } = parseHealQueueTenantQuery(
      req.nextUrl.searchParams.get("tenant_id")
    );
    const from = req.nextUrl.searchParams.get("from")?.trim() || undefined;
    const to = req.nextUrl.searchParams.get("to")?.trim() || undefined;

    const admin = createAdminClient();
    const rows = await fetchComplianceExport(admin, { tenant_id, from, to });

    return json(req, {
      ok: true,
      tenant_id,
      count: rows.length,
      rows,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "compliance export failed";
    return json(req, { ok: false, error: msg }, { status: 500 });
  }
}
