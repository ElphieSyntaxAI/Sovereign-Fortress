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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * GET/POST /api/msgf/education/teacher/lessons
 * Teacher lesson builder: list + create lesson packages.
 */
import { randomUUID } from "crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import type { CatalogActor } from "@/lib/education/curriculum-catalog";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";
import {
  createTeacherLesson,
  listTeacherLessons,
} from "@/lib/education/teacher-lessons";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import {
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyPulseCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

async function resolveActor(req: NextRequest): Promise<CatalogActor> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const headerTenant =
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();

  // Dev / SPA path: allow teacher persona header when EDUCATION_OPEN_LESSON_API=1
  const openApi = process.env.EDUCATION_OPEN_LESSON_API === "1";
  if (error || !user) {
    if (!openApi) {
      throw new EducationPolicyHaltError("Unauthorized.", "EDU_AUTH_REQUIRED");
    }
    return {
      role: req.headers.get("x-msgf-persona")?.trim() || "teacher",
      districtTenantId: resolveTenantIdForPillars(
        headerTenant || "syntax_education",
        undefined
      ),
    };
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return {
    role: String(meta?.user_role ?? meta?.persona ?? "teacher"),
    districtTenantId: resolveTenantIdForPillars(
      headerTenant || String(meta?.tenant_id ?? "syntax_education"),
      meta
    ),
    userId: user.id,
  };
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const actor = await resolveActor(req);
    const admin = createAdminClient();
    const lessons = await listTeacherLessons({
      admin,
      tenantId: actor.districtTenantId,
    });
    return json(req, { ok: true, trace_id: traceId, lessons });
  } catch (e) {
    return handleError(req, e, traceId);
  }
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const actor = await resolveActor(req);
    const admin = createAdminClient();
    const body = await req.json();
    const created = await createTeacherLesson({ admin, actor, input: body });
    return json(req, {
      ok: true,
      trace_id: traceId,
      assignmentId: created.assignmentId,
      resourceContextId: created.resourceContextId,
      lesson: created.lesson,
      classroomHint:
        "Attach the returned assignmentId when launching students via Classroom OAuth or /api/education/classroom/launch.",
    });
  } catch (e) {
    return handleError(req, e, traceId);
  }
}

function handleError(req: NextRequest, e: unknown, traceId: string) {
  if (e instanceof EducationPolicyHaltError) {
    return json(
      req,
      { ok: false, error: e.message, code: e.code, trace_id: traceId },
      { status: 403 }
    );
  }
  if (e instanceof ZodError) {
    return json(
      req,
      { ok: false, error: "Invalid body", details: e.flatten(), trace_id: traceId },
      { status: 400 }
    );
  }
  const message = e instanceof Error ? e.message : String(e);
  return json(req, { ok: false, error: message, trace_id: traceId }, { status: 500 });
}
