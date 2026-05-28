/**
 * POST /api/msgf/verify-result — log build/test outcome after dev heal (P3 audit loop).
 */

import { NextRequest, NextResponse } from "next/server";

import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { VerifyResultBodySchema } from "@/lib/schemas/verify-result";
import { persistVerifyResult } from "@/lib/services/verify-result-service";
import { createAdminClient } from "@/utils/supabase/admin";

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

    const admin = createAdminClient();
    const result = await persistVerifyResult(admin, parsed.data);

    return json(req, {
      ok: true,
      narrative_log_id: result.narrative_log_id,
      severity: result.severity,
      passed: parsed.data.passed,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "verify-result failed";
    console.error("[verify-result]", e);
    return json(req, { ok: false, error: msg }, { status: 500 });
  }
}
