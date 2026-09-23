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
 * POST /api/msgf/education/hal-lite — ingest HAL Lite deltas from Google Docs sidebar.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAssignmentInstance,
  patchHalLiteMetrics,
  toAssignmentInstanceWire,
} from "@/lib/education/assignment-instance";
import {
  applyActiveWritingSeconds,
  applyKeystrokeBurst,
  applyPasteAssessment,
  assessPasteDelta,
  emptyHalLiteMetrics,
} from "@/lib/education/hal-lite";
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
  deltaChars: z.number().int().optional(),
  matchingKeystrokeCount: z.number().int().min(0).optional(),
  activeWritingSecondsDelta: z.number().finite().min(0).optional(),
  keystrokeBurstCount: z.number().int().min(0).optional(),
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

    let metrics = current.halLite ?? emptyHalLiteMetrics();
    let pasteWarning: string | null = null;

    if (typeof body.deltaChars === "number" && body.deltaChars > 0) {
      const assessment = assessPasteDelta({
        deltaChars: body.deltaChars,
        matchingKeystrokeCount: body.matchingKeystrokeCount,
      });
      metrics = applyPasteAssessment(metrics, assessment);
      pasteWarning = assessment.warningCode;
    }
    if (body.activeWritingSecondsDelta) {
      metrics = applyActiveWritingSeconds(metrics, body.activeWritingSecondsDelta);
    }
    if (body.keystrokeBurstCount) {
      metrics = applyKeystrokeBurst(metrics, body.keystrokeBurstCount);
    }

    const instance = await patchHalLiteMetrics({
      admin,
      assignmentInstanceId: body.assignmentInstanceId,
      tenantId,
      metrics,
    });

    return NextResponse.json({
      ok: true,
      pasteWarning,
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
