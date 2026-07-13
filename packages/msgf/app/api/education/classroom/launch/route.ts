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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * POST /api/education/classroom/launch
 * Google Classroom → privacy-gated entity token + assignment instance (Classroom-first).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { launchFromGoogleClassroom } from "@/lib/education/classroom-launch";
import { MilestoneTemplateIdSchema } from "@/lib/education/milestone-gate";
import { createAdminClient } from "@/utils/supabase/admin";

const BodySchema = z.object({
  tenantId: z.string().min(1).default("syntax_education"),
  googleSub: z.string().min(1),
  courseId: z.string().min(1),
  courseWorkId: z.string().min(1),
  assignmentId: z.string().uuid(),
  gradeCohort: z.string().optional(),
  milestoneTemplateId: MilestoneTemplateIdSchema.optional(),
  resourceContextId: z.string().optional().nullable(),
  role: z.enum(["student", "teacher"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    const admin = createAdminClient();
    const result = await launchFromGoogleClassroom({
      admin,
      tenantId: body.tenantId,
      googleSub: body.googleSub,
      courseId: body.courseId,
      courseWorkId: body.courseWorkId,
      assignmentId: body.assignmentId,
      gradeCohort: body.gradeCohort,
      milestoneTemplateId: body.milestoneTemplateId,
      resourceContextId: body.resourceContextId,
      role: body.role,
    });

    return NextResponse.json({
      ok: true,
      entityId: result.entityId,
      entityToken: result.entityToken,
      anonymousDisplayToken: result.anonymousDisplayToken,
      createdVault: result.createdVault,
      instance: result.wire,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid body", details: e.flatten() },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
