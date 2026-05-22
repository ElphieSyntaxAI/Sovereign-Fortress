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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError, assertMsgfServiceAdmin } from "@/lib/msgf-admin-auth";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  HALL_PURGE_DEFAULT_RETENTION_DAYS,
  runHallPurgeProtocol,
} from "@/lib/services/hall-purge-protocol";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

const purgeBodySchema = z
  .object({
    /** Preview candidate counts without deleting (default false). */
    dry_run: z.boolean().optional(),
    /** Retention window in days (default 30 per V3.2-ULTRA). */
    days: z.number().int().positive().max(365).optional(),
  })
  .strict();

/**
 * POST /api/msgf/admin/self-heal/purge
 *
 * V3.2-ULTRA Step 7 (PERSIST) — purge LOW / GREEN tier Hall rows older than 30 days from
 * `pillar_vectors`, `p4_narrative_logs`, `msgf_sandbox`, and resolved low-tier `msgf_incidents`
 * (V3.2 "LOW" priority ≡ `GREEN` drift tier in metadata).
 *
 * **Auth:** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY | MSGF_ADMIN_API_KEY>`
 * (same as other M4 admin routes — suitable for Google Cloud Scheduler OIDC → secret Bearer).
 *
 * **Body (optional):** `{ "dry_run": true, "days": 30 }`
 */
export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const startedAt = new Date().toISOString();

  try {
    assertMsgfServiceAdmin(req);

    let body: unknown = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        body = JSON.parse(text) as unknown;
      }
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = purgeBodySchema.safeParse(body);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const dryRun = parsed.data.dry_run === true;
    const days = parsed.data.days ?? HALL_PURGE_DEFAULT_RETENTION_DAYS;

    const admin = createAdminClient();
    const result = await runHallPurgeProtocol({
      supabase: admin,
      days,
      dryRun,
      execute: !dryRun,
    });

    return adminJson(req, {
      ok: true,
      message: dryRun
        ? "Hall purge dry run complete (no rows deleted)."
        : "Hall purge protocol executed.",
      started_at: startedAt,
      completed_at: result.executed_at,
      deleted_count: dryRun ? 0 : result.total_deleted,
      would_delete_count: result.total_would_delete,
      retention_days: result.retention_days,
      cutoff_before: result.cutoff,
      dry_run: result.dry_run,
      protocol: result.protocol,
      tables: result.tables,
      incidents: result.incidents,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Hall purge failed.";
    console.error("[admin/self-heal/purge] POST", e);
    return adminJson(req, { ok: false, error: msg, started_at: startedAt }, { status: 500 });
  }
}
