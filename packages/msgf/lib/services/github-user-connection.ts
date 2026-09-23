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

import { decryptKey, encryptKey } from "@/lib/crypto/CryptoService";

export const GITHUB_OAUTH_SCOPES = "read:user repo";

export type GithubConnectionStatus = {
  connected: boolean;
  github_login: string | null;
  scopes: string | null;
};

export type GithubRepoListItem = {
  full_name: string;
  html_url: string;
  private: boolean;
  updated_at: string | null;
};

/**
 * Persist GitHub provider_token (encrypted). Never writes plaintext to Postgres.
 */
export async function upsertGithubUserConnection(params: {
  admin: SupabaseClient;
  userId: string;
  accessToken: string;
  githubLogin?: string | null;
  scopes?: string;
}): Promise<void> {
  const userId = params.userId.trim();
  const token = params.accessToken.trim();
  if (!userId || !token) {
    throw new Error("upsertGithubUserConnection: userId and accessToken are required.");
  }

  const encrypted_access_token = await encryptKey(token);
  const { error } = await params.admin.from("msgf_user_github_connections").upsert(
    {
      user_id: userId,
      encrypted_access_token,
      github_login: params.githubLogin?.trim() || null,
      scopes: (params.scopes ?? GITHUB_OAUTH_SCOPES).trim() || GITHUB_OAUTH_SCOPES,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`upsertGithubUserConnection: ${error.message}`);
  }
}

export async function deleteGithubUserConnection(params: {
  admin: SupabaseClient;
  userId: string;
}): Promise<void> {
  const userId = params.userId.trim();
  if (!userId) throw new Error("deleteGithubUserConnection: userId is required.");

  const { error } = await params.admin
    .from("msgf_user_github_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`deleteGithubUserConnection: ${error.message}`);
  }
}

export async function getGithubConnectionStatus(params: {
  admin: SupabaseClient;
  userId: string;
}): Promise<GithubConnectionStatus> {
  const userId = params.userId.trim();
  const { data, error } = await params.admin
    .from("msgf_user_github_connections")
    .select("github_login, scopes")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`getGithubConnectionStatus: ${error.message}`);
  }

  if (!data) {
    return { connected: false, github_login: null, scopes: null };
  }

  const row = data as { github_login?: string | null; scopes?: string | null };
  return {
    connected: true,
    github_login: row.github_login?.trim() || null,
    scopes: row.scopes?.trim() || null,
  };
}

export async function decryptGithubAccessToken(params: {
  admin: SupabaseClient;
  userId: string;
}): Promise<string | null> {
  const userId = params.userId.trim();
  const { data, error } = await params.admin
    .from("msgf_user_github_connections")
    .select("encrypted_access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`decryptGithubAccessToken: ${error.message}`);
  }

  const hex = (data as { encrypted_access_token?: string } | null)?.encrypted_access_token?.trim();
  if (!hex) return null;
  return decryptKey(hex);
}

/** Fetch GitHub login for the authenticated token (updates stored login when possible). */
export async function fetchGithubLogin(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "MSGF-GatedAI",
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { login?: string };
  return typeof json.login === "string" ? json.login.trim() : null;
}

/**
 * List repos visible to the stored token (owner + collaborator + org member).
 * Caps at 5 pages × 100 = 500 repos.
 */
export async function listGithubReposForToken(accessToken: string): Promise<GithubRepoListItem[]> {
  const out: GithubRepoListItem[] = [];
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL("https://api.github.com/user/repos");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("affiliation", "owner,collaborator,organization_member");
    url.searchParams.set("sort", "updated");

    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "MSGF-GatedAI",
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "GitHub token rejected. Disconnect and Connect GitHub again (check Supabase GitHub OAuth scopes)."
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub repos list failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const batch = (await res.json()) as Array<{
      full_name?: string;
      html_url?: string;
      private?: boolean;
      updated_at?: string | null;
    }>;

    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const row of batch) {
      const fullName = row.full_name?.trim();
      const htmlUrl = row.html_url?.trim();
      if (!fullName || !htmlUrl) continue;
      out.push({
        full_name: fullName,
        html_url: htmlUrl,
        private: Boolean(row.private),
        updated_at: row.updated_at ?? null,
      });
    }

    if (batch.length < 100) break;
  }

  return out;
}
