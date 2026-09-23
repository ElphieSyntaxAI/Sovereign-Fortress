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
/**
 * Temporary Sentry verification endpoint — GET throws so the SDK captures a real server error.
 * Delete after confirming the issue appears in Sentry.
 *
 * GET /api/sentry-test
 */
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const dsn =
    process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
  if (!dsn) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sentry DSN not configured. Set SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN.",
      },
      { status: 503 }
    );
  }

  const err = new Error("Sentry test error — delete /api/sentry-test after verification");
  Sentry.captureException(err);
  await Sentry.flush(2000);
  throw err;
}
