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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
import { NextResponse } from "next/server";

import { evaluateV32RuntimeStatus } from "@/lib/v32-ultra-directive";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * GET /health
 * Liveness + cold layer (pgvector) + V3.2-ULTRA runtime checklist for load balancers.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("pillar_vectors").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: "unhealthy",
          reason: "vector_db_query_failed",
          v32: await evaluateV32RuntimeStatus(),
        },
        { status: 503 }
      );
    }

    const v32 = await evaluateV32RuntimeStatus();
    const shardStep = v32.steps.find((s) => s.step === "SHARD");
    const requireRedis =
      process.env.MSGF_REQUIRE_REDIS?.trim().toLowerCase() === "1" ||
      process.env.MSGF_REQUIRE_REDIS?.trim().toLowerCase() === "true";

    if (requireRedis && shardStep?.status !== "ok") {
      return NextResponse.json(
        {
          status: "unhealthy",
          reason: "redis_required_unavailable",
          v32,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "healthy",
      v32,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "health_check_error";
    return NextResponse.json(
      {
        status: "unhealthy",
        reason: message,
      },
      { status: 503 }
    );
  }
}
