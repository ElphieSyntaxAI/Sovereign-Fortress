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
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
import { NextRequest, NextResponse } from "next/server";

import {
  ecoAggregatorClient,
  MasterEcoPayloadBodySchema,
  validateMasterEcoBearer,
} from "@/lib/services/EcoAggregatorClient";
import { hasLiveDashboardDatabaseEnv } from "@/lib/services/dashboard-orchestration";
import { createAdminClient } from "@/utils/supabase/admin";

function masterSupabaseOrUndefined() {
  return hasLiveDashboardDatabaseEnv() ? createAdminClient() : undefined;
}

export async function GET() {
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
