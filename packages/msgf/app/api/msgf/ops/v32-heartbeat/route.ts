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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * POST /api/msgf/ops/v32-heartbeat
 *
 * V3.2-ULTRA scheduled maintenance (isolated background routines):
 * 1. ARBITRATE ops — YELLOW (6h) + GREEN (24h) tier batch reports
 * 2. Heal queue — user-scheduled `preset_interval` rows → prefix-shared batch heal per tenant
 * 3. PERSIST — 30-day Hall LOW-tier purge (Postgres cold layer + Upstash Redis hot layer)
 *
 * Auth (required, strict): `MSGF_OPS_CRON_SECRET` only — via:
 * - `Authorization: Bearer <secret>`
 * - `X-MSGF-Ops-Cron-Secret: <secret>`
 *
 * Scheduled heal pulls DB rows with `preset_interval` of `6h` or `nightly` and applies
 * RemediationEngine LOM consensus (lowest-risk global strategy) + Vault persist — no human gate.
 *
 * Optional dry-run: `{ "dry_run": true }` (reports only; no Vault writes).
 * Schedule: GitHub Actions (`msgf-tier-heartbeat.yml`) or Google Cloud Scheduler.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError, assertMsgfOpsCron } from "@/lib/msgf-admin-auth";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { runV32OpsHeartbeat } from "@/lib/services/v32-ops-heartbeat";
import { createAdminClient } from "@/utils/supabase/admin";

const bodySchema = z
  .object({
    dry_run: z.boolean().optional(),
    hall_purge_days: z.number().int().positive().max(365).optional(),
    skip_tier_batches: z.boolean().optional(),
    skip_scheduled_heal: z.boolean().optional(),
    skip_hall_purge: z.boolean().optional(),
    cron_period_hours: z.number().int().positive().max(168).optional(),
  })
  .strict();

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    const auth = assertMsgfOpsCron(req);

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

    const heartbeat = await runV32OpsHeartbeat({
      admin,
      dryRun,
      hallPurgeDays: body.hall_purge_days,
      skipTierBatches: body.skip_tier_batches,
      skipScheduledHeal: body.skip_scheduled_heal,
      skipHallPurge: body.skip_hall_purge,
      cronPeriodHours: body.cron_period_hours,
    });

    const status = heartbeat.ok ? 200 : 207;

    return adminJson(req, {
      ...heartbeat,
      auth_method: auth.method,
    }, { status });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "v32-heartbeat failed";
    console.error("[v32-heartbeat]", e);
    return adminJson(req, { ok: false, error: message }, { status: 500 });
  }
}
