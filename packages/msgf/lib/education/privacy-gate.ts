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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * P3 Cryptographic Privacy Gate — strip PII before any analytics / profile persistence.
 */
import { createHash, createHmac, randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { privacyGateSecret } from "@/lib/education/lti/lti-config";
import type { EducationLtiPersona } from "@/lib/education/lti/lti-roles";

const GREEK = [
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  "Zeta",
  "Eta",
  "Theta",
  "Iota",
  "Kappa",
  "Lambda",
  "Mu",
] as const;

export type RawLtiIdentity = {
  /** Canvas `sub` — never stored in plaintext. */
  canvasSub: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
};

export type PrivacyGateResult = {
  entityId: string;
  anonymousDisplayToken: string;
  canvasSubHash: string;
  privacyVaultId?: string;
  created: boolean;
};

export function hashCanvasSub(canvasSub: string, tenantId: string): string {
  return createHash("sha256")
    .update(`${tenantId}:${canvasSub}`, "utf8")
    .digest("hex");
}

/**
 * Deterministic anonymous display token (e.g. Student_Gamma_742).
 * No reversible link to legal name without the privacy gate secret.
 */
export function mintAnonymousDisplayToken(input: {
  canvasSubHash: string;
  tenantId: string;
  deploymentId: string;
}): string {
  const hmac = createHmac("sha256", privacyGateSecret())
    .update(`${input.tenantId}:${input.deploymentId}:${input.canvasSubHash}`)
    .digest("hex");

  const idx = parseInt(hmac.slice(0, 8), 16);
  const greek = GREEK[idx % GREEK.length];
  const suffix = (idx % 900) + 100;
  return `Student_${greek}_${suffix}`;
}

export function mintInternalEntityId(canvasSubHash: string, tenantId: string): string {
  const hmac = createHmac("sha256", privacyGateSecret())
    .update(`entity:${tenantId}:${canvasSubHash}`)
    .digest();

  const bytes = hmac.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Strip PII fields — only pass through non-identifying launch metadata. */
export function stripPiiFromLaunchClaims(
  claims: Record<string, unknown>
): Record<string, unknown> {
  const blocked = new Set([
    "email",
    "name",
    "given_name",
    "family_name",
    "middle_name",
    "nickname",
    "picture",
    "phone_number",
    "address",
  ]);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(claims)) {
    if (blocked.has(key)) continue;
    if (key.includes("email") || key.includes("name")) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Intercept student identity at LTI launch — persist only de-identified vault row.
 */
export async function applyCryptographicPrivacyGate(params: {
  admin: SupabaseClient;
  tenantId: string;
  deploymentId: string;
  issuer: string;
  identity: RawLtiIdentity;
  persona: EducationLtiPersona;
}): Promise<PrivacyGateResult> {
  const canvasSubHash = hashCanvasSub(params.identity.canvasSub, params.tenantId);
  const entityId = mintInternalEntityId(canvasSubHash, params.tenantId);
  const anonymousDisplayToken = mintAnonymousDisplayToken({
    canvasSubHash,
    tenantId: params.tenantId,
    deploymentId: params.deploymentId,
  });

  const { data: existing, error: readErr } = await params.admin
    .from("education_privacy_vault")
    .select("id, entity_id, anonymous_display_token")
    .eq("tenant_id", params.tenantId)
    .eq("canvas_sub_hash", canvasSubHash)
    .eq("deployment_id", params.deploymentId)
    .maybeSingle();

  if (readErr) {
    throw new Error(`privacy vault read: ${readErr.message}`);
  }

  if (existing?.id) {
    return {
      entityId: String(existing.entity_id),
      anonymousDisplayToken: String(existing.anonymous_display_token),
      canvasSubHash,
      privacyVaultId: String(existing.id),
      created: false,
    };
  }

  const { data: inserted, error: insertErr } = await params.admin
    .from("education_privacy_vault")
    .insert({
      tenant_id: params.tenantId,
      entity_id: entityId,
      anonymous_display_token: anonymousDisplayToken,
      canvas_sub_hash: canvasSubHash,
      lti_role: params.persona,
      deployment_id: params.deploymentId,
      issuer: params.issuer,
    })
    .select("id")
    .single();

  if (insertErr) {
    throw new Error(`privacy vault insert: ${insertErr.message}`);
  }

  return {
    entityId,
    anonymousDisplayToken,
    canvasSubHash,
    privacyVaultId: String(inserted.id),
    created: true,
  };
}

export function signHumanEffortCertificateDigest(payload: {
  certificateId: string;
  entityId: string;
  halScore: number;
  issuedAt: string;
}): string {
  return createHmac("sha256", privacyGateSecret())
    .update(
      `${payload.certificateId}:${payload.entityId}:${payload.halScore}:${payload.issuedAt}`
    )
    .digest("hex");
}

export function newCertificateId(): string {
  return randomUUID();
}
