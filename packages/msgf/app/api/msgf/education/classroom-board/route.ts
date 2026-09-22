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
 * GET /api/msgf/education/classroom-board
 * Teacher Classroom Board — cohort trends only; no raw draft text.
 */
import { NextRequest, NextResponse } from "next/server";

import { buildClassroomBoard } from "@/lib/education/classroom-board";
import {
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const assignmentId = req.nextUrl.searchParams.get("assignmentId");
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
    }
    const tenantId =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
      req.nextUrl.searchParams.get("tenantId")?.trim() ||
      "syntax_education";

    const admin = createAdminClient();
    const board = await buildClassroomBoard({
      admin,
      tenantId,
      assignmentId,
    });

    return NextResponse.json({
      ok: true,
      board,
      note: "Cohort aggregates only — raw student draft text is never included.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
