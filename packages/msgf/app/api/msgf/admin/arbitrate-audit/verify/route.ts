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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import {
  arbitrateAuditSecret,
  listArbitrateAudits,
  verifyArbitrateAuditRow,
  verifyArbitrateAuditSignature,
  type ArbitrateAuditPayload,
} from "@/lib/services/arbitrate-audit";
import { createAdminClient } from "@/utils/supabase/admin";

const bodySchema = z
  .object({
    id: z.string().uuid().optional(),
    payload_json: z.unknown().optional(),
    signature: z.string().min(1).max(128).optional(),
    prev_hash: z.string().min(1).max(128).optional(),
    row_hash: z.string().min(1).max(128).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    await resolveOperatorForAdminRequest(req, admin);

    const secret = arbitrateAuditSecret();
    if (!secret) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "MSGF_ARBITRATE_AUDIT_KEY (or MSGF_OPS_CRON_SECRET) not configured — cannot verify.",
        },
        { status: 503 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
    }

    if (parsed.data.id) {
      const rows = await listArbitrateAudits(admin, { id: parsed.data.id });
      const row = rows[0];
      if (!row) {
        return NextResponse.json({ ok: false, error: "Audit row not found." }, { status: 404 });
      }
      const result = verifyArbitrateAuditRow(row, secret);
      return NextResponse.json({
        ok: result.ok,
        id: row.id,
        signature_ok: result.signature_ok,
        row_hash_ok: result.row_hash_ok,
        error: result.error,
        project_origin: row.project_origin,
        action: row.action,
        created_at: row.created_at,
      });
    }

    if (
      parsed.data.payload_json == null ||
      !parsed.data.signature ||
      !parsed.data.prev_hash ||
      !parsed.data.row_hash
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Provide id, or payload_json + signature + prev_hash + row_hash.",
        },
        { status: 400 }
      );
    }

    const result = verifyArbitrateAuditRow(
      {
        payload_json: parsed.data.payload_json,
        signature: parsed.data.signature,
        prev_hash: parsed.data.prev_hash,
        row_hash: parsed.data.row_hash,
      },
      secret
    );

    const signatureOnly = verifyArbitrateAuditSignature(
      parsed.data.payload_json as ArbitrateAuditPayload,
      parsed.data.signature,
      secret
    );

    return NextResponse.json({
      ok: result.ok,
      signature_ok: result.signature_ok && signatureOnly,
      row_hash_ok: result.row_hash_ok,
      error: result.error,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Verify failed." },
      { status: 500 }
    );
  }
}
