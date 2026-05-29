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
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  ecoAggregatorClient,
  MasterEcoPayloadBodySchema,
  validateMasterEcoBearer,
} from "@/lib/services/EcoAggregatorClient";
import { hasLiveDashboardDatabaseEnv } from "@/lib/services/dashboard-orchestration";
import {
  assertSessionOperatorIsAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

function masterSupabaseOrUndefined() {
  return hasLiveDashboardDatabaseEnv() ? createAdminClient() : undefined;
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const op = await resolveSessionDashboardOperator(admin, user);
  try {
    assertSessionOperatorIsAdmin(op);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Admin operator access required." },
      { status: 403 }
    );
  }

  try {
    const leaderboard = await ecoAggregatorClient.getLeaderboard(masterSupabaseOrUndefined());
    return NextResponse.json({ ok: true, leaderboard });
  } catch (error) {
    console.warn("[master/eco-rollups] GET live read failed; returning mock leaderboard.", {
      message: error instanceof Error ? error.message : "Unknown leaderboard error",
    });
    const leaderboard = await ecoAggregatorClient.getLeaderboard(undefined);
    return NextResponse.json({ ok: true, leaderboard });
  }
}

export async function POST(req: NextRequest) {
  if (!validateMasterEcoBearer(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Invalid master telemetry token." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = MasterEcoPayloadBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const rollup = await ecoAggregatorClient.recordIncomingPayload(
      parsed.data,
      masterSupabaseOrUndefined()
    );
    return NextResponse.json({ ok: true, rollup });
  } catch (error) {
    console.warn("[master/eco-rollups] POST live write failed; recording mock rollup.", {
      message: error instanceof Error ? error.message : "Unknown rollup write error",
    });
    const rollup = await ecoAggregatorClient.recordIncomingPayload(parsed.data, undefined);
    return NextResponse.json({ ok: true, rollup, source: "mock" });
  }
}
