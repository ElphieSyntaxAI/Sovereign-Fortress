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
 * Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
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
 */
export function msgfAuthCookieDomain(): string | undefined {
  const fromEnv =
    process.env.MSGF_AUTH_COOKIE_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_AUTH_COOKIE_DOMAIN?.trim();

  if (!fromEnv || fromEnv.toLowerCase() === "host") {
    return undefined;
  }

  return fromEnv;
}

export function withMsgfAuthCookieOptions<T extends Record<string, unknown> | undefined>(
  options?: T
): T & { path: string; sameSite: "lax" | "strict" | "none"; secure: boolean } {
  const domain = msgfAuthCookieDomain();
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
