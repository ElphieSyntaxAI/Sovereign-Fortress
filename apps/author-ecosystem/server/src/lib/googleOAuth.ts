import { OAuth2Client } from "google-auth-library";

import { loadMonorepoRootEnv } from "./database/loadRootEnv.js";

loadMonorepoRootEnv();

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "openid",
  "email",
  "profile",
];

export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim()
  );
}

export function createGoogleOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI."
    );
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export type OAuthStatePayload = {
  tenantId: string;
  returnTo?: string;
  manuscriptId?: string;
};

export function encodeOAuthState(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeOAuthState(raw: string): OAuthStatePayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as OAuthStatePayload;
    if (!parsed?.tenantId) return null;
    return parsed;
  } catch {
    return null;
  }
}
