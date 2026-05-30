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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * POST /api/msgf/dev-event
 * Structured IDE events (Option B) — build failures without Pulse / biometric pipeline.
 *
 * Body: { kind: "build_failed", activeFile, excerpt, exitCode, tenantId }
 */

import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { DevEventValidationError, parseDevEventBody } from "@/lib/schemas/dev-event";
import { resolveDevEventActor } from "@/lib/services/dev-event-auth";
import { IdeApiAuthError } from "@/lib/services/ide-api-auth";
import { runDevEventBuildHeal } from "@/lib/services/dev-event-build-heal";
import { isCostRunawayError } from "@/lib/services/cost-runaway-guard";

function devEventJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return devEventJson(
        req,
        {
          ok: false,
          error: "DEV_EVENT_VALIDATION_ERROR",
          message: "Invalid JSON body.",
          issues: [{ path: "body", message: "Expected JSON object" }],
        },
        { status: 400 }
      );
    }

    const body = parseDevEventBody(raw);
    const { admin, entityId } = await resolveDevEventActor(req, body.tenantId);

    const result = await runDevEventBuildHeal({
      adminSupabase: admin,
      entityId,
      body,
    });

    return devEventJson(req, {
      ...result,
      logic_drift_bypassed: true,
      biometric_validation_skipped: true,
    });
  } catch (e) {
    if (e instanceof DevEventValidationError) {
      return devEventJson(
        req,
        { ok: false, error: e.code, message: e.message, issues: e.issues },
        { status: e.status }
      );
    }
    if (e instanceof IdeApiAuthError) {
      return devEventJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    if (e instanceof MsgfAdminAuthError) {
      return devEventJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    if (isCostRunawayError(e)) {
      return devEventJson(
        req,
        {
          ok: false,
          error: "COST_RUNAWAY",
          message: e instanceof Error ? e.message : "LLM cost guard tripped",
        },
        { status: 429 }
      );
    }
    const message = e instanceof Error ? e.message : "dev-event failed";
    console.error("[dev-event]", e);
    return devEventJson(req, { ok: false, error: message }, { status: 500 });
  }
}
