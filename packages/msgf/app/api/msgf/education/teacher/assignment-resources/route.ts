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
 * Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
 */
/**
 * GET   /api/msgf/education/teacher/assignment-resources?assignmentId=<uuid>
 *   → currently bound slice + signed deep link for a teacher's assignment.
 *
 * GET   /api/msgf/education/teacher/assignment-resources?resourceContextId=<uuid>
 *   → fetch by `resource_context_id` (used by the student workspace + Socratic tutor).
 *
 * POST  /api/msgf/education/teacher/assignment-resources
 *   → upsert a slice (Curriculum Tree Picker submission). Mints `resource_context_id`.
 */
import { randomUUID } from "crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  getAssignmentResource,
  getAssignmentResourceForAssignment,
  upsertAssignmentResource,
} from "@/lib/education/assignment-resources";
import { type CatalogActor } from "@/lib/education/curriculum-catalog";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import {
  MSGF_ENTITY_ID_HEADER,
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

async function resolveActor(req: NextRequest): Promise<{
  actor: CatalogActor;
  entityId?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new EducationPolicyHaltError("Unauthorized.", "EDU_AUTH_REQUIRED");
  }
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const headerTenant =
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
  const districtTenantId = resolveTenantIdForPillars(
    headerTenant || String(meta?.tenant_id ?? "syntax_education"),
    meta
  );
  const role = String(meta?.user_role ?? meta?.persona ?? "student");
  const entityId =
    req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() || user.id;
  return {
    actor: { role, districtTenantId, userId: user.id },
    entityId,
  };
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const { actor, entityId } = await resolveActor(req);
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");
    const resourceContextId = searchParams.get("resourceContextId");

    let row;
    if (resourceContextId) {
      row = await getAssignmentResource({
        admin,
        resourceContextId,
        actor,
        entityId,
        refreshSignedLink: true,
      });
    } else if (assignmentId) {
      row = await getAssignmentResourceForAssignment({
        admin,
        assignmentId,
        actor,
        entityId,
      });
    } else {
      return json(
        req,
        { error: "Provide ?assignmentId or ?resourceContextId.", trace_id: traceId },
        { status: 400 }
      );
    }

    return json(req, {
      ok: true,
      trace_id: traceId,
      pillar: "P2",
      tenant_id: actor.districtTenantId,
      entity_id: entityId,
      assignment_resource: row ?? null,
    });
  } catch (e) {
    return handleError(req, e, traceId);
  }
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const { actor, entityId } = await resolveActor(req);
    const admin = createAdminClient();
    const rawBody = await req.json();
    const row = await upsertAssignmentResource({
      admin,
      actor,
      input: rawBody,
      entityId,
    });
    return json(req, {
      ok: true,
      trace_id: traceId,
      pillar: "P2",
      tenant_id: actor.districtTenantId,
      assignment_resource: row,
    });
  } catch (e) {
    return handleError(req, e, traceId);
  }
}

function handleError(req: NextRequest, e: unknown, traceId: string) {
  if (e instanceof EducationPolicyHaltError) {
    const status =
      e.code === "EDU_AUTH_REQUIRED"
        ? 401
        : e.code === "EDU_CATALOG_NOT_FOUND"
          ? 404
          : 403;
    return json(req, { error: e.message, code: e.code, trace_id: traceId }, { status });
  }
  if (e instanceof ZodError) {
    return json(
      req,
      { error: "Invalid request body", details: e.flatten(), trace_id: traceId },
      { status: 400 }
    );
  }
  const message = e instanceof Error ? e.message : String(e);
  console.error("[api/msgf/education/teacher/assignment-resources]", e);
  return json(req, { error: message, trace_id: traceId }, { status: 500 });
}
