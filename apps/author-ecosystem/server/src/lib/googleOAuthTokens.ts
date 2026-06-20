import type { SupabaseClient } from "@supabase/supabase-js";
import type { OAuth2Client } from "google-auth-library";

import { expandBffTenantIdAliases } from "./authorTenantId.js";
import {
  googleOAuthReconnectMessage,
  isGoogleInvalidGrantError,
} from "./googleOAuthErrors.js";
import { createGoogleOAuthClient } from "./googleOAuth.js";

type CredentialRow = {
  tenant_id: string;
  google_email: string | null;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  scopes: string[] | null;
};

async function findGoogleCredentialRow(
  supabase: SupabaseClient,
  tenantId: string
): Promise<CredentialRow | null> {
  const aliases = await expandBffTenantIdAliases(supabase, tenantId);
  for (const id of aliases) {
    const { data, error } = await supabase
      .from("p4_author_google_credentials")
      .select("tenant_id, google_email, refresh_token, access_token, access_token_expires_at, scopes")
      .eq("tenant_id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as CredentialRow;
  }
  return null;
}

export async function hasGoogleCredentialsForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  return (await findGoogleCredentialRow(supabase, tenantId)) != null;
}

export async function getGoogleCredentialSummary(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ google_email: string | null; tenant_id: string } | null> {
  const row = await findGoogleCredentialRow(supabase, tenantId);
  if (!row) return null;
  return { google_email: row.google_email, tenant_id: row.tenant_id };
}

async function canonicalGoogleCredentialTenantId(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> {
  const { data: byUser } = await supabase
    .from("p4_profiles")
    .select("legacy_user_id")
    .eq("user_id", tenantId)
    .maybeSingle();
  if (byUser?.legacy_user_id) return String(byUser.legacy_user_id);
  return tenantId;
}

/** Returns an OAuth2 client with a valid access token for this tenant. */
export async function getGoogleOAuthClientForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ client: OAuth2Client; email: string | null }> {
  const row = await findGoogleCredentialRow(supabase, tenantId);
  if (!row) {
    throw new Error("Google account not connected. Connect Google from Manuscripts first.");
  }

  const storeId = row.tenant_id;
  const client = createGoogleOAuthClient();
  client.setCredentials({
    refresh_token: row.refresh_token,
    access_token: row.access_token ?? undefined,
    expiry_date: row.access_token_expires_at
      ? new Date(row.access_token_expires_at).getTime()
      : undefined,
  });

  const needsRefresh =
    !row.access_token ||
    !row.access_token_expires_at ||
    new Date(row.access_token_expires_at).getTime() < Date.now() + 60_000;

  if (needsRefresh) {
    try {
      const { credentials } = await client.refreshAccessToken();
      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null;
      await supabase
        .from("p4_author_google_credentials")
        .update({
          access_token: credentials.access_token ?? null,
          access_token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", storeId);
      client.setCredentials(credentials);
    } catch (e) {
      if (isGoogleInvalidGrantError(e)) {
        const aliases = await expandBffTenantIdAliases(supabase, tenantId);
        await supabase.from("p4_author_google_credentials").delete().in("tenant_id", aliases);
        throw new Error(googleOAuthReconnectMessage());
      }
      throw e;
    }
  }

  return { client, email: row.google_email };
}

export async function upsertGoogleCredentials(
  supabase: SupabaseClient,
  tenantId: string,
  tokens: { refresh_token?: string | null; access_token?: string | null; expiry_date?: number | null },
  googleEmail: string | null
): Promise<void> {
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh_token — revoke app access and reconnect with consent.");
  }
  const aliases = await expandBffTenantIdAliases(supabase, tenantId);
  const canonical = await canonicalGoogleCredentialTenantId(supabase, tenantId);
  const expiresAt =
    tokens.expiry_date != null ? new Date(tokens.expiry_date).toISOString() : null;
  const now = new Date().toISOString();

  // Drop stale rows stored under auth uuid vs legacy uuid so status + ingest agree.
  if (aliases.length > 1) {
    await supabase.from("p4_author_google_credentials").delete().in("tenant_id", aliases);
  }

  const { error } = await supabase.from("p4_author_google_credentials").upsert(
    {
      tenant_id: canonical,
      google_email: googleEmail,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      access_token_expires_at: expiresAt,
      scopes: ["drive.readonly", "documents.readonly"],
      updated_at: now,
    },
    { onConflict: "tenant_id" }
  );
  if (error) throw new Error(error.message);
}
