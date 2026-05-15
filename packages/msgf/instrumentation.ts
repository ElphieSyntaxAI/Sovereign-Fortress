/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
/**
 * Next.js server bootstrap — installs SIGTERM/SIGINT graceful shutdown on Node runtime only.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { installShutdownHandlers } = await import("@/lib/runtime/shutdown-coordinator");
  installShutdownHandlers();
}
