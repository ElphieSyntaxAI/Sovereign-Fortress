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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
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

  const envKey = process.env.MSGF_CONTRACT_LICENSE_KEY?.trim();
  if (envKey?.startsWith("msgf_live_")) return envKey;

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
export async function assertPulseLicense(params: {
  adminSupabase: SupabaseClient;
  request: NextRequest;
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

  const plainKey = extractLicenseKeyFromRequest(params.request);
  if (!plainKey) {
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
