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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/** Keep in sync with `lib/runtime/msgf-dev-defaults.ts` (port 3001 — :3000 reserved for other local apps). */
export const MSGF_DEV_DEFAULT_PORT = 3001;
export const MSGF_LOCAL_DEV_ORIGIN_DEFAULT = `http://127.0.0.1:${MSGF_DEV_DEFAULT_PORT}`;

export function resolveMsgfLocalOrigin() {
  const fromEnv =
    process.env.MSGF_LOCAL_DEV_URL?.trim() ||
    process.env.MSGF_APP_URL?.trim() ||
    process.env.MSGF_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const portRaw = process.env.PORT?.trim();
  if (portRaw) {
    const n = Number.parseInt(portRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 65535) {
      return `http://127.0.0.1:${n}`;
    }
  }
  return MSGF_LOCAL_DEV_ORIGIN_DEFAULT;
}
