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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import { NextRequest, NextResponse } from "next/server";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import {
  listSentryIssues,
  resolveSentryIssue,
  sentryAdminStatusPayload,
} from "@/lib/services/sentry-admin";
import { createAdminClient } from "@/utils/supabase/admin";

async function requireSentryOperator(req: NextRequest) {
  const admin = createAdminClient();
  const op = await resolveOperatorForAdminRequest(req, admin);
  if (op.role === "DEVELOPER") {
    throw new MsgfAdminAuthError("Operators only.", 403);
  }
  return op;
}

export async function GET(req: NextRequest) {
  try {
    await requireSentryOperator(req);
    const status = sentryAdminStatusPayload();
    const wantIssues = req.nextUrl.searchParams.get("issues") === "1";

    if (!wantIssues) {
      return NextResponse.json({ ok: true, ...status });
    }

    if (!status.configured) {
      return NextResponse.json(
        {
          ok: false,
          ...status,
          error:
            "Sentry is unconfigured. Set SENTRY_AUTH_TOKEN and SENTRY_ORG_SLUG (docs/integrations/technical-specs/MSGF_SENTRY.md).",
          code: "SENTRY_UNCONFIGURED",
        },
        { status: 400 }
      );
    }

    const projectOrigin = req.nextUrl.searchParams.get("project_origin")?.trim() || "";
    const rawQuery = req.nextUrl.searchParams.get("query")?.trim() || "";
    const query = [rawQuery, projectOrigin].filter(Boolean).join(" ") || undefined;
    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 25;
    const issues = await listSentryIssues({
      query,
      limit: Number.isFinite(limit) ? limit : 25,
      statsPeriod: req.nextUrl.searchParams.get("statsPeriod") ?? undefined,
      projectSlug: req.nextUrl.searchParams.get("project") ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      ...status,
      issues,
      count: issues.length,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Sentry request failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** PUT — resolve a Sentry issue by id. */
export async function PUT(req: NextRequest) {
  try {
    await requireSentryOperator(req);
    const body = (await req.json().catch(() => null)) as { issue_id?: string } | null;
    const issueId = body?.issue_id?.trim();
    if (!issueId) {
      return NextResponse.json({ ok: false, error: "issue_id is required." }, { status: 400 });
    }

    const result = await resolveSentryIssue(issueId);
    return NextResponse.json({ ok: true, issue: result });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to resolve Sentry issue.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
