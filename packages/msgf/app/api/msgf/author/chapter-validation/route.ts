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
 * POST /api/msgf/author/chapter-validation
 *
 * Validates a chapter payload against:
 *   • World Bible §1.0 (immutable laws — physics / planetary / spatial / magic)
 *   • Trope/Sensitivity Sheet §1.0–§2.0 (cultural taboos)
 *
 * Returns:
 *   • 422 with `structural_exceptions[]` when the chapter breaks the Static
 *     Ledger (Test 1 path — Constraint Check).
 *   • 200 with `tension_before`, `tension_after`, `omens[]` after persisting
 *     to `author_tension_ledger` + `author_cultural_omens` (Test 2 path —
 *     State Mutation Check).
 *
 * Auth — two modes:
 *   1) Standard Supabase user session → tenant_id derived from
 *      `p4_profiles.tenant_id` for the signed-in user.
 *   2) Integration-test mode: header `X-MSGF-Integration-Test-Token` must equal
 *      env `MSGF_INTEGRATION_TEST_TOKEN` (which must also be non-empty). The
 *      caller-supplied `tenantId` is honored. This is the mode used by the
 *      `tests/author-logic-validation.test.ts` suite when run against a live
 *      Cloud Run deployment.
 */
import { randomUUID } from "crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  ChapterValidationError,
  ChapterValidationRequestSchema,
  runChapterValidation,
} from "@/lib/author/chapter-validation-controller";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

const INTEGRATION_TEST_TOKEN_HEADER = "x-msgf-integration-test-token";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyPulseCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

type ResolvedActor = {
  tenantId: string;
  mode: "user_session" | "integration_test";
};

async function resolveActor(
  req: NextRequest,
  body: { tenantId?: string }
): Promise<ResolvedActor> {
  const testTokenHeader = req.headers.get(INTEGRATION_TEST_TOKEN_HEADER)?.trim();
  const expectedTestToken = process.env.MSGF_INTEGRATION_TEST_TOKEN?.trim();
  if (
    testTokenHeader &&
    expectedTestToken &&
    testTokenHeader === expectedTestToken
  ) {
    if (!body.tenantId) {
      throw new ChapterValidationError(
        "Integration-test mode requires `tenantId` in the request body.",
        "AUTHOR_TENANT_REQUIRED"
      );
    }
    return { tenantId: body.tenantId, mode: "integration_test" };
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new ChapterValidationError(
      "Unauthorized — sign in or supply the integration test token.",
      "AUTHOR_AUTH_REQUIRED"
    );
  }
  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from("p4_profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileErr) {
    throw new ChapterValidationError(
      `Profile lookup failed: ${profileErr.message}`,
      "AUTHOR_PERSIST_FAILED"
    );
  }
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const tenantId =
    (typeof profile?.tenant_id === "string" && profile.tenant_id.trim()) ||
    (typeof meta?.tenant_id === "string" && (meta.tenant_id as string).trim()) ||
    "";
  if (!tenantId) {
    throw new ChapterValidationError(
      "User has no tenant binding — cannot validate manuscripts.",
      "AUTHOR_TENANT_REQUIRED"
    );
  }
  return { tenantId, mode: "user_session" };
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const rawBody = (await req.json()) as Record<string, unknown>;
    const request = ChapterValidationRequestSchema.parse(rawBody);
    const actor = await resolveActor(req, request);

    const admin = createAdminClient();
    const result = await runChapterValidation({
      admin,
      tenantId: actor.tenantId,
      request,
    });

    const responsePayload = {
      ok: !result.structuralExceptionRaised,
      trace_id: traceId,
      validation_id: result.validationId,
      mode: actor.mode,
      tenant_id: actor.tenantId,
      structural_exceptions: result.structuralExceptions,
      omens: result.omensTriggered,
      tension_before: result.tensionBefore,
      tension_after: result.tensionAfter,
      tension_delta: result.tensionDelta,
    };

    return json(
      req,
      responsePayload,
      // 422 = Unprocessable Entity (chapter is syntactically valid but
      // logically violates the Static Ledger). 200 otherwise — including
      // when cultural taboos triggered and the State Ledger was mutated.
      { status: result.structuralExceptionRaised ? 422 : 200 }
    );
  } catch (e) {
    return handleError(req, e, traceId);
  }
}

function handleError(req: NextRequest, e: unknown, traceId: string) {
  if (e instanceof ZodError) {
    return json(
      req,
      {
        error: "Invalid request body.",
        details: e.flatten(),
        trace_id: traceId,
      },
      { status: 400 }
    );
  }
  if (e instanceof ChapterValidationError) {
    const status =
      e.code === "AUTHOR_AUTH_REQUIRED"
        ? 401
        : e.code === "AUTHOR_TENANT_REQUIRED"
          ? 400
          : e.code === "AUTHOR_VALIDATION_DISABLED"
            ? 503
            : 500;
    return json(
      req,
      { error: e.message, code: e.code, trace_id: traceId },
      { status }
    );
  }
  const message = e instanceof Error ? e.message : String(e);
  console.error("[api/msgf/author/chapter-validation]", e);
  return json(req, { error: message, trace_id: traceId }, { status: 500 });
}
