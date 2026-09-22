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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * GET /api/shadow-trial/status?t=<status_token>
 * Public live savings for an active or completed Shadow Proxy trial.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  getShadowTrialByStatusToken,
  getShadowTrialSummary,
  sendShadowTrialReport,
} from "@/lib/services/shadow-trial";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("t")?.trim() || "";
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing status token (?t=)." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const trial = await getShadowTrialByStatusToken(admin, token);
    if (!trial) {
      return NextResponse.json(
        { ok: false, error: "Trial not found." },
        { status: 404 }
      );
    }

    const summary = await getShadowTrialSummary(admin, trial);

    if (
      summary.expired &&
      !summary.report_sent &&
      summary.first_eval_at &&
      !summary.awaiting_first_eval
    ) {
      void sendShadowTrialReport(admin, trial, token);
    }

    const recent = await admin
      .from("msgf_shadow_evaluation_logs")
      .select(
        "endpoint, model, savings_potential_usd, actual_cost_usd, observed_at, recommended_action"
      )
      .eq("tenant_id", trial.tenant_id)
      .gte("observed_at", trial.started_at)
      .order("observed_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      ok: true,
      summary,
      recent: recent.data ?? [],
      note: "Shadow projected USD is simulated savings — not proven eco.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Shadow trial status failed.";
    console.error("[shadow-trial/status]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
