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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * POST /api/msgf/education/demo/bootstrap
 * One-shot test-ready catalog + lesson + instance (+ optional disclosure).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  bootstrapEducationDemo,
  isEducationDemoBootstrapEnabled,
} from "@/lib/education/demo-bootstrap";
import { createAdminClient } from "@/utils/supabase/admin";

const BodySchema = z.object({
  acceptDisclosure: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!isEducationDemoBootstrapEnabled()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Demo bootstrap disabled. Set EDUCATION_DEMO_BOOTSTRAP=1 (recommended for local QA).",
        },
        { status: 403 }
      );
    }
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const admin = createAdminClient();
    const result = await bootstrapEducationDemo({
      admin,
      acceptDisclosure: body.acceptDisclosure,
    });
    return NextResponse.json({
      ok: true,
      demo: result,
      next: {
        sandbox: result.sandboxPath,
        mockLaunch: {
          method: "POST",
          path: result.classroomMockLaunchPath,
          body: {
            assignmentId: result.assignmentId,
            resourceContextId: result.resourceContextId,
          },
        },
      },
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
