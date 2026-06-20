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
/**
 * POST /api/education/lti/launch
 *
 * LTI 1.3 launch — verify id_token, privacy gate, session cookie, redirect to sandbox.
 */
import { NextRequest, NextResponse } from "next/server";

import { withMsgfAuthCookieOptions } from "@/lib/msgf-auth-cookies";
import { ELPHIE_LTI_SESSION_COOKIE } from "@/lib/education/lti/lti-session";
import { handleLtiLaunch } from "@/lib/services/education-lti-controller";

async function readLaunchForm(req: NextRequest): Promise<URLSearchParams> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    return new URLSearchParams(text);
  }
  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    const params = new URLSearchParams();
    fd.forEach((v, k) => params.set(k, String(v)));
    return params;
  }
  return req.nextUrl.searchParams;
}

export async function POST(req: NextRequest) {
  try {
    const form = await readLaunchForm(req);
    const idToken = form.get("id_token");
    const state = form.get("state");

    if (!idToken || !state) {
      return NextResponse.json(
        { error: "Missing id_token or state." },
        { status: 400 }
      );
    }

    const result = await handleLtiLaunch({ idToken, state });

    const res = NextResponse.redirect(result.redirectUrl, 302);
    const cookieHost =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.nextUrl.hostname;
    res.cookies.set(
      ELPHIE_LTI_SESSION_COOKIE,
      result.sessionToken,
      withMsgfAuthCookieOptions(
        {
          httpOnly: true,
          maxAge: 28800,
        },
        cookieHost
      )
    );

    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[lti/launch]", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Canvas may probe with GET — return method hint. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "LTI 1.3 launch endpoint — expect POST with id_token and state.",
  });
}
