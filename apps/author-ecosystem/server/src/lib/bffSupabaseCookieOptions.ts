/**
 * Re-export MSGF auth cookie shaping so the BFF matches Next.js (`middleware` → `updateSession`) and
 * `utils/supabase/server.ts` — all driven by root `.env.local`: `MSGF_AUTH_COOKIE_DOMAIN`,
 * `MSGF_AUTH_COOKIE_SECURE`.
 */
export {
  msgfAuthCookieDomain as bffSupabaseAuthCookieDomain,
  withMsgfAuthCookieOptions as withBffSupabaseCookieOptions,
} from "msgf/lib/msgf-auth-cookies";
