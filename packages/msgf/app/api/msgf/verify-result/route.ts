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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * POST /api/msgf/verify-result — log build/test outcome after dev heal (P3 audit loop).
 */

import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { MSGF_TENANT_KEY_HEADER } from "@/lib/msgf-http-headers";
import { DevEventValidationError } from "@/lib/schemas/dev-event";
import { VerifyResultBodySchema } from "@/lib/schemas/verify-result";
import { IdeApiAuthError } from "@/lib/services/ide-api-auth";
import { resolveVerifyResultActor } from "@/lib/services/verify-result-auth";
import { persistVerifyResult } from "@/lib/services/verify-result-service";
import { recordVerifyResultSavingsEffects } from "@/lib/services/verify-result-savings";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return json(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = VerifyResultBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return json(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const tenantKey =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() || parsed.data.tenant_id.trim();
    const { admin, entityId } = await resolveVerifyResultActor(req, tenantKey);
    const result = await persistVerifyResult(admin, {
      ...parsed.data,
      actor_id: parsed.data.actor_id?.trim() || entityId,
    });

    void recordVerifyResultSavingsEffects({
      tenantKey,
      body: parsed.data,
      ledger: {
        hall_persisted: result.hall_persisted ?? false,
        vault_persisted: result.vault_persisted ?? false,
        verify_fail_count: result.verify_fail_count ?? 0,
      },
    });

    return json(req, {
      ok: true,
      narrative_log_id: result.narrative_log_id,
      severity: result.severity,
      passed: parsed.data.passed,
      hall_persisted: result.hall_persisted ?? false,
      vault_persisted: result.vault_persisted ?? false,
      verify_fail_count: result.verify_fail_count ?? 0,
    });
  } catch (e: unknown) {
    if (e instanceof DevEventValidationError) {
      return json(req, { ok: false, error: e.message, issues: e.issues }, { status: e.status });
    }
    if (e instanceof IdeApiAuthError) {
      return json(req, { ok: false, error: e.message }, { status: e.status });
    }
    if (e instanceof MsgfAdminAuthError) {
      return json(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "verify-result failed";
    console.error("[verify-result]", e);
    return json(req, { ok: false, error: msg }, { status: 500 });
  }
}
