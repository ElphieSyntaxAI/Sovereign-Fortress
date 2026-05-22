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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
/**
 * GET /api/workspace/monorepo-presets — suggested workspace rows (one per monorepo app).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { MONOREPO_WORKSPACE_PRESETS } from "@/lib/services/monorepo-workspace-presets";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";
import { headers } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    presets: MONOREPO_WORKSPACE_PRESETS,
    note: "Register each app as its own project so dashboard health and ingest scope per workspace, not the whole monorepo root only.",
  });
}
