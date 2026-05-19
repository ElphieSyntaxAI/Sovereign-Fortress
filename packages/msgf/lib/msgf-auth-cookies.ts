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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
/**
 * Shared cookie domain for Supabase auth across elphiesyntax.com subdomains (and the author BFF).
 *
 * Env (server + client via NEXT_PUBLIC_*):
 *   MSGF_AUTH_COOKIE_DOMAIN=host     — host-only cookies (required for *.run.app / localhost)
 *   MSGF_AUTH_COOKIE_DOMAIN=.elphiesyntax.com — shared apex (custom domain only)
 *   MSGF_AUTH_COOKIE_SECURE=1        — force Secure flag (HTTPS)
 *
 * Do not default to `.elphiesyntax.com` in production: standalone Cloud Run hosts cannot set
 * cookies for that domain and sign-in will hang or loop with no session.
 *
 * When `requestHost` is provided (browser hostname, `NextRequest.nextUrl.hostname`, or the
 * `Host` / `X-Forwarded-Host` header), a dotted env domain is applied **only** if it matches
 * that host. Otherwise cookies are host-only — fixing `*.run.app` deploys that still have
 * `.elphiesyntax.com` in build-time `NEXT_PUBLIC_*` env.
 */
function rawMsgfAuthCookieDomainFromEnv(): string | undefined {
  const fromEnv =
    process.env.MSGF_AUTH_COOKIE_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_AUTH_COOKIE_DOMAIN?.trim();
  if (!fromEnv || fromEnv.toLowerCase() === "host") {
    return undefined;
  }
  return fromEnv;
}

function normalizeRequestHost(host: string | null | undefined): string | undefined {
  if (!host?.trim()) return undefined;
  const h = host.trim().toLowerCase().split(":")[0];
  return h || undefined;
}

/**
 * Returns the `Domain=` cookie attribute only when it is valid for `requestHost`.
 * Omit `requestHost` only in contexts where host cannot be known (rare); dotted apex domains
 * are then skipped so Cloud Run never receives a mismatched `Domain=.elphiesyntax.com`.
 */
export function msgfAuthCookieDomainForHost(requestHost: string | null | undefined): string | undefined {
  const fromEnv = rawMsgfAuthCookieDomainFromEnv();
  if (!fromEnv) return undefined;

  const host = normalizeRequestHost(requestHost ?? undefined);
  if (!host) {
    if (fromEnv.startsWith(".")) {
      return undefined;
    }
    return fromEnv;
  }

  const cd = fromEnv.toLowerCase();
  if (cd.startsWith(".")) {
    const root = cd.slice(1);
    if (host === root || host.endsWith(`.${root}`)) {
      return fromEnv;
    }
    return undefined;
  }

  return host === cd ? fromEnv : undefined;
}

/** @deprecated Prefer {@link msgfAuthCookieDomainForHost} with the active request hostname. */
export function msgfAuthCookieDomain(): string | undefined {
  return msgfAuthCookieDomainForHost(undefined);
}

export function withMsgfAuthCookieOptions<T extends Record<string, unknown> | undefined>(
  options?: T,
  requestHost?: string | null
): T & { path: string; sameSite: "lax" | "strict" | "none"; secure: boolean } {
  const domain = msgfAuthCookieDomainForHost(requestHost ?? undefined);
  const base = (options ?? {}) as Record<string, unknown>;
  return {
    ...base,
    ...(domain ? { domain } : {}),
    path: (base.path as string | undefined) ?? "/",
    sameSite: (base.sameSite as "lax" | "strict" | "none" | undefined) ?? "lax",
    secure:
      (base.secure as boolean | undefined) ??
      (process.env.NODE_ENV === "production" ||
        process.env.MSGF_AUTH_COOKIE_SECURE === "1" ||
        process.env.NEXT_PUBLIC_MSGF_AUTH_COOKIE_SECURE === "1"),
  } as T & { path: string; sameSite: "lax" | "strict" | "none"; secure: boolean };
}
