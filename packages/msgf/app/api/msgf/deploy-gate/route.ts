/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * GET /api/msgf/deploy-gate?project_origin=… — Starport / CI verify gate
 *
 * Auth: IDE bearer (msgf_ide_*) · session operator · or MSGF_OPS_CRON_SECRET Bearer
 */
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { resolveDeployGate } from "@/lib/services/deploy-gate";
import { verifyIdeToken } from "@/lib/services/ide-token-service";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

function opsCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.MSGF_OPS_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization")?.trim();
  return auth === `Bearer ${secret}`;
}

async function authorizeDeployGate(req: NextRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (opsCronAuthorized(req)) return { ok: true };

  const admin = createAdminClient();

  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  if (authHeader.toLowerCase().startsWith("bearer msgf_ide_")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const verified = await verifyIdeToken(admin, token);
    if (!verified) {
      return { ok: false, status: 401, error: "Invalid IDE token." };
    }
    return { ok: true };
  }

  try {
    await resolveOperatorForAdminRequest(req, admin);
    return { ok: true };
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      /* try cookie session below */
    } else {
      /* fall through */
    }
  }

  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { ok: true };

  return {
    ok: false,
    status: 401,
    error: "Auth required (IDE token, admin session, or MSGF_OPS_CRON_SECRET).",
  };
}

export async function GET(req: NextRequest) {
  const auth = await authorizeDeployGate(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const projectOrigin =
    req.nextUrl.searchParams.get("project_origin")?.trim() ||
    req.nextUrl.searchParams.get("tenant_id")?.trim() ||
    "";

  if (!projectOrigin) {
    return NextResponse.json(
      { ok: false, error: "project_origin query param required." },
      { status: 400 }
    );
  }

  const maxAgeRaw = req.nextUrl.searchParams.get("max_age_hours");
  const maxAgeHours = maxAgeRaw ? Number.parseInt(maxAgeRaw, 10) : undefined;

  const admin = createAdminClient();
  const gate = await resolveDeployGate(admin, {
    projectOrigin,
    maxAgeHours: Number.isFinite(maxAgeHours) ? maxAgeHours : undefined,
  });

  return NextResponse.json({
    ok: gate.ok,
    status: gate.status,
    project_origin: gate.project_origin,
    last_verify_at: gate.last_verify_at,
    passed: gate.passed,
    narrative_log_id: gate.narrative_log_id,
    max_age_hours: gate.max_age_hours,
    message: gate.message,
    deploy_allowed: gate.ok,
  });
}
