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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Server-side IDE connectivity probes for GET /api/msgf/ide/connectivity-check.
 */

import type { NextRequest } from "next/server";

import type { IdeConnectivityCheckResult, MsgfIdeErrorCode } from "@/lib/ide-error-codes";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_IDE_PULSE_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import {
  ideTenantKeysAlignForLicense,
  operationalTenantForLocalPath,
  operationalTenantForProjectOrigin,
} from "@/lib/ide-tenant-alignment";
import { healthService } from "@/lib/services/HealthService";
import {
  verifyIdeToken,
  verifyIdeTokenDiagnostic,
} from "@/lib/services/ide-token-service";
import {
  assertPulseLicense,
  extractBearerTokenFromRequest,
} from "@/lib/services/pulse-license";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@supabase/supabase-js";

function check(
  partial: Omit<IdeConnectivityCheckResult, "ok"> & { ok: boolean }
): IdeConnectivityCheckResult {
  return partial;
}

async function resolveJwtUserId(
  bearer: string
): Promise<{ userId: string } | { error: MsgfIdeErrorCode }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return { error: "SERVER_ERROR" };
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(bearer);
  if (error || !data.user?.id) {
    const msg = error?.message?.toLowerCase() ?? "";
    if (msg.includes("expired") || msg.includes("invalid")) return { error: "AUTH_EXPIRED" };
    return { error: "AUTH_INVALID" };
  }
  return { userId: data.user.id };
}

export async function runIdeConnectivityChecks(req: NextRequest): Promise<IdeConnectivityCheckResult[]> {
  const checks: IdeConnectivityCheckResult[] = [];
  const t0 = Date.now();

  const tenantKey =
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
    "";
  const entityId = req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() || "";
  const bearer = extractBearerTokenFromRequest(req);
  const idePulse = req.headers.get(MSGF_IDE_PULSE_HEADER)?.trim() === "1";

  if (!idePulse) {
    checks.push(
      check({
        name: "ide_headers",
        ok: false,
        error_code: "AUTH_INVALID",
        user_message: "Missing x-msgf-ide-pulse: 1 header.",
        fix_steps: ["Use msgf-pulse-guard or MSGF: Test connection from the extension."],
      })
    );
    return checks;
  }

  if (!tenantKey) {
    checks.push(
      check({
        name: "tenant_key",
        ok: false,
        error_code: "AUTH_INVALID",
        user_message: "msgf.tenantKey is required (X-MSGF-Tenant-Key).",
        fix_steps: [
          "Set msgf.tenantKey in .vscode/settings.json to your mapped project_origin.",
        ],
      })
    );
  } else {
    checks.push(
      check({
        name: "tenant_key",
        ok: true,
        latency_ms: Date.now() - t0,
        user_message: `Tenant: ${tenantKey}`,
      })
    );
  }

  if (!entityId) {
    checks.push(
      check({
        name: "entity_id",
        ok: false,
        error_code: "AUTH_INVALID",
        user_message: "x-msgf-entity-id is required.",
        fix_steps: ["Reload the extension; entity id is assigned automatically on first run."],
      })
    );
  } else {
    checks.push(
      check({
        name: "entity_id",
        ok: true,
        user_message: `Entity: ${entityId.slice(0, 8)}…`,
      })
    );
  }

  if (!bearer) {
    checks.push(
      check({
        name: "auth_bearer",
        ok: false,
        error_code: "AUTH_MISSING",
        user_message: "Authorization Bearer token is required.",
        fix_steps: [
          "Workspace → IDE setup → Refresh token, then apply workspace settings.",
        ],
      })
    );
    return checks;
  }

  const authStart = Date.now();
  if (bearer.startsWith("msgf_ide_")) {
    try {
      const admin = createAdminClient();
      const diag = await verifyIdeTokenDiagnostic(admin, bearer, tenantKey);
      if (diag.status === "tenant_mismatch") {
        checks.push(
          check({
            name: "auth_bearer",
            ok: false,
            status: 403,
            latency_ms: Date.now() - authStart,
            error_code: "TENANT_MISMATCH",
            user_message: `Token is for "${diag.token_tenant_id}" but msgf.tenantKey is "${diag.header_tenant_id}".`,
            fix_steps: [
              `Set msgf.tenantKey to exactly: ${diag.token_tenant_id}`,
              "Workspace .vscode/settings.json overrides User settings — fix the workspace file.",
              "Reload the window after saving.",
            ],
          })
        );
        return checks;
      }
      const verified =
        diag.status === "ok" ? diag.token : await verifyIdeToken(admin, bearer, tenantKey);
      checks.push(
        check({
          name: "auth_bearer",
          ok: Boolean(verified),
          status: verified ? 200 : 401,
          latency_ms: Date.now() - authStart,
          error_code: verified ? undefined : "AUTH_INVALID",
          user_message: verified
            ? `Long-lived IDE token valid (expires per mint; ${verified.tenant_id}).`
            : "IDE token invalid or expired.",
          fix_steps: verified
            ? undefined
            : [
                "Mint a new token at Workspace → IDE setup → Mint long-lived IDE token.",
                "Align msgf.tenantKey with the mapped project.",
              ],
        })
      );
      if (!verified) return checks;
    } catch (e) {
      checks.push(
        check({
          name: "auth_bearer",
          ok: false,
          status: 503,
          latency_ms: Date.now() - authStart,
          error_code: "AUTH_INVALID",
          user_message: e instanceof Error ? e.message : "IDE token verification failed.",
        })
      );
      return checks;
    }
  } else if (bearer.startsWith("msgf_live_")) {
    try {
      const admin = createAdminClient();
      const license = await assertPulseLicense({ adminSupabase: admin, request: req });
      const mismatch = tenantKey && license.tenantId.trim() !== tenantKey.trim();
      checks.push(
        check({
          name: "auth_bearer",
          ok: !mismatch,
          status: mismatch ? 403 : 200,
          latency_ms: Date.now() - authStart,
          error_code: mismatch ? "TENANT_MISMATCH" : undefined,
          user_message: mismatch
            ? `License tenant ${license.tenantId} ≠ header ${tenantKey}`
            : "Contract license accepted.",
          fix_steps: mismatch
            ? ["Align msgf.tenantKey with your license tenant.", "Check Setup projects mapping."]
            : undefined,
        })
      );
    } catch (e) {
      const pe = e instanceof PulseHttpError ? e : null;
      checks.push(
        check({
          name: "auth_bearer",
          ok: false,
          status: pe?.status ?? 403,
          latency_ms: Date.now() - authStart,
          error_code: "AUTH_INVALID",
          user_message:
            typeof pe?.body.error === "string" ? pe.body.error : "License validation failed.",
          fix_steps: ["Verify msgf.authToken or msgf_live license key."],
        })
      );
      return checks;
    }
  } else {
    const jwt = await resolveJwtUserId(bearer);
    if ("error" in jwt) {
      checks.push(
        check({
          name: "auth_bearer",
          ok: false,
          status: 401,
          latency_ms: Date.now() - authStart,
          error_code: jwt.error,
          user_message:
            jwt.error === "AUTH_EXPIRED"
              ? "Session JWT expired."
              : "Session JWT invalid or rejected.",
          fix_steps: [
            "Refresh token at Workspace → IDE setup.",
            "Update msgf.authToken and reload the window.",
          ],
        })
      );
      return checks;
    }
    checks.push(
      check({
        name: "auth_bearer",
        ok: true,
        latency_ms: Date.now() - authStart,
        user_message: "Session JWT valid.",
      })
    );

    try {
      const admin = createAdminClient();
      const license = await assertPulseLicense({
        adminSupabase: admin,
        request: req,
        sessionEntityId: jwt.userId,
      });
      const mismatch =
        tenantKey && !ideTenantKeysAlignForLicense(license.tenantId, tenantKey);
      if (mismatch) {
        checks.push(
          check({
            name: "tenant_license",
            ok: false,
            status: 403,
            error_code: "TENANT_MISMATCH",
            user_message: `Profile/license tenant ${license.tenantId} ≠ ${tenantKey}`,
            fix_steps: [
              `Set msgf.tenantKey to your mapped project_origin (e.g. elphiesyntax/author-ecosystem), not a folder path like apps/author-ecosystem.`,
              `Your account license tenant is ${license.tenantId}; tracking still scopes via project_origin headers.`,
              "Reload the window after saving .vscode/settings.json.",
            ],
          })
        );
      } else if (tenantKey) {
        checks.push(
          check({
            name: "tenant_license",
            ok: true,
            user_message: `License tenant ${license.tenantId} aligns with ${tenantKey}.`,
          })
        );
      }
    } catch (e) {
      const pe = e instanceof PulseHttpError ? e : null;
      if (pe) {
        checks.push(
          check({
            name: "tenant_license",
            ok: false,
            status: pe.status,
            error_code: pe.status === 403 ? "ENTITLEMENT_DENIED" : "AUTH_INVALID",
            user_message:
              typeof pe.body.error === "string" ? pe.body.error : "Entitlement check failed.",
            fix_steps: ["Sign in to the dashboard once to create your profile."],
          })
        );
      }
    }
  }

  const pillarStart = Date.now();
  try {
    const admin = createAdminClient();
    const report = await healthService.getPillarHealth(admin, {
      lookbackHours: 24,
      projectOrigins: tenantKey ? [tenantKey] : undefined,
    });
    checks.push(
      check({
        name: "pillar_health",
        ok: true,
        status: 200,
        latency_ms: Date.now() - pillarStart,
        user_message: `Pillars loaded (overall: ${report.overall_status}).`,
      })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pillar health failed.";
    checks.push(
      check({
        name: "pillar_health",
        ok: false,
        status: 500,
        latency_ms: Date.now() - pillarStart,
        error_code: "SERVER_ERROR",
        user_message: msg,
        fix_steps: ["Retry MSGF: Test connection.", "If 504 persists, check Cloud Run /status."],
      })
    );
  }

  return checks;
}
