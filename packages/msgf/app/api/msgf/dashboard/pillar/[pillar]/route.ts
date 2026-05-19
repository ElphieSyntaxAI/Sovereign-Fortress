/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
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
