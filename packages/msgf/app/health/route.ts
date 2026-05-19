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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
import { NextResponse } from "next/server";

import { createAdminClient } from "@/utils/supabase/admin";

/**
 * GET /health
 * Liveness + vector store (Supabase `pillar_vectors` / pgvector) connectivity for load balancers.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("pillar_vectors").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { status: "unhealthy", reason: "vector_db_query_failed" },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "healthy" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "health_check_error";
    return NextResponse.json({ status: "unhealthy", reason: message }, { status: 503 });
  }
}
