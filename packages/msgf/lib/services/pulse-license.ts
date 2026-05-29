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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
/**
 * Contract license gate for MSGF Brain (msgf_licenses table).
 * Used by POST /api/msgf/pulse after auth, before PulseEngine.runFullPipeline().
 */

import crypto from "crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MSGF_AUTO_PROMOTED_HEADER,
  MSGF_IDE_PULSE_HEADER,
  MSGF_OPERATOR_USER_ID_HEADER,
  MSGF_PERSONAL_SANDBOX_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { allocatePersonalSandboxTenantId } from "@/lib/msgf-tenant-governance";
import { verifyIdeToken } from "@/lib/services/ide-token-service";
import { PulseHttpError } from "@/lib/services/pulse-http-error";

export type PulseLicenseContext = {
  licenseId: string;
  tenantId: string;
  tierId: string;
};

function licenseGuardDisabled(): boolean {
  const v = process.env.MSGF_PULSE_LICENSE_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function extractBearerTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    return token || null;
  }
  return null;
}

export function extractLicenseKeyFromRequest(request: NextRequest): string | null {
  const direct = request.headers.get("x-msgf-license-key")?.trim();
  if (direct?.startsWith("msgf_live_")) return direct;

  const bearer = extractBearerTokenFromRequest(request);
  if (bearer?.startsWith("msgf_live_")) return bearer;

  // Server env contract key is for IDE/integrator probes only — not browser SaaS buyers.
  if (isIdePulseRequest(request)) {
    const envKey = process.env.MSGF_CONTRACT_LICENSE_KEY?.trim();
    if (envKey?.startsWith("msgf_live_")) return envKey;
  }

  return null;
}

function isIdePulseRequest(request: NextRequest): boolean {
  return request.headers.get(MSGF_IDE_PULSE_HEADER)?.trim() === "1";
}

function resolveIdeTenantKey(request: NextRequest): string | null {
  return (
    request.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    request.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
    null
  );
}

/**
 * IDE pulse after middleware auto-promotion (trusted personal sandbox headers).
 */
function assertPromotedPersonalSandboxLicense(request: NextRequest): PulseLicenseContext | null {
  if (!isIdePulseRequest(request)) return null;
  if (request.headers.get(MSGF_PERSONAL_SANDBOX_HEADER)?.trim() !== "1") return null;
  if (request.headers.get(MSGF_AUTO_PROMOTED_HEADER)?.trim() !== "1") return null;

  const tenantKey = resolveIdeTenantKey(request);
  if (!tenantKey) return null;

  const operatorUserId = request.headers.get(MSGF_OPERATOR_USER_ID_HEADER)?.trim();
  const scopedTenant = operatorUserId
    ? allocatePersonalSandboxTenantId(operatorUserId)
    : tenantKey;

  const bearer = extractBearerTokenFromRequest(request);
  const licenseSeed = bearer?.startsWith("msgf_live_")
    ? bearer
    : bearer ?? tenantKey;

  return {
    licenseId: `ide-sandbox-${sha256HexUtf8(licenseSeed).slice(0, 16)}`,
    tenantId: scopedTenant,
    tierId: process.env.MSGF_PULSE_LICENSE_TIER?.trim() || "brain_contract",
  };
}

function sha256HexUtf8(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Validates an active contract license row (service_role). Throws {@link PulseHttpError} on failure.
 */
async function resolveSessionPulseLicense(
  adminSupabase: SupabaseClient,
  entityId: string
): Promise<PulseLicenseContext> {
  const eid = entityId.trim();
  const { data, error } = await adminSupabase
    .from("p4_profiles")
    .select("tenant_id, tier_id")
    .eq("user_id", eid)
    .maybeSingle();

  if (error) {
    console.error("[pulse-license] p4_profiles read failed:", error.message);
    throw new PulseHttpError(500, { error: "Unable to verify account entitlement." });
  }

  if (!data) {
    throw new PulseHttpError(403, {
      error: "Complete account setup (sign in to the dashboard once) before Pulse.",
      code: "ERR_PROFILE_MISSING",
    });
  }

  const tenantId =
    (typeof data.tenant_id === "string" && data.tenant_id.trim()) ||
    process.env.MSGF_GATED_TENANT_ID?.trim() ||
    "tenant_gated";

  return {
    licenseId: `session-${eid.slice(0, 8)}`,
    tenantId,
    tierId:
      typeof data.tier_id === "number"
        ? String(data.tier_id)
        : process.env.MSGF_PULSE_LICENSE_TIER?.trim() || "brain_contract",
  };
}

/**
 * IDE Pulse: msgf_ide_* long-lived tokens and Supabase session JWTs (not msgf_live_ contracts).
 */
async function resolveIdeBearerPulseLicense(
  adminSupabase: SupabaseClient,
  request: NextRequest
): Promise<PulseLicenseContext | null> {
  if (!isIdePulseRequest(request)) return null;

  const bearer = extractBearerTokenFromRequest(request);
  if (!bearer) return null;

  const tenantKey = resolveIdeTenantKey(request);

  if (bearer.startsWith("msgf_ide_")) {
    const verified = await verifyIdeToken(adminSupabase, bearer, tenantKey ?? undefined);
    if (!verified) {
      throw new PulseHttpError(403, {
        error: "Invalid or expired IDE token, or tenant mismatch.",
        code: "ERR_IDE_TOKEN_INVALID",
      });
    }
    return {
      licenseId: `ide-token-${verified.token_id}`,
      tenantId: verified.tenant_id,
      tierId: process.env.MSGF_PULSE_LICENSE_TIER?.trim() || "brain_contract",
    };
  }

  if (!bearer.startsWith("msgf_live_")) {
    const { data, error } = await adminSupabase.auth.getUser(bearer);
    if (!error && data.user?.id) {
      return resolveSessionPulseLicense(adminSupabase, data.user.id);
    }
  }

  return null;
}

export async function assertPulseLicense(params: {
  adminSupabase: SupabaseClient;
  request: NextRequest;
  /** Signed-in SaaS user (cookie session) — uses `p4_profiles`, not `msgf_licenses`. */
  sessionEntityId?: string | null;
}): Promise<PulseLicenseContext> {
  if (licenseGuardDisabled()) {
    return {
      licenseId: "dev-bypass",
      tenantId: process.env.MSGF_PULSE_LICENSE_TENANT?.trim() || "author_ecosystem",
      tierId: process.env.MSGF_PULSE_LICENSE_TIER?.trim() || "brain_contract",
    };
  }

  const sandboxLicense = assertPromotedPersonalSandboxLicense(params.request);
  if (sandboxLicense) {
    return sandboxLicense;
  }

  const ideLicense = await resolveIdeBearerPulseLicense(
    params.adminSupabase,
    params.request
  );
  if (ideLicense) {
    return ideLicense;
  }

  const plainKey = extractLicenseKeyFromRequest(params.request);
  if (!plainKey) {
    if (params.sessionEntityId?.trim()) {
      return resolveSessionPulseLicense(params.adminSupabase, params.sessionEntityId);
    }
    throw new PulseHttpError(403, {
      error: "Insufficient privileges for this tenant scope.",
      code: "ERR_LICENSE_MISSING",
    });
  }

  const licenseKeyHash = sha256HexUtf8(plainKey);
  const { data, error } = await params.adminSupabase
    .from("msgf_licenses")
    .select("id, tenant_id, tier_id, credits_total, credits_used, status")
    .eq("license_key_hash", licenseKeyHash)
    .maybeSingle();

  if (error) {
    console.error("[pulse-license] msgf_licenses lookup failed:", error.message);
    throw new PulseHttpError(500, { error: "Unable to verify contract license." });
  }

  if (!data || data.status !== "active") {
    throw new PulseHttpError(403, {
      error: "Invalid or inactive contract license.",
      code: "ERR_LICENSE_INVALID",
    });
  }

  const creditsTotal = Number(data.credits_total ?? 0);
  const creditsUsed = Number(data.credits_used ?? 0);
  if (creditsUsed >= creditsTotal) {
    throw new PulseHttpError(429, {
      error: "Contract license credits exhausted.",
      code: "ERR_CREDIT_GUARD_EXHAUSTED",
    });
  }

  return {
    licenseId: data.id as string,
    tenantId: String(data.tenant_id),
    tierId: String(data.tier_id),
  };
}
