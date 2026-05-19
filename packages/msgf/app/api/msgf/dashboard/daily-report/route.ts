/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import { NextResponse } from "next/server";

import { hasLiveDashboardDatabaseEnv } from "@/lib/services/dashboard-orchestration";
import { telemetryService } from "@/lib/services/TelemetryService";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  const result = await telemetryService.generateDailyDigest(
    hasLiveDashboardDatabaseEnv() ? createAdminClient() : undefined
  );

  return NextResponse.json({
    ok: true,
    source: result.mode,
    report: result.report,
  });
}
