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
 * POST /api/msgf/ops/shadow-trial-reports
 * Send end-of-trial Shadow Proxy savings reports (Cloud Scheduler / cron).
 */

import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError, assertMsgfOpsCron } from "@/lib/msgf-admin-auth";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { processDueShadowTrialReports } from "@/lib/services/shadow-trial";
import { processDueShadowTrialFullAccessExpiries } from "@/lib/services/shadow-trial-full-access";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    assertMsgfOpsCron(req);
    const admin = createAdminClient();
    const reports = await processDueShadowTrialReports(admin);
    const fullAccess = await processDueShadowTrialFullAccessExpiries(admin);
    return adminJson(req, {
      ok: true,
      ...reports,
      full_access_expired: fullAccess.expired,
      errors: [...reports.errors, ...fullAccess.errors],
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "shadow-trial-reports failed";
    console.error("[ops/shadow-trial-reports]", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
