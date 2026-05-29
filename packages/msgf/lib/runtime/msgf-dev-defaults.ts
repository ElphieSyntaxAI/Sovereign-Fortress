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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * Local MSGF dev defaults — port 3001 frees :3000 for other apps (e.g. LIFF / LINE mini-app).
 * Override with PORT, MSGF_LOCAL_DEV_URL, or MSGF_APP_URL in .env.local.
 */

/** Default `next dev` / `resolveListenPort()` when PORT is unset. */
export const MSGF_DEV_DEFAULT_PORT = 3001;

export const MSGF_LOCAL_DEV_ORIGIN_DEFAULT = `http://127.0.0.1:${MSGF_DEV_DEFAULT_PORT}` as const;

/** Origin for local scripts and admin portal when env URLs are unset. */
export function resolveMsgfLocalDevOrigin(): string {
  const fromEnv =
    process.env.MSGF_LOCAL_DEV_URL?.trim() ||
    process.env.MSGF_APP_URL?.trim() ||
    process.env.MSGF_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const portRaw = process.env.PORT?.trim();
  if (portRaw) {
    const n = Number.parseInt(portRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 65_535) {
      return `http://127.0.0.1:${n}`;
    }
  }
  return MSGF_LOCAL_DEV_ORIGIN_DEFAULT;
}
