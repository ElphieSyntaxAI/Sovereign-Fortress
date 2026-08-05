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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveDashboardOperator } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { absorbGlobalInsightIntoBrain } from "@/lib/services/global-insight";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

const bodySchema = z.object({
  narrative_log_id: z.string().uuid(),
});

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * POST /api/msgf/admin/global-insight/absorb
 * GLOBAL_ADMIN — copy anonymized logic pattern into global_vault (Cross-Ref / training lineage).
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role !== "GLOBAL_ADMIN") {
      return adminJson(
        req,
        { ok: false, error: "Only global operators can absorb into the Global Brain." },
        { status: 403 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await absorbGlobalInsightIntoBrain({
      admin,
      sourceNarrativeLogId: parsed.data.narrative_log_id,
      absorbedByActorId: op.operatorUserId,
    });

    return adminJson(req, {
      ok: true,
      already_absorbed: result.already_absorbed,
      vault_narrative_log_id: result.vault_narrative_log_id,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Absorb failed.";
    console.error("[admin/global-insight/absorb] POST", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
