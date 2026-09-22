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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Browser / Client Runtime — Sentry Next.js init (errors + tracing).
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from "@sentry/nextjs";

const dsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim() || "";

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    process.env.NODE_ENV ||
    "development",
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // First-error baseline: errors + tracing only (Session Replay deferred).
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
