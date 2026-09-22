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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
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
      release: {
        service: process.env.K_SERVICE ?? "msgf-api",
        revision: process.env.K_REVISION ?? null,
        deploy_env: process.env.DEPLOY_ENV?.trim() || "production",
        git_sha: process.env.GIT_SHA?.trim() || process.env.IMAGE_TAG?.trim() || null,
        deployed_at: process.env.DEPLOYED_AT?.trim() || null,
      },
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
