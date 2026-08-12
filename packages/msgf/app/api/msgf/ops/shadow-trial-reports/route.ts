/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * POST /api/msgf/ops/shadow-trial-reports
 * Send end-of-trial Shadow Proxy savings reports (Cloud Scheduler / cron).
 */

import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError, assertMsgfOpsCron } from "@/lib/msgf-admin-auth";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { processDueShadowTrialReports } from "@/lib/services/shadow-trial";
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
    const result = await processDueShadowTrialReports(admin);
    return adminJson(req, { ok: true, ...result });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "shadow-trial-reports failed";
    console.error("[ops/shadow-trial-reports]", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
