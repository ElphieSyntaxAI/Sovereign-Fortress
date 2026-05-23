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
