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
 * GET/POST /api/msgf/education/utah-disclosure
 * S.B. 149 disclosure copy + acceptance (blocks AI path until accepted).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  acceptUtahDisclosure,
  getDisclosureStatus,
  getUtahDisclosureCopy,
} from "@/lib/education/utah-disclosure";
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

function entityFrom(req: NextRequest, bodyToken?: string): string {
  return (
    bodyToken ||
    req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() ||
    req.nextUrl.searchParams.get("entityToken")?.trim() ||
    ""
  );
}

export async function GET(req: NextRequest) {
  try {
    const entityToken = entityFrom(req);
    const copy = getUtahDisclosureCopy();
    if (!entityToken) {
      return NextResponse.json({
        ok: true,
        status: {
          required: true,
          accepted: false,
          legalVersion: copy.legalVersion,
          acceptedAt: null,
          copy,
        },
      });
    }

    const admin = createAdminClient();
    const status = await getDisclosureStatus({
      admin,
      tenantId: tenantFrom(req),
      entityToken,
      assignmentInstanceId: req.nextUrl.searchParams.get("assignmentInstanceId"),
    });
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

const PostSchema = z.object({
  entityToken: z.string().min(1),
  assignmentInstanceId: z.string().uuid().optional().nullable(),
  assignmentId: z.string().uuid().optional().nullable(),
  accepted: z.literal(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = PostSchema.parse(await req.json());
    const admin = createAdminClient();
    const status = await acceptUtahDisclosure({
      admin,
      tenantId: tenantFrom(req),
      entityToken: body.entityToken,
      assignmentInstanceId: body.assignmentInstanceId,
      assignmentId: body.assignmentId,
    });
    return NextResponse.json({
      ok: true,
      status,
      gates: {
        sb149: "accepted",
        hb273: "enforced_no_auto_grade_no_iep_mutate",
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
