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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * POST /api/msgf/education/milestone-check
 * Structural Milestone Gate → may transition to EDU_MILESTONE_CHECKING.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAssignmentInstance,
  toAssignmentInstanceWire,
  transitionAssignmentInstance,
} from "@/lib/education/assignment-instance";
import {
  checkMilestones,
  MilestoneTemplateIdSchema,
} from "@/lib/education/milestone-gate";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";
import { assertUtahDisclosureAccepted } from "@/lib/education/utah-disclosure";
import { createAdminClient } from "@/utils/supabase/admin";

const BodySchema = z.object({
  assignmentInstanceId: z.string().uuid(),
  documentText: z.string().max(200_000),
  templateId: MilestoneTemplateIdSchema.optional(),
  strictUnlock: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    const tenantId =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
      "syntax_education";

    const admin = createAdminClient();
    const current = await getAssignmentInstance({
      admin,
      assignmentInstanceId: body.assignmentInstanceId,
      tenantId,
    });
    if (!current) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    try {
      await assertUtahDisclosureAccepted({
        admin,
        tenantId,
        entityToken:
          req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() || current.entityToken,
      });
    } catch (e) {
      if (e instanceof EducationPolicyHaltError) {
        return NextResponse.json(
          {
            ok: false,
            error: e.message,
            code: e.code,
            disclosureRequired: true,
            instance: toAssignmentInstanceWire(current),
          },
          { status: 403 }
        );
      }
      throw e;
    }
    if (current.currentState === "EDU_SUBMITTED_LOCK") {
      return NextResponse.json(
        {
          ok: false,
          error: "turn_in_lockout",
          instance: toAssignmentInstanceWire(current),
        },
        { status: 423 }
      );
    }

    const templateId = body.templateId ?? current.milestoneTemplateId;
    const check = checkMilestones({
      templateId,
      documentText: body.documentText,
      strictUnlock: body.strictUnlock,
    });

    let instance = current;
    if (check.bottleneck && !check.complete) {
      if (current.currentState === "EDU_ACTIVE_DRAFTING") {
        instance = await transitionAssignmentInstance({
          admin,
          assignmentInstanceId: body.assignmentInstanceId,
          tenantId,
          nextState: "EDU_MILESTONE_CHECKING",
        });
      }
    } else if (check.unlockSocratic && current.currentState === "EDU_MILESTONE_CHECKING") {
      instance = await transitionAssignmentInstance({
        admin,
        assignmentInstanceId: body.assignmentInstanceId,
        tenantId,
        nextState: "EDU_ACTIVE_DRAFTING",
      });
    }

    return NextResponse.json({
      ok: true,
      check: {
        templateId: check.templateId,
        complete: check.complete,
        incompleteSteps: check.incompleteSteps,
        unlockSocratic: check.unlockSocratic,
        bottleneck: check.bottleneck
          ? {
              stepId: check.bottleneck.stepId,
              label: check.bottleneck.label,
              breakdown: check.bottleneck.breakdown,
            }
          : null,
      },
      instance: toAssignmentInstanceWire(instance),
      suggestSocratic: Boolean(check.bottleneck) && check.unlockSocratic,
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
