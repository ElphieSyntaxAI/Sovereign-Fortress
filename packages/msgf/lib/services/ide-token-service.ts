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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Long-lived IDE bearer tokens (msgf_ide_*).
 */

import { createHash, randomBytes } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";
import { ideTokenTenantAlignsWithHeader } from "@/lib/ide-tenant-alignment";

const IDE_TOKEN_PREFIX = "msgf_ide_";

export function mintIdeTokenPlain(): string {
  return `${IDE_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashIdeToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function ideTokenTtlDays(): number {
  const raw = process.env.MSGF_IDE_TOKEN_TTL_DAYS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 90;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 90;
}

export type MintIdeTokenResult = {
  token: string;
  token_id: string;
  expires_at: string;
  tenant_id: string;
};

export async function mintIdeToken(
  admin: SupabaseClient,
  params: {
    userId: string;
    tenantId: string;
    label?: string;
    workspaceFingerprint?: string | null;
  }
): Promise<MintIdeTokenResult | { error: string }> {
  const token = mintIdeTokenPlain();
  const token_hash = hashIdeToken(token);
  const ttlDays = ideTokenTtlDays();
  const expires_at = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const tenantId = sanitizeTenantScope(params.tenantId);

  const { data, error } = await admin
    .from("msgf_ide_tokens")
    .insert({
      user_id: params.userId,
      tenant_id: tenantId,
      token_hash,
      label: params.label ?? "IDE workspace",
      workspace_fingerprint: params.workspaceFingerprint ?? null,
      expires_at,
    })
    .select("id")
    .single();

  if (error) {
    return {
      error:
        error.message.includes("msgf_ide_tokens")
          ? "Apply migration 20260628130000_msgf_ide_tokens_workspaces.sql"
          : error.message,
    };
  }

  return {
    token,
    token_id: data.id,
    expires_at,
    tenant_id: tenantId,
  };
}

export type VerifiedIdeToken = {
  user_id: string;
  tenant_id: string;
  token_id: string;
};

export type IdeTokenSummary = {
  token_id: string;
  tenant_id: string;
  label: string | null;
  expires_at: string;
  created_at: string;
};

/** Active (non-revoked, unexpired) IDE tokens for workspace UI — plaintext not stored. */
export async function listActiveIdeTokens(
  admin: SupabaseClient,
  userId: string,
  tenantId?: string | null
): Promise<IdeTokenSummary[]> {
  let query = admin
    .from("msgf_ide_tokens")
    .select("id, tenant_id, label, expires_at, created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (tenantId?.trim()) {
    query = query.eq("tenant_id", tenantId.trim());
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[ide-token-service] listActiveIdeTokens:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    token_id: String(row.id),
    tenant_id: String(row.tenant_id),
    label: typeof row.label === "string" ? row.label : null,
    expires_at: String(row.expires_at),
    created_at: String(row.created_at),
  }));
}

export async function verifyIdeToken(
  admin: SupabaseClient,
  bearer: string,
  expectedTenantId?: string | null
): Promise<VerifiedIdeToken | null> {
  const trimmed = bearer.trim();
  if (!trimmed.startsWith(IDE_TOKEN_PREFIX)) return null;

  const token_hash = hashIdeToken(trimmed);
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("msgf_ide_tokens")
    .select("id, user_id, tenant_id")
    .eq("token_hash", token_hash)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (error || !data) return null;

  const expected = sanitizeTenantScope(expectedTenantId ?? "");
  const stored = sanitizeTenantScope(data.tenant_id);
  if (expected && !ideTokenTenantAlignsWithHeader(stored, expected)) {
    return null;
  }

  return {
    user_id: data.user_id,
    tenant_id: data.tenant_id,
    token_id: data.id,
  };
}

/** When header tenant ≠ token row, distinguish mismatch from invalid token (for IDE error text). */
export async function verifyIdeTokenDiagnostic(
  admin: SupabaseClient,
  bearer: string,
  expectedTenantId?: string | null
): Promise<
  | { status: "ok"; token: VerifiedIdeToken }
  | { status: "invalid" }
  | { status: "tenant_mismatch"; token_tenant_id: string; header_tenant_id: string }
> {
  const trimmed = bearer.trim();
  if (!trimmed.startsWith(IDE_TOKEN_PREFIX)) return { status: "invalid" };

  const token_hash = hashIdeToken(trimmed);
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("msgf_ide_tokens")
    .select("id, user_id, tenant_id")
    .eq("token_hash", token_hash)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (error || !data) return { status: "invalid" };

  const headerTenant = sanitizeTenantScope(expectedTenantId ?? "");
  const storedTenant = sanitizeTenantScope(data.tenant_id);
  if (headerTenant && !ideTokenTenantAlignsWithHeader(storedTenant, headerTenant)) {
    return {
      status: "tenant_mismatch",
      token_tenant_id: storedTenant,
      header_tenant_id: headerTenant,
    };
  }

  return {
    status: "ok",
    token: {
      user_id: data.user_id,
      tenant_id: data.tenant_id,
      token_id: data.id,
    },
  };
}
