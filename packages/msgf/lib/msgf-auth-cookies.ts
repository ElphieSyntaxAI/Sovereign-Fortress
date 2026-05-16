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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
 */
/**
 * Shared cookie domain for Supabase auth across elphiesyntax.com subdomains (and the author BFF).
 * Loaded from the monorepo root `.env` / `.env.local` (see `packages/msgf/next.config.ts` and BFF
 * `loadMonorepoRootEnv`): `MSGF_AUTH_COOKIE_DOMAIN`, `MSGF_AUTH_COOKIE_SECURE`.
 *
 * For local dev (`localhost:3000` Next + `localhost:3002` BFF), leave unset or set to `host` so
 * cookies are host-only for `localhost` and the browser sends them on every localhost port.
 */
export function msgfAuthCookieDomain(): string | undefined {
  const fromEnv = process.env.MSGF_AUTH_COOKIE_DOMAIN?.trim();
  if (fromEnv === "" || fromEnv?.toLowerCase() === "host") {
    return undefined;
  }
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    return ".elphiesyntax.com";
  }
  return undefined;
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
        process.env.MSGF_AUTH_COOKIE_SECURE === "1"),
  } as T & { path: string; sameSite: "lax" | "strict" | "none"; secure: boolean };
}
