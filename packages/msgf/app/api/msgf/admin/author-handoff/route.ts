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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { buildAuthorHandoffAutoPostHtml } from "@elphie-syntax/core/author-handoff-auto-post";
import { defaultAuthorDashboardReturnTo, resolveAuthorBffOrigin } from "@elphie-syntax/core/author-handoff-origins";
import {
  sanitizeAuthorReturnToUrl,
  signOperatorHandoffToken,
} from "@elphie-syntax/core/operator-handoff-token";
import {
  assertSessionOperatorIsAdmin,
  MsgfAdminSessionError,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import { resolveMsgfRequestOrigin } from "@/lib/msgf-request-origin";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  createClient as createSupabaseServerClient,
  requestHostFromRequest,
} from "@/utils/supabase/server";

function handoffSecret(): string {
  return (
    process.env.MSGF_OPERATOR_HANDOFF_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

/**
 * GET /api/msgf/admin/author-handoff
 * GLOBAL_ADMIN session on MSGF → short-lived token → Author BFF sets cookies → Author dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(
      cookieStore,
      requestHostFromRequest(req)
    );

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      const signIn = new URL("/admin/sign-in", resolveMsgfRequestOrigin(req));
      signIn.searchParams.set("next", "/admin/portal");
      return NextResponse.redirect(signIn);
    }

    const op = await resolveSessionDashboardOperator(admin, session.user);
    assertSessionOperatorIsAdmin(op);

    const secret = handoffSecret();
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "MSGF_OPERATOR_HANDOFF_SECRET or SUPABASE_SERVICE_ROLE_KEY required." },
        { status: 500 }
      );
    }

    const returnTo = sanitizeAuthorReturnToUrl(
      req.nextUrl.searchParams.get("return_to"),
      defaultAuthorDashboardReturnTo()
    );

    const handoff = signOperatorHandoffToken(
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        email: session.user.email ?? "",
      },
      secret
    );

    const bffOrigin = resolveAuthorBffOrigin();
    const html = buildAuthorHandoffAutoPostHtml({
      bffOrigin,
      handoffToken: handoff,
      returnTo,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof MsgfAdminSessionError) {
      return NextResponse.redirect(new URL("/unauthorized", resolveMsgfRequestOrigin(req)));
    }
    const msg = e instanceof Error ? e.message : "Author handoff failed.";
    console.error("[admin/author-handoff]", e);
    const portal = new URL("/admin/portal", resolveMsgfRequestOrigin(req));
    portal.searchParams.set("handoff_error", msg.slice(0, 200));
    return NextResponse.redirect(portal);
  }
}

export const runtime = "nodejs";
