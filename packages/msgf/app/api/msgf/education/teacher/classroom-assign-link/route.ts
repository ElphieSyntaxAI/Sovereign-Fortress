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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * GET /api/msgf/education/teacher/classroom-assign-link
 * Builds Classroom-first launch URLs (OAuth real + mock QA) for a lesson.
 */
import { NextRequest, NextResponse } from "next/server";

import { EDU_DEMO } from "@/lib/education/demo-fixtures";
import { classroomOAuthConfigured } from "@/lib/education/classroom-oauth";
import {
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const assignmentId = sp.get("assignmentId") || EDU_DEMO.assignmentId;
    const resourceContextId = sp.get("resourceContextId") || "";
    const courseId = sp.get("courseId") || EDU_DEMO.courseId;
    const courseWorkId = sp.get("courseWorkId") || EDU_DEMO.courseWorkId;
    const milestoneTemplateId =
      sp.get("milestoneTemplateId") || EDU_DEMO.milestoneTemplateId;
    const gradeBand = sp.get("gradeBand") || EDU_DEMO.gradeBand;
    const tenantId =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
      EDU_DEMO.tenantId;

    const origin = new URL(req.url).origin;
    const oauthQs = new URLSearchParams({
      assignmentId,
      tenantId,
      courseId,
      courseWorkId,
      milestoneTemplateId,
      gradeBand,
    });
    if (resourceContextId) oauthQs.set("resourceContextId", resourceContextId);

    const oauthStartUrl = `${origin}/api/education/classroom/oauth/start?${oauthQs}`;
    const mockLaunch = {
      method: "POST" as const,
      url: `${origin}/api/education/classroom/mock-launch`,
      body: {
        assignmentId,
        resourceContextId: resourceContextId || null,
        courseId,
        courseWorkId,
        tenantId,
        milestoneTemplateId,
        gradeCohort: gradeBand,
        acceptDisclosure: true,
      },
    };

    return NextResponse.json({
      ok: true,
      oauthConfigured: classroomOAuthConfigured(),
      oauthStartUrl,
      mockLaunch,
      teacherChecklist: [
        "Create/select a Google Doc template for the assignment",
        "Share the oauthStartUrl (prod) or run mockLaunch (QA)",
        "Confirm students accept Utah disclosure before writing",
        "Open Teacher board with the same assignmentId",
      ],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
