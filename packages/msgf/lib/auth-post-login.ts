/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
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
