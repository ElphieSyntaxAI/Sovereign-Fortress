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
 * GET/PATCH /api/msgf/education/assignment-instance
 * Lifecycle: EDU_ACTIVE_DRAFTING | EDU_MILESTONE_CHECKING | EDU_SUBMITTED_LOCK
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  EduAssignmentStateSchema,
  getAssignmentInstance,
  submitAssignmentInstanceWithCertificate,
  toAssignmentInstanceWire,
  transitionAssignmentInstance,
  upsertAssignmentInstance,
} from "@/lib/education/assignment-instance";
import { MilestoneTemplateIdSchema } from "@/lib/education/milestone-gate";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { createAdminClient } from "@/utils/supabase/admin";

function tenantFrom(req: NextRequest): string {
  return (
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
    "syntax_education"
  );
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("assignmentInstanceId");
    if (!id) {
      return NextResponse.json(
        { error: "assignmentInstanceId required" },
        { status: 400 }
      );
    }
    const admin = createAdminClient();
    const instance = await getAssignmentInstance({
      admin,
      assignmentInstanceId: id,
      tenantId: tenantFrom(req),
    });
    if (!instance) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, instance: toAssignmentInstanceWire(instance) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const PatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("transition"),
    assignmentInstanceId: z.string().uuid(),
    nextState: EduAssignmentStateSchema,
  }),
  z.object({
    action: z.literal("submit"),
    assignmentInstanceId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("ensure"),
    assignmentId: z.string().uuid(),
    entityToken: z.string().min(1).optional(),
    milestoneTemplateId: MilestoneTemplateIdSchema.optional(),
    resourceContextId: z.string().optional().nullable(),
  }),
]);

export async function PATCH(req: NextRequest) {
  try {
    const body = PatchSchema.parse(await req.json());
    const admin = createAdminClient();
    const tenantId = tenantFrom(req);

    if (body.action === "ensure") {
      const entityToken =
        body.entityToken ||
        req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() ||
        "";
      if (!entityToken) {
        return NextResponse.json({ error: "entity token required" }, { status: 400 });
      }
      const instance = await upsertAssignmentInstance({
        admin,
        tenantId,
        assignmentId: body.assignmentId,
        entityToken,
        milestoneTemplateId: body.milestoneTemplateId,
        resourceContextId: body.resourceContextId,
      });
      return NextResponse.json({
        ok: true,
        instance: toAssignmentInstanceWire(instance),
      });
    }

    if (body.action === "submit") {
      const { instance, certificate } = await submitAssignmentInstanceWithCertificate({
        admin,
        assignmentInstanceId: body.assignmentInstanceId,
        tenantId,
      });
      return NextResponse.json({
        ok: true,
        instance: toAssignmentInstanceWire(instance),
        turnInLockout: true,
        humanEffortCertificate: {
          certificate_id: certificate.certificateId,
          certificate_digest: certificate.certificateDigest,
          hal_score: certificate.halScore,
          teacher_dashboard_url: certificate.teacherDashboardUrl,
          line_item_url: certificate.lineItemUrl,
          status: certificate.status,
          persisted: certificate.persisted,
        },
      });
    }

    const instance = await transitionAssignmentInstance({
      admin,
      assignmentInstanceId: body.assignmentInstanceId,
      tenantId,
      nextState: body.nextState,
    });
    return NextResponse.json({
      ok: true,
      instance: toAssignmentInstanceWire(instance),
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
