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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import {
  insertSkipAuditRow,
  listRecentSkipAudits,
  signSkipAuditPayload,
  skipAuditSecret,
  verifySkipAuditSignature,
  type SkipAuditPayload,
} from "@/lib/services/skip-audit";
import { createAdminClient } from "@/utils/supabase/admin";

function bearerMatchesSecret(req: NextRequest, secret: string): boolean {
  return req.headers.get("authorization")?.trim() === `Bearer ${secret}`;
}

const postSchema = z
  .object({
    project_origin: z.string().min(1).max(512),
    user: z.string().max(320).nullable().optional(),
    git_sha: z.string().max(128).nullable().optional(),
    reason: z.string().max(1000).nullable().optional(),
    ts: z.string().min(1).max(64),
    signature: z.string().max(128).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const secret = skipAuditSecret();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "MSGF_SKIP_AUDIT_SECRET (or MSGF_OPS_CRON_SECRET) not configured." },
      { status: 503 }
    );
  }

  if (!bearerMatchesSecret(req, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const payload: SkipAuditPayload = {
    project_origin: parsed.data.project_origin,
    user: parsed.data.user ?? null,
    git_sha: parsed.data.git_sha ?? null,
    reason: parsed.data.reason ?? null,
    ts: parsed.data.ts,
  };

  const clientSig = parsed.data.signature?.trim();
  if (clientSig) {
    if (!verifySkipAuditSignature(payload, clientSig, secret)) {
      return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
    }
  }

  const signature = clientSig || signSkipAuditPayload(payload, secret);
  const admin = createAdminClient();
  const { id } = await insertSkipAuditRow(admin, { payload, signature });

  return NextResponse.json({ ok: true, id, signature });
}

export async function GET(req: NextRequest) {
  const secret = skipAuditSecret();
  const admin = createAdminClient();

  if (secret && bearerMatchesSecret(req, secret)) {
    const origin = req.nextUrl.searchParams.get("project_origin");
    const rows = await listRecentSkipAudits(admin, { projectOrigin: origin });
    return NextResponse.json({ ok: true, count: rows.length, rows });
  }

  try {
    await resolveOperatorForAdminRequest(req, admin);
    const origin = req.nextUrl.searchParams.get("project_origin");
    const rows = await listRecentSkipAudits(admin, { projectOrigin: origin });
    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
}
