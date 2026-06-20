import { OAuth2Client } from "google-auth-library";

import { AUTHOR_APP_URL_PRODUCTION, resolveAuthorClientOrigin } from "@elphie-syntax/core/author-handoff-origins";

import { loadMonorepoRootEnv } from "./database/loadRootEnv.js";

loadMonorepoRootEnv();

export const GOOGLE_OAUTH_REDIRECT_PATH = "/api/google/oauth/callback";

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "openid",
  "email",
  "profile",
];

function redirectUriForOrigin(origin: string): string {
  return `${origin.replace(/\/$/, "")}${GOOGLE_OAUTH_REDIRECT_PATH}`;
}

function isLocalhostRedirect(uri: string): boolean {
  return /127\.0\.0\.1|localhost/i.test(uri);
}

function isCloudRunRedirect(uri: string): boolean {
  try {
    return /\.run\.app$/i.test(new URL(uri).hostname);
  } catch {
    return false;
  }
}

export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() &&
      resolveGoogleOAuthRedirectUri()
  );
}

/**
 * OAuth callback must hit the public Author app origin (nginx proxies `/api` → BFF).
 * Production must not use localhost or a raw Cloud Run URL left in `.env.cloudrun`.
 */
export function resolveGoogleOAuthRedirectUri(): string {
  const fromEnv = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  const publicOrigin =
    process.env.NODE_ENV === "production"
      ? resolveAuthorClientOrigin() || AUTHOR_APP_URL_PRODUCTION
      : resolveAuthorClientOrigin();
  const prodRedirect = redirectUriForOrigin(publicOrigin);

  if (process.env.NODE_ENV === "production") {
    if (!fromEnv || isLocalhostRedirect(fromEnv) || isCloudRunRedirect(fromEnv)) {
      return prodRedirect;
    }
    try {
      const envHost = new URL(fromEnv).hostname.toLowerCase();
      const appHost = new URL(prodRedirect).hostname.toLowerCase();
      if (envHost !== appHost) return prodRedirect;
    } catch {
      return prodRedirect;
    }
  }

  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:3002/api/google/oauth/callback";
  }
  return prodRedirect;
}

export function createGoogleOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = resolveGoogleOAuthRedirectUri();
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
