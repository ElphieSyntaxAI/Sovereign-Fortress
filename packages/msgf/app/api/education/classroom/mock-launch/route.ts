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
 * POST /api/education/classroom/mock-launch
 * Test-ready Classroom launch without Google OAuth (mirrors oauth callback outcome).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { launchFromGoogleClassroom } from "@/lib/education/classroom-launch";
import { EDU_DEMO } from "@/lib/education/demo-fixtures";
import { isEducationDemoBootstrapEnabled } from "@/lib/education/demo-bootstrap";
import { MilestoneTemplateIdSchema } from "@/lib/education/milestone-gate";
import { acceptUtahDisclosure } from "@/lib/education/utah-disclosure";
import { toAssignmentInstanceWire } from "@/lib/education/assignment-instance";
import { createAdminClient } from "@/utils/supabase/admin";

const BodySchema = z.object({
  tenantId: z.string().default(EDU_DEMO.tenantId),
  googleSub: z.string().default(EDU_DEMO.googleSub),
  courseId: z.string().default(EDU_DEMO.courseId),
  courseWorkId: z.string().default(EDU_DEMO.courseWorkId),
  assignmentId: z.string().uuid(),
  gradeCohort: z.string().optional(),
  milestoneTemplateId: MilestoneTemplateIdSchema.optional(),
  resourceContextId: z.string().uuid().optional().nullable(),
  acceptDisclosure: z.boolean().optional().default(true),
  role: z.enum(["student", "teacher"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!isEducationDemoBootstrapEnabled()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Mock Classroom launch disabled. Set EDUCATION_DEMO_BOOTSTRAP=1 for QA.",
        },
        { status: 403 }
      );
    }

    const body = BodySchema.parse(await req.json());
    const admin = createAdminClient();
    const launched = await launchFromGoogleClassroom({
      admin,
      tenantId: body.tenantId,
      googleSub: body.googleSub,
      courseId: body.courseId,
      courseWorkId: body.courseWorkId,
      assignmentId: body.assignmentId,
      gradeCohort: body.gradeCohort ?? EDU_DEMO.gradeBand,
      milestoneTemplateId: body.milestoneTemplateId ?? EDU_DEMO.milestoneTemplateId,
      resourceContextId: body.resourceContextId,
      role: body.role ?? "student",
    });

    if (body.acceptDisclosure) {
      await acceptUtahDisclosure({
        admin,
        tenantId: body.tenantId,
        entityToken: launched.entityToken,
        assignmentInstanceId: launched.assignmentInstance.assignmentInstanceId,
        assignmentId: body.assignmentId,
      });
    }

    const appBase =
      process.env.EDUCATION_APP_URL?.replace(/\/+$/, "") ||
      "http://127.0.0.1:5175";
    const sandboxUrl = `${appBase}/sandbox?assignmentInstanceId=${encodeURIComponent(
      launched.assignmentInstance.assignmentInstanceId
    )}&entityToken=${encodeURIComponent(launched.entityToken)}`;

    return NextResponse.json({
      ok: true,
      mock: true,
      entityId: launched.entityId,
      entityToken: launched.entityToken,
      anonymousDisplayToken: launched.anonymousDisplayToken,
      instance: toAssignmentInstanceWire(launched.assignmentInstance),
      sandboxUrl,
      note: "Mock launch only — use /api/education/classroom/oauth/start for real Google Classroom.",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: e.flatten() },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
