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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * GET /api/education/classroom/oauth/start
 * Redirects to Google OAuth (Classroom-first).
 */
import { NextRequest, NextResponse } from "next/server";

import {
  buildClassroomOAuthStartUrl,
  classroomOAuthConfigured,
  mintOAuthState,
} from "@/lib/education/classroom-oauth";

export async function GET(req: NextRequest) {
  try {
    if (!classroomOAuthConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Google Classroom OAuth not configured. Set GOOGLE_CLASSROOM_CLIENT_ID, GOOGLE_CLASSROOM_CLIENT_SECRET, GOOGLE_CLASSROOM_REDIRECT_URI.",
          configured: false,
        },
        { status: 503 }
      );
    }

    const sp = req.nextUrl.searchParams;
    const assignmentId = sp.get("assignmentId");
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
    }

    const state = mintOAuthState({
      assignmentId,
      tenantId: sp.get("tenantId") || "syntax_education",
      courseId: sp.get("courseId") || "",
      courseWorkId: sp.get("courseWorkId") || "",
      gradeBand: sp.get("gradeBand") || "4_6",
      milestoneTemplateId: sp.get("milestoneTemplateId") || "generic_sections",
      resourceContextId: sp.get("resourceContextId") || "",
      role: sp.get("role") || "student",
    });

    const url = buildClassroomOAuthStartUrl({ state });
    return NextResponse.redirect(url);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
