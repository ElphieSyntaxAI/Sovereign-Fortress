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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * POST /api/msgf/report-issue — unified incident report + dev handoff metadata.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  applyIncidentReportCorsHeaders,
  incidentReportCorsPreflightResponse,
} from "@/lib/msgf-cors";
import { ReportIssueBodySchema } from "@/lib/schemas/report-issue";
import { orchestrateReportIssue } from "@/lib/services/report-issue-orchestrator";
import { createAdminClient } from "@/utils/supabase/admin";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyIncidentReportCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return incidentReportCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return json(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = ReportIssueBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return json(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      message,
      location: locRaw,
      tenant_id: tenantRaw,
      source,
      operator_note,
      entity_id,
      diagnostic_snapshot,
    } = parsed.data;
    const location =
      locRaw?.trim() ||
      req.headers.get("referer")?.slice(0, 4000) ||
      req.headers.get("x-msgf-location")?.slice(0, 4000) ||
      "";
    const tenant_id =
      tenantRaw?.trim() ||
      req.headers.get("x-msgf-tenant-key")?.trim() ||
      req.headers.get("origin")?.trim() ||
      "unknown";

    const admin = createAdminClient();
    const result = await orchestrateReportIssue(admin, {
      message,
      location,
      tenant_id,
      source,
      operator_note,
      entity_id,
      diagnostic_snapshot,
    });

    if (!result.ok) {
      return json(
        req,
        { ok: false, error: result.error, detail: result.detail },
        { status: 503 }
      );
    }

    return json(req, result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "report-issue failed";
    console.error("[report-issue]", e);
    return json(req, { ok: false, error: msg }, { status: 500 });
  }
}
