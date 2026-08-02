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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import { buildMsgfAuthCallbackUrl, resolveMsgfAppOrigin } from "@elphie-syntax/core/platform-admin-auth";

export {
  MSGF_ADMIN_PORTAL_PATH,
  MSGF_ADMIN_SIGN_IN_PATH,
  MSGF_AUTH_CALLBACK_PATH,
  buildMsgfAdminPortalUrl,
  buildMsgfAdminSignInUrl,
  resolveMsgfAppOrigin,
} from "@elphie-syntax/core/platform-admin-auth";

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

/**
 * Supabase `emailRedirectTo` / PKCE callback on MSGF. Pass `next` to land on admin routes after confirm.
 */
export function resolveMsgfAuthCallbackHref(nextPath?: string, origin?: string): string {
  return buildMsgfAuthCallbackUrl({
    next: nextPath,
    origin,
    env: process.env,
  });
}
