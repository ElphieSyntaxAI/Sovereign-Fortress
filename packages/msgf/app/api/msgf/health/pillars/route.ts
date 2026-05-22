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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  healthOptionsForSessionOperator,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import {
  parseDashboardHealthScope,
  resolveHealthOptionsForDashboardRequest,
} from "@/lib/dashboard-health-scope";
import { MSGF_PERSONAL_SANDBOX_HEADER } from "@/lib/msgf-http-headers";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  listUserIdsForCompany,
  resolveDashboardOperator,
} from "@/lib/msgf-operator-access";
import { healthService } from "@/lib/services/HealthService";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  createClient as createSupabaseServerClient,
  requestHostFromRequest,
} from "@/utils/supabase/server";

function healthJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * GET /api/msgf/health/pillars
 *
 * Six-pillar stoplight health for the ops dashboard and Author App.
 *
 * - **Author session**: returns health for the signed-in user.
 * - **Admin Bearer**: optional `?user_id=<uuid>`; global operators get tenant-wide view;
 *   company operators get a **team** aggregate for their `company_id`.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    let global = false;
    let reportOptions: Parameters<typeof healthService.getPillarHealth>[1] = {};

    try {
      const op = await resolveDashboardOperator(req, admin);
      const q = req.nextUrl.searchParams.get("user_id")?.trim();
      const lookbackHours = Number(req.nextUrl.searchParams.get("lookback_hours") ?? "168");
      const lb = Number.isFinite(lookbackHours) ? lookbackHours : 168;

      if (op.role === "DEVELOPER") {
        return healthJson(
          req,
          { ok: false, error: "Admin bearer health views require company or global operator." },
          { status: 403 }
        );
      }

      if (op.role === "GLOBAL_ADMIN") {
        if (q) {
          reportOptions = { userId: q, lookbackHours: lb };
          global = false;
        } else {
          reportOptions = { userId: null, lookbackHours: lb };
          global = true;
        }
      } else if (op.role === "COMPANY_ADMIN") {
        const personalSandbox =
          req.headers.get(MSGF_PERSONAL_SANDBOX_HEADER)?.trim() === "1";

        if (!op.companyId && personalSandbox && op.operatorUserId) {
          reportOptions = {
            userId: op.operatorUserId,
            lookbackHours: lb,
            dashboardView: "tenant_health",
          };
          global = false;
        } else if (!op.companyId) {
          return healthJson(
            req,
            { ok: false, error: "Company admin requires company_id on p4_profiles." },
            { status: 403 }
          );
        } else {
        const memberIds = await listUserIdsForCompany(admin, op.companyId!);
        if (q) {
          if (!memberIds.includes(q)) {
            return healthJson(
              req,
              { ok: false, error: "user_id is not in your company." },
              { status: 403 }
            );
          }
          reportOptions = {
            userId: q,
            companyId: op.companyId,
            dashboardView: "team_overview",
            lookbackHours: lb,
          };
        } else {
          reportOptions = {
            userId: null,
            memberUserIds: memberIds,
            teamScope: true,
            companyId: op.companyId,
            dashboardView: "team_overview",
            lookbackHours: lb,
          };
          global = false;
        }
        }
      }
    } catch (e) {
      if (e instanceof MsgfAdminAuthError) {
        const cookieStore = await cookies();
        const supabase = createSupabaseServerClient(cookieStore, requestHostFromRequest(req));
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          return healthJson(req, { ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const lookbackHours = Number(req.nextUrl.searchParams.get("lookback_hours") ?? "168");
        const lb = Number.isFinite(lookbackHours) ? lookbackHours : 168;
        const scope = parseDashboardHealthScope(req.nextUrl.searchParams.get("scope"));
        reportOptions = await resolveHealthOptionsForDashboardRequest(admin, user, {
          lookbackHours: lb,
          scope,
        });
        global =
          scope === "operator" &&
          (await resolveSessionDashboardOperator(admin, user)).role === "GLOBAL_ADMIN";
      } else {
        throw e;
      }
    }

    const report = await healthService.getPillarHealth(admin, reportOptions);

    return healthJson(req, {
      ok: true,
      ...report,
      scope: {
        ...report.scope,
        global: global || report.scope.global,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load pillar health.";
    console.error("[health/pillars] GET", err);
    return healthJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
