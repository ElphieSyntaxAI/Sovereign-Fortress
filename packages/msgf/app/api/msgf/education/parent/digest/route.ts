/**
 * GET /api/msgf/education/parent/digest?entityToken=
 */
import { NextRequest, NextResponse } from "next/server";

import { buildParentDigest } from "@/lib/education/parent-digest";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const entityToken =
      req.nextUrl.searchParams.get("entityToken")?.trim() ||
      req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() ||
      "";
    if (!entityToken) {
      return NextResponse.json({ error: "entityToken required" }, { status: 400 });
    }
    const tenantId =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
      "syntax_education";

    const admin = createAdminClient();
    const digest = await buildParentDigest({ admin, tenantId, entityToken });
    return NextResponse.json({ ok: true, digest });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
