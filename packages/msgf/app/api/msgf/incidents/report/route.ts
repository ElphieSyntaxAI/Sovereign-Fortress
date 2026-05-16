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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
 */
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  applyIncidentReportCorsHeaders,
  incidentReportCorsPreflightResponse,
} from "@/lib/msgf-cors";
import { createAdminClient } from "@/utils/supabase/admin";

const bodySchema = z.object({
  message: z.string().trim().min(1, "message required").max(8000),
  location: z.string().max(4000).optional(),
  tenant_id: z.string().max(512).optional(),
});

function incidentJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyIncidentReportCorsHeaders(req, res);
}

function dedupeInput(message: string, location: string): string {
  return `${message}\n${location}`;
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

    const dedupeHash = createHash("sha256")
      .update(dedupeInput(message, location), "utf8")
      .digest("hex");

    const supabase = createAdminClient();

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "p4_upsert_active_incident",
      {
        p_dedupe_hash: dedupeHash,
        p_tenant_id: originTenant,
        p_error_message: message,
        p_location: location,
        p_severity: "Yellow",
      }
    );

    if (rpcError) {
      console.error("p4_upsert_active_incident", rpcError);
      return incidentJson(
        req,
        {
          ok: false,
          error:
            "Database rejected the report. Apply migration 20260506203000_p4_active_incidents.sql if this table is missing.",
          detail: rpcError.message,
        },
        { status: 503 }
      );
    }

    let row = rpcData as unknown;
    if (typeof row === "string") {
      try {
        row = JSON.parse(row) as Record<string, unknown>;
      } catch {
        row = null;
      }
    }
    const out = row as {
      id?: string;
      occurrence_count?: number;
      deduplicated?: boolean;
    } | null;

    return incidentJson(req, {
      ok: true,
      dedupe_hash: dedupeHash,
      occurrence_count: out?.occurrence_count ?? 1,
      deduplicated: Boolean(out?.deduplicated),
      id: out?.id ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Incident report failed";
    console.error("incidents/report", e);
    return incidentJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
