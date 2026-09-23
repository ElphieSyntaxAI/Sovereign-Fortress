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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isPostMvpFeatureEnabled, postMvpDisabledPayload } from "@/lib/post-mvp-gates";
import {
  ContractAutomationService,
  ForensicAccessDeniedError,
} from "@msgf/lib/ContractAutomationBridge";
import { createServiceRoleClient } from "@msgf/lib/supabase/service-role";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/editor/forensic-bundle?manuscript_id=&helper_id=
 *
 * Returns HAL points + lore breaches for {@link EditorForensicView} **only** when a fully executed
 * Sovereign NDA exists for the pair. Otherwise **403**.
 */
export async function GET(req: Request) {
  if (!isPostMvpFeatureEnabled("author_helper")) {
    return NextResponse.json(postMvpDisabledPayload("author_helper"), { status: 404 });
  }
  const url = new URL(req.url);
  const manuscript_id = (url.searchParams.get("manuscript_id") ?? "").trim();
  const helper_id = (url.searchParams.get("helper_id") ?? "").trim();
  if (!manuscript_id || !helper_id) {
    return NextResponse.json({ error: "manuscript_id and helper_id are required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const authClient = createClient(cookieStore);
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = String(user.user_metadata?.tenant_id ?? "").trim();
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id missing from session" }, { status: 403 });
  }

  try {
    const sr = createServiceRoleClient();
    const { data: ms, error: mErr } = await sr
      .from("p4_manuscripts")
      .select("id, tenant_id")
      .eq("id", manuscript_id)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!ms || String((ms as Record<string, unknown>)["tenant_id"] ?? "") !== tenantId) {
      return NextResponse.json({ error: "Manuscript not found for this tenant" }, { status: 404 });
    }

    const svc = new ContractAutomationService(sr);
    const bundle = await svc.buildEditorForensicBundle(manuscript_id, helper_id);
    return NextResponse.json(bundle);
  } catch (e) {
    if (e instanceof ForensicAccessDeniedError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
