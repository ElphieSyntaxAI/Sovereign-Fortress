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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
import { NextResponse } from "next/server";

import { msgfPostLoginPath } from "@/lib/auth-post-login";
import { ensureGatedAiBuyerAccount } from "@/lib/msgf-onboarding";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromRequest } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? msgfPostLoginPath();

  if (code) {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore, requestHostFromRequest(request));
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          const admin = createAdminClient();
          await ensureGatedAiBuyerAccount({
            supabase: admin,
            entityId: user.id,
            username: user.email?.split("@")[0]?.trim() || "buyer",
          });
        } catch (e) {
          console.warn("[auth/callback] buyer account setup:", e);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback`);
}
