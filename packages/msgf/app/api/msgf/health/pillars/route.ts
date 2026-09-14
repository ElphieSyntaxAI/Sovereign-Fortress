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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";
import {
  healthOptionsForSessionOperator,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import {
  parseDashboardHealthScope,
  personalHealthOptionsForUser,
  resolveHealthOptionsForDashboardRequest,
} from "@/lib/dashboard-health-scope";
import {
  MSGF_PERSONAL_SANDBOX_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  listUserIdsForCompany,
  resolveDashboardOperator,
} from "@/lib/msgf-operator-access";
import { healthService } from "@/lib/services/HealthService";
import {
  verifyIdeToken,
  verifyIdeTokenDiagnostic,
} from "@/lib/services/ide-token-service";
import { extractBearerTokenFromRequest } from "@/lib/services/pulse-license";
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
        const lookbackHours = Number(req.nextUrl.searchParams.get("lookback_hours") ?? "168");
        const lb = Number.isFinite(lookbackHours) ? lookbackHours : 168;
        const scope = parseDashboardHealthScope(req.nextUrl.searchParams.get("scope"));
        const tenantKey =
          req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
          req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
          "";
        const bearer = extractBearerTokenFromRequest(req);
        let sessionResolved = false;

        if (bearer?.startsWith("msgf_ide_")) {
          const diag = await verifyIdeTokenDiagnostic(admin, bearer, tenantKey || undefined);
          if (diag.status === "tenant_mismatch") {
            return healthJson(
              req,
              {
                ok: false,
                error: `Tenant mismatch: IDE token is for "${diag.token_tenant_id}" but X-MSGF-Tenant-Key is "${diag.header_tenant_id}".`,
                code: "TENANT_MISMATCH",
              },
              { status: 403 }
            );
          }
          const verified =
            diag.status === "ok" ? diag.token : await verifyIdeToken(admin, bearer, tenantKey || undefined);
          if (!verified) {
            return healthJson(req, { ok: false, error: "Unauthorized" }, { status: 401 });
          }
          reportOptions = personalHealthOptionsForUser(
            verified.user_id,
            lb,
            tenantKey ? [tenantKey] : undefined
          );
          global = false;
          sessionResolved = true;
        } else if (bearer && !bearer.startsWith("msgf_live_")) {
          const { data, error: jwtError } = await admin.auth.getUser(bearer);
          if (!jwtError && data.user) {
            reportOptions = tenantKey
              ? personalHealthOptionsForUser(data.user.id, lb, [tenantKey])
              : await resolveHealthOptionsForDashboardRequest(admin, data.user, {
                  lookbackHours: lb,
                  scope,
                });
            global =
              scope === "operator" &&
              (await resolveSessionDashboardOperator(admin, data.user)).role === "GLOBAL_ADMIN";
            sessionResolved = true;
          }
        }

        if (!sessionResolved) {
          const cookieStore = await cookies();
          const supabase = createSupabaseServerClient(cookieStore, requestHostFromRequest(req));
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user) {
            return healthJson(req, { ok: false, error: "Unauthorized" }, { status: 401 });
          }
          reportOptions = await resolveHealthOptionsForDashboardRequest(admin, user, {
            lookbackHours: lb,
            scope,
          });
          global =
            scope === "operator" &&
            (await resolveSessionDashboardOperator(admin, user)).role === "GLOBAL_ADMIN";
        }
      } else {
        throw e;
      }
    }

    const projectOriginRaw = req.nextUrl.searchParams.get("project_origin")?.trim();
    const projectOrigin = projectOriginRaw
      ? sanitizeTenantScope(projectOriginRaw)
      : undefined;
    if (projectOrigin && reportOptions.userId) {
      reportOptions = {
        ...reportOptions,
        projectOrigins: [projectOrigin],
      };
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
