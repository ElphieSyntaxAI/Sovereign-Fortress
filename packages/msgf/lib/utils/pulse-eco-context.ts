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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/** Extract `project_origin` from a Pulse request body when present. */
export function extractProjectOriginFromPulseBody(rawBody: unknown): string | undefined {
  if (!rawBody || typeof rawBody !== "object") return undefined;
  const body = rawBody as Record<string, unknown>;

  if (typeof body.project_origin === "string" && body.project_origin.trim()) {
    return body.project_origin.trim().slice(0, 256);
  }

  const metadata = body.metadata;
  if (metadata && typeof metadata === "object") {
    const meta = metadata as Record<string, unknown>;
    if (typeof meta.project_origin === "string" && meta.project_origin.trim()) {
      return meta.project_origin.trim().slice(0, 256);
    }
  }

  return undefined;
}
