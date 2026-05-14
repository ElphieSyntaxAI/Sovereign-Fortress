import { type NextRequest } from "next/server";

import { assertMsgfCreditsOr429, applyMsgfCreditModelHeader } from "@/lib/creditGuard";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Session refresh + MSGF credit guard on `/api/msgf/*` (usage_monitor, billing soft cap, beta Gemini).
 *
 * Supabase cookie `Set-Cookie` attributes (domain / secure / sameSite) come from `updateSession` →
 * `withMsgfAuthCookieOptions` in `@/lib/msgf-auth-cookies` — same `MSGF_AUTH_COOKIE_DOMAIN` and
 * `MSGF_AUTH_COOKIE_SECURE` as the author BFF (`bffSupabaseCookieOptions` re-exports that module).
 * `next.config.ts` loads the monorepo root `.env.local` so this matches the BFF env.
 */
export async function middleware(request: NextRequest) {
  let req = request;
  if (req.nextUrl.pathname.startsWith("/api/msgf")) {
    const denied = await assertMsgfCreditsOr429(request);
    if (denied) return denied;
    req = applyMsgfCreditModelHeader(request);
  }

  return await updateSession(req);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
