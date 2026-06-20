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
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import {
  assertOperatorMayActAsEntity,
  MsgfOperatorGateError,
} from "@/lib/msgf-operator-access";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { GenealogicalBugIndexSchema } from "@/lib/schemas/vault-hall-metadata";
import { createAdminClient } from "@/utils/supabase/admin";

const bodySchema = z.object({
  user_id: z.string().uuid(),
  incident_id: z.string().uuid(),
  narrative_log_id: z.string().uuid().nullable().optional(),
  resolution_note: z.string().min(1).max(8000),
  bug_index: GenealogicalBugIndexSchema,
});

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * POST /api/msgf/admin/incidents/notify-reject
 * Forwards permanent Pulse rejection to Author App webhook (optional).
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(
        req,
        { ok: false, error: "Developers cannot notify permanent Pulse rejections." },
        { status: 403 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await assertOperatorMayActAsEntity(admin, op, parsed.data.user_id);

    const webhookUrl = process.env.MSGF_AUTHOR_PULSE_REJECT_WEBHOOK_URL?.trim();
    if (!webhookUrl) {
      return adminJson(req, {
        ok: true,
        notified: false,
        skipped: "MSGF_AUTHOR_PULSE_REJECT_WEBHOOK_URL not configured.",
      });
    }

    const secret = process.env.MSGF_AUTHOR_PULSE_REJECT_WEBHOOK_SECRET?.trim();
    const payload = {
      event: "pulse_permanently_rejected" as const,
      user_id: parsed.data.user_id,
      incident_id: parsed.data.incident_id,
      narrative_log_id: parsed.data.narrative_log_id ?? null,
      resolution_note: parsed.data.resolution_note,
      bug_index: parsed.data.bug_index,
      rejected_at: new Date().toISOString(),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (secret) {
      headers["x-msgf-webhook-secret"] = secret;
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return adminJson(
        req,
        {
          ok: false,
          error: `Author webhook returned ${res.status}.`,
          detail: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    return adminJson(req, { ok: true, notified: true });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    if (e instanceof MsgfOperatorGateError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to notify Author app.";
    console.error("[admin/incidents/notify-reject] POST", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
