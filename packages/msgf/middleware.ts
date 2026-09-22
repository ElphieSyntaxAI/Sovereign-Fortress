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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import { type NextRequest, NextResponse } from "next/server";

import { applyMsgfApiTenantMiddleware } from "@/app/api/middleware";
import { assertMsgfCreditsOr429, applyMsgfCreditModelHeader } from "@/lib/creditGuard";
import { assertPulseEntitlementOr429 } from "@/lib/middleware/entitlementGuard";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Session refresh + M3 entitlement guard on `POST /api/msgf/pulse`, then MSGF credit guard on
 * `/api/msgf/*` (usage_monitor, billing soft cap, beta Gemini).
 *
 * Supabase cookie `Set-Cookie` attributes (domain / secure / sameSite) come from `updateSession` →
 * `withMsgfAuthCookieOptions` in `@/lib/msgf-auth-cookies` — same `MSGF_AUTH_COOKIE_DOMAIN` and
 * `MSGF_AUTH_COOKIE_SECURE` as the author BFF (`bffSupabaseCookieOptions` re-exports that module).
 * `next.config.ts` loads the monorepo root `.env.local` so this matches the BFF env.
 */
function withStagingRobots(response: NextResponse) {
  if (process.env.DEPLOY_ENV?.trim() === "staging") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export async function middleware(request: NextRequest) {
  let req = request;

  const tenantGate = await applyMsgfApiTenantMiddleware(req);
  if (tenantGate.response) return withStagingRobots(tenantGate.response);
  req = tenantGate.request;

  if (req.nextUrl.pathname.startsWith("/api/msgf")) {
    const isAuthorHandoff = req.nextUrl.pathname === "/api/msgf/admin/author-handoff";
    const isFeatureGates = req.nextUrl.pathname === "/api/msgf/feature-gates";

    if (!isAuthorHandoff && !isFeatureGates) {
      const entitlementDenied = await assertPulseEntitlementOr429(req);
      if (entitlementDenied) return withStagingRobots(entitlementDenied);

      const denied = await assertMsgfCreditsOr429(req);
      if (denied) return withStagingRobots(denied);
      req = applyMsgfCreditModelHeader(req);
    }
  }

  return withStagingRobots(await updateSession(req));
}

export const config = {
  matcher: [
    // Exclude Sentry tunnel (`tunnelRoute: /monitoring`), Next internals, and static assets.
    "/((?!monitoring|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
