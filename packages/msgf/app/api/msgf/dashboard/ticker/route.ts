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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
import { NextResponse } from "next/server";

import { hasLiveDashboardDatabaseEnv } from "@/lib/services/dashboard-orchestration";
import { telemetryService } from "@/lib/services/TelemetryService";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  const result = await telemetryService.getNotificationStream(
    hasLiveDashboardDatabaseEnv() ? createAdminClient() : undefined
  );

  return NextResponse.json({
    ok: true,
    source: result.mode,
    generated_at: result.generated_at,
    events: result.events,
  });
}
