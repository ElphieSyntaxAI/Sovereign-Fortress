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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * GET /api/msgf/dashboard/daily-reports — per-repo daily governance snapshots (isolated by project_origin).
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import {
  DAILY_REPORTS_UNSCOPED_ORIGIN,
  fetchDailyReportsHistoryByProject,
  type DailyReportDaySnapshot,
} from "@/lib/services/daily-reports-history";
import { listUserProjects } from "@/lib/services/user-projects";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lookbackRaw = url.searchParams.get("lookback_days");
  const lookbackDays = Number(lookbackRaw ?? "120");
  const lb = Number.isFinite(lookbackDays) ? Math.min(Math.max(lookbackDays, 7), 365) : 120;
  const filterOrigin = url.searchParams.get("project_origin")?.trim() || null;

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
  const rows = await listUserProjects(admin, user.id).catch(() => []);
  const scopes = rows.map((p) => ({
    project_origin: p.project_origin,
    display_name: p.display_name,
  }));

  let projects = await fetchDailyReportsHistoryByProject(admin, user.id, scopes, lb);

  if (filterOrigin) {
    projects = projects.filter((p) => p.project_origin === filterOrigin);
  }

  return NextResponse.json({
    ok: true,
    lookback_days: lb,
    isolation: "per_repo" as const,
    mapped_project_count: scopes.length,
    projects,
    /** @deprecated Use `projects[].days` — kept empty so older clients do not show a blended timeline. */
    days: [] as DailyReportDaySnapshot[],
    unscoped_origin: DAILY_REPORTS_UNSCOPED_ORIGIN,
  });
}
