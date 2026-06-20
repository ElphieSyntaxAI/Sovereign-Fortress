import { resolveGoogleOAuthRedirectUri } from "./googleOAuth.js";

export function isGoogleInvalidGrantError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /invalid_grant/i.test(msg);
}

export function googleOAuthReconnectMessage(): string {
  return (
    "Google authorization expired or was revoked. On Manuscripts, connect Google again " +
    "(you may need to remove the app at https://myaccount.google.com/permissions first)."
  );
}

export function googleOAuthCallbackInvalidGrantMessage(): string {
  const redirect = resolveGoogleOAuthRedirectUri();
  return (
    "Google OAuth invalid_grant — the redirect URI used in token exchange must match Google Console. " +
    `Set GOOGLE_OAUTH_REDIRECT_URI to ${redirect} on the BFF and add that exact URI under ` +
    "Google Cloud Console → Credentials → Authorized redirect URIs."
  );
}
