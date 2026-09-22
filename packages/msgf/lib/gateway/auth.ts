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
 * Gateway key authentication — tenant always from DB, never from client headers.
 */

import { createHash } from "crypto";

import type { NextRequest } from "next/server";

import { MSGF_KEY_HEADER, type MsgfGatewayProvider } from "@/lib/gateway/types";
import {
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { verifyIdeToken } from "@/lib/services/ide-token-service";
import {
  isShadowTrialFullAccessLive,
  isShadowTrialLicenseTier,
  isShadowTrialTenantId,
} from "@/lib/services/shadow-trial-clock";
import { createAdminClient } from "@/utils/supabase/admin";

export class GatewayAuthError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super("gateway_auth_error");
    this.status = status;
    this.body = body;
  }
}

export type GatewayKeyAuthResult = {
  tenantId: string;
  msgfKeyPresent: boolean;
  keyKind: "live" | "test" | "ide" | "demo";
  tierId?: string | null;
  forceShadowMode?: boolean;
};

function sha256HexUtf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function trialForcesShadowMode(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  tierId?: string | null
): Promise<boolean> {
  if (!isShadowTrialLicenseTier(tierId) && !isShadowTrialTenantId(tenantId)) {
    return false;
  }
  try {
    const { data } = await admin
      .from("msgf_shadow_trials")
      .select("full_access_expires_at")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    return !isShadowTrialFullAccessLive(
      typeof data?.full_access_expires_at === "string"
        ? data.full_access_expires_at
        : null
    );
  } catch {
    return true;
  }
}

export function isDemoTenantAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.ALLOW_DEMO_TENANT === "true" ||
    process.env.MSGF_SHADOW_ALLOW_DEMO_TENANT === "1" ||
    process.env.MSGF_SHADOW_ALLOW_DEMO_TENANT === "true"
  );
}

export function extractMsgfKeyFromRequest(req: NextRequest): string | null {
  const direct = req.headers.get(MSGF_KEY_HEADER)?.trim();
  if (direct) return direct;
  const license = req.headers.get("x-msgf-license-key")?.trim();
  if (
    license?.startsWith("msgf_live_") ||
    license?.startsWith("msgf_test_") ||
    license?.startsWith("msgf_ide_")
  ) {
    return license;
  }
  const auth = req.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (
      token.startsWith("msgf_live_") ||
      token.startsWith("msgf_test_") ||
      token.startsWith("msgf_ide_")
    ) {
      return token;
    }
  }
  return null;
}

export function extractUpstreamApiKey(
  req: NextRequest,
  provider: MsgfGatewayProvider
): string | null {
  if (provider === "anthropic") {
    const xApi = req.headers.get("x-api-key")?.trim();
    if (xApi && !xApi.startsWith("msgf_")) return xApi;
  }
  const auth = req.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (
      token &&
      !token.startsWith("msgf_live_") &&
      !token.startsWith("msgf_test_") &&
      !token.startsWith("msgf_ide_")
    ) {
      return token;
    }
  }
  return null;
}

function clientTenantHint(req: NextRequest): string | null {
  return (
    req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    null
  );
}

/**
 * Authenticate MSGF gateway key and force tenantId from the license / IDE token record.
 * Never trusts client-supplied x-msgf-tenant-id for attribution.
 */
export async function authenticateGatewayKey(
  msgfKeyHeader: string | null,
  _rawTenantIdHeader: string | null,
  req?: NextRequest
): Promise<GatewayKeyAuthResult> {
  const msgfKey = msgfKeyHeader?.trim() || null;
  const hint = _rawTenantIdHeader?.trim() || (req ? clientTenantHint(req) : null);

  if (!msgfKey) {
    if (isDemoTenantAllowed()) {
      return {
        tenantId: "shadow_demo",
        msgfKeyPresent: false,
        keyKind: "demo",
      };
    }
    throw new GatewayAuthError(401, {
      error: {
        message:
          "MSGF gateway requires x-msgf-key (msgf_live_* / msgf_test_* / msgf_ide_*).",
        type: "authentication_error",
        code: "msgf_key_required",
      },
    });
  }

  if (msgfKey.startsWith("msgf_ide_")) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      throw new GatewayAuthError(503, {
        error: {
          message: "Unable to verify IDE token (admin client unavailable).",
          type: "authentication_error",
          code: "msgf_auth_unavailable",
        },
      });
    }
    const verified = await verifyIdeToken(admin, msgfKey);
    if (!verified?.tenant_id) {
      throw new GatewayAuthError(401, {
        error: {
          message: "Invalid or inactive IDE token.",
          type: "authentication_error",
          code: "msgf_ide_invalid",
        },
      });
    }
    const tenantId = String(verified.tenant_id);
    if (hint && hint !== tenantId) {
      console.warn(
        "[gateway/auth] ignoring spoofed x-msgf-tenant-id for ide key",
        { hint, tenantId }
      );
    }
    return {
      tenantId,
      msgfKeyPresent: true,
      keyKind: "ide",
      forceShadowMode: await trialForcesShadowMode(admin, tenantId),
    };
  }

  if (msgfKey.startsWith("msgf_live_") || msgfKey.startsWith("msgf_test_")) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      throw new GatewayAuthError(503, {
        error: {
          message: "Unable to verify license (admin client unavailable).",
          type: "authentication_error",
          code: "msgf_auth_unavailable",
        },
      });
    }

    const licenseKeyHash = sha256HexUtf8(msgfKey);
    const { data, error } = await admin
      .from("msgf_licenses")
      .select("id, tenant_id, status, expires_at, tier_id")
      .eq("license_key_hash", licenseKeyHash)
      .maybeSingle();

    if (error) {
      console.error("[gateway/auth] msgf_licenses lookup failed:", error.message);
      throw new GatewayAuthError(500, {
        error: {
          message: "Unable to verify contract license.",
          type: "authentication_error",
          code: "msgf_license_lookup_failed",
        },
      });
    }

    if (!data || data.status !== "active") {
      throw new GatewayAuthError(401, {
        error: {
          message: "Invalid or inactive contract license.",
          type: "authentication_error",
          code: "msgf_license_invalid",
        },
      });
    }

    const expiresAt =
      typeof data.expires_at === "string" ? data.expires_at.trim() : "";
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      throw new GatewayAuthError(401, {
        error: {
          message: "Contract license expired.",
          type: "authentication_error",
          code: "msgf_license_expired",
        },
      });
    }

    const tenantId = String(data.tenant_id);
    const tierId = typeof data.tier_id === "string" ? data.tier_id : null;
    if (hint && hint !== tenantId) {
      console.warn(
        "[gateway/auth] ignoring spoofed x-msgf-tenant-id for live/test key",
        { hint, tenantId }
      );
    }

    return {
      tenantId,
      msgfKeyPresent: true,
      keyKind: msgfKey.startsWith("msgf_test_") ? "test" : "live",
      tierId,
      forceShadowMode: await trialForcesShadowMode(admin, tenantId, tierId),
    };
  }

  throw new GatewayAuthError(401, {
    error: {
      message:
        "Unsupported x-msgf-key prefix. Use msgf_live_*, msgf_test_*, or msgf_ide_*.",
      type: "authentication_error",
      code: "msgf_key_unsupported",
    },
  });
}
