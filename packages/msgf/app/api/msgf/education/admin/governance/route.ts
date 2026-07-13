/**
 * GET /api/msgf/education/admin/governance
 */
import { NextRequest, NextResponse } from "next/server";

import { buildEducationGovernanceSnapshot } from "@/lib/education/admin-governance";
import {
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const tenantId =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
      req.nextUrl.searchParams.get("tenantId")?.trim() ||
      "syntax_education";
    const admin = createAdminClient();
    const snapshot = await buildEducationGovernanceSnapshot({ admin, tenantId });
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
