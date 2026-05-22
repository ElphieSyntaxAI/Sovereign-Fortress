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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
/**
 * GET/POST /api/education/lti/login
 *
 * LTI 1.3 OIDC third-party login initiation (Canvas → Syntax Education).
 */
import { NextRequest, NextResponse } from "next/server";

import { handleLtiLoginInitiation } from "@/lib/services/education-lti-controller";

function pickLoginParams(req: NextRequest): {
  iss: string;
  loginHint?: string;
  targetLinkUri: string;
  ltiMessageHint?: string;
  clientId: string;
  ltiDeploymentId?: string;
} {
  const url = req.nextUrl;
  const get = (key: string) => url.searchParams.get(key) ?? undefined;

  const iss = get("iss");
  const targetLinkUri = get("target_link_uri");
  const clientId = get("client_id");

  if (!iss || !targetLinkUri || !clientId) {
    throw new Error("Missing required LTI login parameters (iss, target_link_uri, client_id).");
  }

  return {
    iss,
    targetLinkUri,
    clientId,
    loginHint: get("login_hint"),
    ltiMessageHint: get("lti_message_hint"),
    ltiDeploymentId: get("lti_deployment_id") ?? undefined,
  };
}

async function readPostForm(req: NextRequest): Promise<URLSearchParams> {
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

export async function GET(req: NextRequest) {
  try {
    const params = pickLoginParams(req);
    const redirectUrl = await handleLtiLoginInitiation(params);
    return NextResponse.redirect(redirectUrl, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[lti/login GET]", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await readPostForm(req);
    const iss = form.get("iss");
    const targetLinkUri = form.get("target_link_uri");
    const clientId = form.get("client_id");
    if (!iss || !targetLinkUri || !clientId) {
      return NextResponse.json(
        { error: "Missing iss, target_link_uri, or client_id." },
        { status: 400 }
      );
    }

    const redirectUrl = await handleLtiLoginInitiation({
      iss,
      targetLinkUri,
      clientId,
      loginHint: form.get("login_hint") ?? undefined,
      ltiMessageHint: form.get("lti_message_hint") ?? undefined,
      ltiDeploymentId: form.get("lti_deployment_id") ?? undefined,
    });

    return NextResponse.redirect(redirectUrl, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[lti/login POST]", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
