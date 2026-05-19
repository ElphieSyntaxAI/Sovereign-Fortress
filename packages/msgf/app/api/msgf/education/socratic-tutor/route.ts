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
 * POST /api/msgf/education/socratic-tutor
 *
 * Syntax Education Socratic Tutor — P6 curriculum RAG + Vault strengths + P1-gated CONVERGE.
 */
import { randomUUID } from "crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";
import { askSocraticTutor } from "@/lib/services/socratic-tutor-controller";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyPulseCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json(req, { error: "Unauthorized", trace_id: traceId }, { status: 401 });
    }

    const headerTenant =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
    const userMetadata = user.user_metadata as Record<string, unknown> | undefined;
    const tenantId = resolveTenantIdForPillars(
      headerTenant || String(userMetadata?.tenant_id ?? "syntax_education"),
      userMetadata
    );

    const entityId =
      req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() || user.id;

    const rawBody = await req.json();
    const result = await askSocraticTutor({
      supabase,
      tenantId,
      entityId,
      body: rawBody,
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      pillar: "P2",
      subsystems: ["P1", "P6"],
      tenant_id: tenantId,
      entity_id: entityId,
      reply: result.reply,
      scaffold_questions: result.scaffoldQuestions,
      consensus: result.consensus,
      curriculum_shard_ids: result.curriculumShardIds,
      vault_strength_ids: result.strengthIds,
      lineage_filter: result.lineageFilter ?? null,
      suggested_hall_index: result.suggestedHallIndex ?? null,
    });
  } catch (e) {
    if (e instanceof EducationPolicyHaltError) {
      return json(
        req,
        { error: e.message, code: e.code, trace_id: traceId },
        { status: 403 }
      );
    }
    if (e instanceof ZodError) {
      return json(
        req,
        { error: "Invalid request body", details: e.flatten(), trace_id: traceId },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/msgf/education/socratic-tutor]", e);
    return json(req, { error: message, trace_id: traceId }, { status: 500 });
  }
}

/**
 * Service-role tutor (sandbox BFF) — requires `x-msgf-entity-id`.
 */
export async function PUT(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const entityId = req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim();
    if (!entityId) {
      return json(
        req,
        { error: "x-msgf-entity-id is required.", trace_id: traceId },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const headerTenant =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
      "syntax_education";
    const tenantId = resolveTenantIdForPillars(headerTenant, null);

    const rawBody = await req.json();
    const result = await askSocraticTutor({
      supabase: adminSupabase,
      tenantId,
      entityId,
      body: rawBody,
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      tenant_id: tenantId,
      entity_id: entityId,
      reply: result.reply,
      scaffold_questions: result.scaffoldQuestions,
      consensus: result.consensus,
      curriculum_shard_ids: result.curriculumShardIds,
      vault_strength_ids: result.strengthIds,
    });
  } catch (e) {
    if (e instanceof EducationPolicyHaltError) {
      return json(
        req,
        { error: e.message, code: e.code, trace_id: traceId },
        { status: 403 }
      );
    }
    if (e instanceof ZodError) {
      return json(
        req,
        { error: "Invalid request body", details: e.flatten(), trace_id: traceId },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/msgf/education/socratic-tutor PUT]", e);
    return json(req, { error: message, trace_id: traceId }, { status: 500 });
  }
}
