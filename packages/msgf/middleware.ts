import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Session refresh only. Enforce tenant boundaries in Route Handlers / Server Actions with
 * `validateTenantAccess` or `validateSupabaseUserTenantAccess` from `@msgf/lib/gatekeeper`
 * and `gatekeeperContextFromRequest(request)` for path + IP (avoid `window` on the server).
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
