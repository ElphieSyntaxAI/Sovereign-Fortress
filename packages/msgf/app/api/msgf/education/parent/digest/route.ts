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
