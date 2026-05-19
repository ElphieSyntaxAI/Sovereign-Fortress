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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
 */
/**
 * POST /api/msgf/education/student/reading-gate
 *   → fired by the student workspace once a focus block on the embedded reader pane
 *     meets the slice's `min_focus_block_ms` threshold (pillars §2.2.1).
 *
 * GET  /api/msgf/education/student/reading-gate?resourceContextId=<uuid>
 *   → returns the most recent gate-satisfaction beat (if any) so the workspace can
 *     start with composition unlocked on a returning visit.
 */
import { randomUUID } from "crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";
import {
  evaluateReadingGate,
  loadReadingGateStatus,
} from "@/lib/education/reading-gate";
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

async function resolveStudent(req: NextRequest): Promise<{
  tenantId: string;
  entityId: string;
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
  const tenantId = resolveTenantIdForPillars(
    headerTenant || String(meta?.tenant_id ?? "syntax_education"),
    meta
  );
  const entityId = req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() || user.id;
  return { tenantId, entityId };
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const { tenantId, entityId } = await resolveStudent(req);
    const admin = createAdminClient();
    const body = await req.json();
    const result = await evaluateReadingGate({ admin, tenantId, entityId, body });
    return json(req, {
      ok: true,
      trace_id: traceId,
      pillar: "P2",
      tenant_id: tenantId,
      entity_id: entityId,
      result,
    });
  } catch (e) {
    return handleError(req, e, traceId);
  }
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const { tenantId, entityId } = await resolveStudent(req);
    const { searchParams } = new URL(req.url);
    const resourceContextId = searchParams.get("resourceContextId");
    if (!resourceContextId) {
      return json(
        req,
        { error: "Missing ?resourceContextId=<uuid>.", trace_id: traceId },
        { status: 400 }
      );
    }
    const admin = createAdminClient();
    const status = await loadReadingGateStatus({
      admin,
      tenantId,
      entityId,
      resourceContextId,
    });
    return json(req, {
      ok: true,
      trace_id: traceId,
      pillar: "P2",
      tenant_id: tenantId,
      resource_context_id: resourceContextId,
      status,
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
        : e.code === "EDU_RESOURCE_NOT_FOUND"
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
  console.error("[api/msgf/education/student/reading-gate]", e);
  return json(req, { error: message, trace_id: traceId }, { status: 500 });
}
