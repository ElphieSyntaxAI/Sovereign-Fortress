/**
 * GET /api/msgf/dashboard/daily-reports — reverse-chronological daily governance snapshots.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import {
  fetchDailyReportsHistory,
  snapshotFromDailyNetworkReport,
} from "@/lib/services/daily-reports-history";
import { hasLiveDashboardDatabaseEnv } from "@/lib/services/dashboard-orchestration";
import { telemetryService } from "@/lib/services/TelemetryService";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const lookbackRaw = new URL(req.url).searchParams.get("lookback_days");
  const lookbackDays = Number(lookbackRaw ?? "120");
  const lb = Number.isFinite(lookbackDays) ? Math.min(Math.max(lookbackDays, 7), 365) : 120;

  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let days = await fetchDailyReportsHistory(admin, user.id, lb);

  if (hasLiveDashboardDatabaseEnv()) {
    const digest = await telemetryService.generateDailyDigest(admin);
    const todaySnap = snapshotFromDailyNetworkReport(digest.report);
    days = [todaySnap, ...days.filter((d) => d.date !== todaySnap.date)];
    days.sort((a, b) => b.date.localeCompare(a.date));
  }

  return NextResponse.json({
    ok: true,
    lookback_days: lb,
    days,
  });
}
