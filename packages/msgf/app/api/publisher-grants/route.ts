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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
import { NextResponse } from "next/server";

import { PublisherGrantService, type GrantLevel } from "@msgf/lib/PublisherGrantService";
import { createServiceRoleClient } from "@msgf/lib/supabase/service-role";

function parseLevel(v: unknown): GrantLevel | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 4) return null;
  return n as GrantLevel;
}

/**
 * POST /api/publisher-grants
 * Body: { manuscript_id: string, level: 1–4, expires_in_days?: number }
 *
 * Secured with `Authorization: Bearer <PUBLISHER_GRANT_API_SECRET>` (trusted server / author tooling).
 */
export async function POST(req: Request) {
  const secret = process.env.PUBLISHER_GRANT_API_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "PUBLISHER_GRANT_API_SECRET is not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const manuscript_id = typeof o["manuscript_id"] === "string" ? o["manuscript_id"].trim() : "";
  const level = parseLevel(o["level"]);
  const expires_in_days =
    typeof o["expires_in_days"] === "number" && Number.isFinite(o["expires_in_days"])
      ? Math.floor(o["expires_in_days"])
      : undefined;

  if (!manuscript_id) {
    return NextResponse.json({ error: "manuscript_id is required" }, { status: 400 });
  }
  if (!level) {
    return NextResponse.json({ error: "level must be an integer 1–4" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const svc = new PublisherGrantService(supabase);
    const { url, grantId, expiresAt } = await svc.generateShareableLink(manuscript_id, level, {
      expiresInDays: expires_in_days,
    });
    return NextResponse.json({ url, grant_id: grantId, expires_at: expiresAt, level });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
