import type { SupabaseClient } from "@supabase/supabase-js";
import type { OAuth2Client } from "google-auth-library";

import { createGoogleOAuthClient } from "./googleOAuth.js";

type CredentialRow = {
  tenant_id: string;
  google_email: string | null;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  scopes: string[] | null;
};

/** Returns an OAuth2 client with a valid access token for this tenant. */
export async function getGoogleOAuthClientForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ client: OAuth2Client; email: string | null }> {
  const { data, error } = await supabase
    .from("p4_author_google_credentials")
    .select("tenant_id, google_email, refresh_token, access_token, access_token_expires_at, scopes")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Google account not connected. Connect Google from Manuscripts first.");

  const row = data as CredentialRow;
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
      .eq("tenant_id", tenantId);
    client.setCredentials(credentials);
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
  const expiresAt =
    tokens.expiry_date != null ? new Date(tokens.expiry_date).toISOString() : null;
  const now = new Date().toISOString();
  const { error } = await supabase.from("p4_author_google_credentials").upsert(
    {
      tenant_id: tenantId,
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
