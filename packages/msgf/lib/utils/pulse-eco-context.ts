/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
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
