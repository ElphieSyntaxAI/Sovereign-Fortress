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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  applyIncidentReportCorsHeaders,
  incidentReportCorsPreflightResponse,
} from "@/lib/msgf-cors";
import { orchestrateReportIssue } from "@/lib/services/report-issue-orchestrator";
import { createAdminClient } from "@/utils/supabase/admin";

const bodySchema = z.object({
  message: z.string().trim().min(1, "message required").max(8000),
  location: z.string().max(4000).optional(),
  tenant_id: z.string().max(512).optional(),
  operator_note: z.string().max(8000).optional(),
  diagnostic_snapshot: z.record(z.string(), z.unknown()).optional(),
  entity_id: z.string().max(256).optional(),
});

function incidentJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyIncidentReportCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return incidentReportCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return incidentJson(
        req,
        { ok: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return incidentJson(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { message, location: locRaw } = parsed.data;
    const location =
      locRaw?.trim() ||
      req.headers.get("referer")?.slice(0, 4000) ||
      "";

    const originTenant =
      parsed.data.tenant_id?.trim() ||
      req.headers.get("origin")?.trim() ||
      "unknown";

    const admin = createAdminClient();
    const result = await orchestrateReportIssue(admin, {
      message,
      location,
      tenant_id: originTenant,
      source: "web",
      operator_note: parsed.data.operator_note,
      entity_id: parsed.data.entity_id,
      diagnostic_snapshot: parsed.data.diagnostic_snapshot,
    });

    if (!result.ok) {
      return incidentJson(
        req,
        {
          ok: false,
          error: result.error,
          detail: result.detail,
        },
        { status: 503 }
      );
    }

    return incidentJson(req, {
      ok: true,
      dedupe_hash: result.dedupe_hash,
      occurrence_count: result.occurrence_count,
      deduplicated: result.deduplicated,
      id: result.incident_id,
      dev_handoff: result.dev_handoff,
      recommended_path: result.recommended_path,
      user_resume_message: result.user_resume_message,
      escalated_to_arbitrate: result.escalated_to_arbitrate,
      reasoning_summary: result.reasoning_summary,
      logic_drift: result.logic_drift,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Incident report failed";
    console.error("incidents/report", e);
    return incidentJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
