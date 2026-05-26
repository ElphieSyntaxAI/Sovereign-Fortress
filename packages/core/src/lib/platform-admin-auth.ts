/**
 * Cross-app operator admin auth — MSGF hosts Supabase sign-in; satellite apps redirect here.
 */

export const MSGF_ADMIN_PORTAL_PATH = "/admin/portal";
export const MSGF_ADMIN_SIGN_IN_PATH = "/admin/sign-in";
export const MSGF_AUTH_CALLBACK_PATH = "/auth/callback";

export const ElphieAuthCallbackNextKey = "elphie_auth_callback_next";

export type PlatformSurface = "msgf" | "author" | "education";

export type EnvLike = Record<string, string | undefined>;

function trimOrigin(raw: string | undefined): string | undefined {
  const s = raw?.trim()?.replace(/\/+$/, "");
  return s || undefined;
}

/** Production / local MSGF origin for admin sign-in and email-confirm callbacks. */
export function resolveMsgfAppOrigin(options?: {
  env?: EnvLike;
  hostname?: string;
}): string {
  const env = options?.env ?? {};
  const fromEnv =
    trimOrigin(env.VITE_MSGF_APP_URL) ||
    trimOrigin(env.MSGF_APP_URL) ||
    trimOrigin(env.MSGF_LOCAL_DEV_URL) ||
    trimOrigin(env.NEXT_PUBLIC_MSGF_APP_URL) ||
    trimOrigin(env.MSGF_PUBLIC_APP_URL);
  if (fromEnv) return fromEnv;

  const host = options?.hostname?.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://127.0.0.1:3001";
  }
  return "https://elphiesgatedai.elphiesyntax.com";
}

export function isSafeRelativePath(path: string | undefined | null): path is string {
  const n = path?.trim();
  return Boolean(n && n.startsWith("/") && !n.startsWith("//"));
}

/** Operator sign-in on MSGF (GLOBAL_ADMIN / MSGF_GLOBAL_ADMIN_EMAILS). */
export function buildMsgfAdminSignInUrl(options?: {
  next?: string;
  origin?: string;
  from?: PlatformSurface;
  env?: EnvLike;
  hostname?: string;
}): string {
  const origin =
    options?.origin ??
    resolveMsgfAppOrigin({
      env: options?.env,
      hostname: options?.hostname,
    });
  const next = isSafeRelativePath(options?.next)
    ? options.next.trim()
    : MSGF_ADMIN_PORTAL_PATH;
  const url = new URL(MSGF_ADMIN_SIGN_IN_PATH, `${origin}/`);
  url.searchParams.set("next", next);
  if (options?.from) {
    url.searchParams.set("from", options.from);
  }
  return url.href;
}

export function buildMsgfAdminPortalUrl(options?: {
  origin?: string;
  env?: EnvLike;
  hostname?: string;
}): string {
  const origin =
    options?.origin ??
    resolveMsgfAppOrigin({
      env: options?.env,
      hostname: options?.hostname,
    });
  return new URL(MSGF_ADMIN_PORTAL_PATH, `${origin}/`).href;
}

/**
 * PKCE / magic-link callback on MSGF. Preserves `code`, `token_hash`, and hash fragments.
 */
export function buildMsgfAuthCallbackUrl(options?: {
  next?: string;
  origin?: string;
  search?: string;
  hash?: string;
  env?: EnvLike;
  hostname?: string;
}): string {
  const origin =
    options?.origin ??
    resolveMsgfAppOrigin({
      env: options?.env,
      hostname: options?.hostname,
    });
  const search = options?.search ?? "";
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const next =
    params.get("next") ??
    (isSafeRelativePath(options?.next) ? options.next.trim() : undefined) ??
    readStashedAuthCallbackNext();
  if (next && !params.has("next")) {
    params.set("next", next);
  }
  const qs = params.toString();
  const hash = options?.hash ?? "";
  return `${origin}${MSGF_AUTH_CALLBACK_PATH}${qs ? `?${qs}` : ""}${hash}`;
}

export function stashAuthCallbackNext(next: string): void {
  if (typeof sessionStorage === "undefined") return;
  if (!isSafeRelativePath(next)) return;
  sessionStorage.setItem(ElphieAuthCallbackNextKey, next.trim());
}

export function readStashedAuthCallbackNext(): string | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  const stored = sessionStorage.getItem(ElphieAuthCallbackNextKey);
  return isSafeRelativePath(stored) ? stored.trim() : undefined;
}

export function clearStashedAuthCallbackNext(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(ElphieAuthCallbackNextKey);
}
