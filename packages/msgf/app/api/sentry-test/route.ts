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
 * Distribution Build ID: MSGF-614fb81c-20260923T210711Z-internal
 */
/**
 * Temporary Sentry verification endpoint — queues a test error then returns 200.
 * Capture runs after the response so Cloud Run smokes do not wait on Sentry ingest.
 *
 * GET /api/sentry-test
 */
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

  // Detach from the request: Next must not await Sentry transport/flush.
  setTimeout(() => {
    void import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.captureException(
          new Error("Sentry test error — intentional capture for staging smoke")
        );
      })
      .catch(() => {
        /* ignore import/capture failures after response */
      });
  }, 0);

  return NextResponse.json({
    ok: true,
    captured: true,
    message: "Test error queued for Sentry",
  });
}
