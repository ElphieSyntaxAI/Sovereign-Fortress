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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
import { NextResponse } from "next/server";

import {
  buildPillarLiveLogsFromReport,
  hasLiveDashboardDatabaseEnv,
  mockDashboardHealthReport,
  parsePillarParam,
} from "@/lib/services/dashboard-orchestration";
import { healthService } from "@/lib/services/HealthService";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(
  _req: Request,
  context: { params: Promise<{ pillar: string }> }
) {
  const { pillar: rawPillar } = await context.params;
  const pillar = parsePillarParam(rawPillar);
  const report = hasLiveDashboardDatabaseEnv()
    ? await healthService.getPillarHealth(createAdminClient(), { userId: null, lookbackHours: 168 })
    : mockDashboardHealthReport();

  return NextResponse.json({
    ok: true,
    source: hasLiveDashboardDatabaseEnv() ? "live" : "mock",
    logs: buildPillarLiveLogsFromReport(report, pillar),
  });
}
