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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
/** Relative path after successful password sign-in (must exist under `app/`). */
export function msgfPostLoginPath(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_MSGF_POST_LOGIN_PATH?.trim() ||
    process.env.MSGF_POST_LOGIN_PATH?.trim();
  if (!fromEnv) return "/dashboard";
  return fromEnv.startsWith("/") ? fromEnv : `/${fromEnv}`;
}

/** Build redirect URL from the active browser origin (Cloud Run, localhost, custom domain). */
export function resolveAuthRedirectUrl(path: string, origin?: string): string {
  const base = origin?.trim() || (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  return new URL(path.startsWith("/") ? path : `/${path}`, base).href;
}

/** Production MSGF origin for cross-app auth redirects (email confirm, Author shim). */
export function resolveMsgfAppOrigin(): string {
  const fromEnv =
    process.env.MSGF_APP_URL?.trim()?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim()?.replace(/\/$/, "") ||
    process.env.MSGF_PUBLIC_APP_URL?.trim()?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://elphiesgatedai.elphiesyntax.com";
}

function isSafeRelativeNext(next: string | undefined): next is string {
  const n = next?.trim();
  return Boolean(n && n.startsWith("/") && !n.startsWith("//"));
}

/**
 * Supabase `emailRedirectTo` / PKCE callback on MSGF. Pass `next` to land on admin routes after confirm.
 */
export function resolveMsgfAuthCallbackHref(nextPath?: string, origin?: string): string {
  const next = isSafeRelativeNext(nextPath) ? nextPath.trim() : undefined;
  const path = next
    ? `/auth/callback?next=${encodeURIComponent(next)}`
    : "/auth/callback";
  const base = origin?.trim() || resolveMsgfAppOrigin();
  return new URL(path, base.endsWith("/") ? base : `${base}/`).href;
}
