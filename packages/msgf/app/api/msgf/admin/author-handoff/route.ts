import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  sanitizeAuthorReturnToUrl,
  signOperatorHandoffToken,
} from "@elphie-syntax/core/operator-handoff-token";
import {
  assertSessionOperatorIsAdmin,
  MsgfAdminSessionError,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
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

function resolveAuthorBffOrigin(): string {
  return (
    process.env.AUTHOR_BFF_URL?.trim()?.replace(/\/+$/, "") ||
    process.env.AUTHOR_ECOSYSTEM_URL?.trim()?.replace(/\/+$/, "") ||
    "http://127.0.0.1:3002"
  );
}

function defaultAuthorDashboardUrl(): string {
  const client =
    process.env.AUTHOR_CLIENT_DEV_URL?.trim()?.replace(/\/+$/, "") ||
    "http://127.0.0.1:5173";
  return `${client}/dashboard`;
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
      const signIn = new URL("/admin/sign-in", req.nextUrl.origin);
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
      defaultAuthorDashboardUrl()
    );

    const handoff = signOperatorHandoffToken(
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        email: session.user.email ?? "",
      },
      secret
    );

    const bffUrl = new URL("/api/auth/msgf-handoff", `${resolveAuthorBffOrigin()}/`);
    bffUrl.searchParams.set("handoff", handoff);
    bffUrl.searchParams.set("return_to", returnTo);

    return NextResponse.redirect(bffUrl);
  } catch (e) {
    if (e instanceof MsgfAdminSessionError) {
      return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
    }
    const msg = e instanceof Error ? e.message : "Author handoff failed.";
    console.error("[admin/author-handoff]", e);
    const portal = new URL("/admin/portal", req.nextUrl.origin);
    portal.searchParams.set("handoff_error", msg.slice(0, 200));
    return NextResponse.redirect(portal);
  }
}

export const runtime = "nodejs";
