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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { encryptKey, decryptKey } from "@/lib/crypto/CryptoService";

export type TenantProviderKeyProvider = "gemini" | "anthropic" | "xai";

export function parseTenantProvider(value: unknown): TenantProviderKeyProvider | null {
  const p = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (p === "gemini" || p === "anthropic" || p === "xai") return p;
  return null;
}

/**
 * Persist a tenant Gemini or Anthropic key: encrypts with {@link encryptKey} before upsert.
 * Never writes plaintext to Postgres.
 */
export async function upsertTenantProviderCredential(params: {
  admin: SupabaseClient;
  tenantId: string;
  provider: TenantProviderKeyProvider;
  plainApiKey: string;
}): Promise<void> {
  const tid = params.tenantId.trim();
  const key = params.plainApiKey.trim();
  if (!tid || !key) {
    throw new Error("upsertTenantProviderCredential: tenantId and plainApiKey are required.");
  }

  const encrypted_payload = await encryptKey(key);

  const { error } = await params.admin.from("msgf_tenant_provider_credentials").upsert(
    {
      tenant_id: tid,
      provider: params.provider,
      encrypted_payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider" }
  );

  if (error) {
    throw new Error(`upsertTenantProviderCredential: ${error.message}`);
  }
}

/** Remove stored credential for a tenant + provider (revoke BYOK). */
export async function deleteTenantProviderCredential(params: {
  admin: SupabaseClient;
  tenantId: string;
  provider: TenantProviderKeyProvider;
}): Promise<void> {
  const tid = params.tenantId.trim();
  if (!tid) throw new Error("deleteTenantProviderCredential: tenantId is required.");

  const { error } = await params.admin
    .from("msgf_tenant_provider_credentials")
    .delete()
    .eq("tenant_id", tid)
    .eq("provider", params.provider);

  if (error) {
    throw new Error(`deleteTenantProviderCredential: ${error.message}`);
  }
}

/** Fetch encrypted blob only (server-side); use {@link decryptTenantProviderCredential} to use the key. */
export async function fetchTenantProviderCredentialEncrypted(params: {
  admin: SupabaseClient;
  tenantId: string;
  provider: TenantProviderKeyProvider;
}): Promise<string | null> {
  const tid = params.tenantId.trim();
  const { data, error } = await params.admin
    .from("msgf_tenant_provider_credentials")
    .select("encrypted_payload")
    .eq("tenant_id", tid)
    .eq("provider", params.provider)
    .maybeSingle();

  if (error) {
    throw new Error(`fetchTenantProviderCredentialEncrypted: ${error.message}`);
  }

  const row = data as { encrypted_payload?: string } | null;
  const hex = row?.encrypted_payload?.trim();
  return hex && hex.length > 0 ? hex : null;
}

/** Decrypt stored credential for outbound SDK calls (never log return value). */
export async function decryptTenantProviderCredential(params: {
  admin: SupabaseClient;
  tenantId: string;
  provider: TenantProviderKeyProvider;
}): Promise<string | null> {
  const hex = await fetchTenantProviderCredentialEncrypted(params);
  if (!hex) return null;
  return decryptKey(hex);
}

export async function listTenantProviderCredentialPresence(params: {
  admin: SupabaseClient;
  tenantId: string;
}): Promise<{ gemini: boolean; anthropic: boolean; xai: boolean }> {
  const tid = params.tenantId.trim();
  const { data, error } = await params.admin
    .from("msgf_tenant_provider_credentials")
    .select("provider")
    .eq("tenant_id", tid);

  if (error) {
    throw new Error(`listTenantProviderCredentialPresence: ${error.message}`);
  }

  const rows = (data ?? []) as { provider: string }[];
  const set = new Set(rows.map((r) => r.provider));
  return {
    gemini: set.has("gemini"),
    anthropic: set.has("anthropic"),
    xai: set.has("xai"),
  };
}
