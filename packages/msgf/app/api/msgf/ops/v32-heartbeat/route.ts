/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
/**
 * POST /api/msgf/ops/v32-heartbeat
 *
 * V3.2-ULTRA scheduled maintenance (PERSIST + tier batching):
 * - YELLOW 6h / GREEN 24h tier reports
 * - 30-day Hall LOW-tier purge
 *
 * Auth: Bearer `MSGF_OPS_CRON_SECRET`, `MSGF_ADMIN_API_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`.
 * Schedule via GitHub Actions (msgf-tier-heartbeat.yml) or Google Cloud Scheduler.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError, assertMsgfServiceAdmin } from "@/lib/msgf-admin-auth";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  HALL_PURGE_DEFAULT_RETENTION_DAYS,
  runHallPurgeProtocol,
} from "@/lib/services/hall-purge-protocol";
import { runV32TierMaintenance } from "@/lib/services/v32-tier-maintenance";
import { createAdminClient } from "@/utils/supabase/admin";

const bodySchema = z
  .object({
    dry_run: z.boolean().optional(),
    hall_purge_days: z.number().int().positive().max(365).optional(),
    skip_tier_batches: z.boolean().optional(),
    skip_hall_purge: z.boolean().optional(),
  })
  .strict();

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const startedAt = new Date().toISOString();

  try {
    assertMsgfServiceAdmin(req);

    let body: z.infer<typeof bodySchema> = {};
    try {
      const raw = await req.json();
      const parsed = bodySchema.safeParse(raw);
      if (parsed.success) body = parsed.data;
    } catch {
      /* empty body OK */
    }

    const dryRun = body.dry_run === true;
    const admin = createAdminClient();

    let tier = { yellow: { beatCount: 0, authorCount: 0 }, green: { beatCount: 0, avgHal: 0, tokenEfficiency: 0 } };
    if (!body.skip_tier_batches && !dryRun) {
      tier = await runV32TierMaintenance(admin);
    }

    let hallPurge = null;
    if (!body.skip_hall_purge) {
      hallPurge = await runHallPurgeProtocol({
        supabase: admin,
        days: body.hall_purge_days ?? HALL_PURGE_DEFAULT_RETENTION_DAYS,
        dryRun,
        execute: !dryRun,
      });
    }

    return adminJson(req, {
      ok: true,
      protocol: "v3.2_ops_heartbeat",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      dry_run: dryRun,
      tier_batches: body.skip_tier_batches ? "skipped" : tier,
      hall_purge: body.skip_hall_purge ? "skipped" : hallPurge,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "v32-heartbeat failed";
    console.error("[v32-heartbeat]", e);
    return adminJson(req, { ok: false, error: message }, { status: 500 });
  }
}
