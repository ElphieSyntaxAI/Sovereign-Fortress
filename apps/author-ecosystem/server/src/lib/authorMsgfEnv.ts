/**
 * Shared Author ↔ MSGF env resolution (no circular imports).
 */

export const AUTHOR_MSGF_PROJECT_ORIGIN = "elphiesyntax/author-ecosystem" as const;

/** Local MSGF dev origin when env unset (see packages/msgf `MSGF_DEV_DEFAULT_PORT` = 3001). */
export const AUTHOR_MSGF_LOCAL_DEV_ORIGIN = "http://127.0.0.1:3001" as const;

function trim(name: string): string {
  return process.env[name]?.trim() || "";
}

export function resolveAuthorMsgfTenantId(raw?: string | null): string {
  return raw?.trim() || trim("MSGF_AUTHOR_TENANT_ID") || "author_ecosystem";
}

export function resolveAuthorMsgfAppUrl(): string | null {
  const url =
    trim("MSGF_APP_URL") ||
    trim("NEXT_PUBLIC_MSGF_APP_URL") ||
    trim("MSGF_BASE_URL") ||
    trim("MSGF_LOCAL_DEV_URL");
  if (url) return url.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") {
    return AUTHOR_MSGF_LOCAL_DEV_ORIGIN;
  }
  return null;
}

export function resolveAuthorPulseLicenseKey(): string {
  return trim("MSGF_AUTHOR_PULSE_LICENSE_KEY") || trim("MSGF_CONTRACT_LICENSE_KEY");
}

export function authorMsgfBridgeConfigured(): boolean {
  return Boolean(resolveAuthorMsgfAppUrl() && resolveAuthorPulseLicenseKey());
}
