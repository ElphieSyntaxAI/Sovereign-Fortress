/**
 * Shared cookie domain for Supabase auth across elphiesyntax.com subdomains.
 * Set MSGF_AUTH_COOKIE_DOMAIN in .env to override (`host` = omit domain for localhost-only cookies).
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
