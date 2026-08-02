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
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MSGF_PROJECT_ORIGIN_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { extractProjectOriginFromPulseBody } from "@/lib/utils/pulse-eco-context";
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";
import { listUserProjects } from "@/lib/services/user-projects";

export { MSGF_PROJECT_ORIGIN_HEADER } from "@/lib/msgf-http-headers";

/** Normalize org/repo slugs — strips stray quotes from pasted settings or overrides. */
export function normalizeProjectOrigin(value: string | null | undefined): string {
  return sanitizeTenantScope(value ?? "");
}

export type ProjectTrackingRailCode =
  | "ERR_PROJECT_ORIGIN_REQUIRED"
  | "ERR_PROJECT_ORIGIN_NOT_MAPPED";

export class ProjectTrackingRailError extends Error {
  readonly status: number;
  readonly code: ProjectTrackingRailCode;

  constructor(message: string, code: ProjectTrackingRailCode, status = 403) {
    super(message);
    this.name = "ProjectTrackingRailError";
    this.code = code;
    this.status = status;
  }
}

export function trackingRailsDisabled(): boolean {
  const v = process.env.MSGF_TRACKING_RAILS_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** IDE `msgf.tenantKey` is the mapped `project_origin` when it looks like `org/repo`. */
export function tenantKeyLooksLikeProjectOrigin(key: string | null | undefined): boolean {
  const k = key?.trim();
  if (!k || k.length > 256) return false;
  if (k.includes(" ")) return false;
  return k.includes("/");
}

export function extractProjectOriginFromTrackingRequest(
  req: NextRequest,
  rawBody?: unknown,
  options?: { idePulse?: boolean }
): string | undefined {
  const explicitHeader = req.headers.get(MSGF_PROJECT_ORIGIN_HEADER)?.trim();
  if (explicitHeader) return normalizeProjectOrigin(explicitHeader).slice(0, 256);

  const fromBody = extractProjectOriginFromPulseBody(rawBody);
  if (fromBody) return fromBody;

  if (options?.idePulse) {
    const tenantKey =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
    if (tenantKeyLooksLikeProjectOrigin(tenantKey)) {
      return normalizeProjectOrigin(tenantKey).slice(0, 256);
    }
  }

  return undefined;
}

export async function loadMappedProjectOrigins(
  admin: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const projects = await listUserProjects(admin, userId).catch(() => []);
  return new Set(
    projects.map((p) => normalizeProjectOrigin(p.project_origin)).filter(Boolean)
  );
}

export type ProjectTrackingScope = {
  projectOrigin: string | null;
  allowlist: Set<string>;
  enforced: boolean;
};

/**
 * Resolves the active repo branch for this request. When the user has mapped projects,
 * `project_origin` must be present and in the allowlist — otherwise tracking is rejected.
 */
export async function resolveProjectTrackingScope(params: {
  admin: SupabaseClient;
  userId: string | null;
  req: NextRequest;
  rawBody?: unknown;
  idePulse?: boolean;
  /** Ingest may already derive origin from file paths. */
  explicitOrigin?: string | null;
}): Promise<ProjectTrackingScope> {
  const allowlist = params.userId
    ? await loadMappedProjectOrigins(params.admin, params.userId)
    : new Set<string>();

  const extractedRaw =
    params.explicitOrigin?.trim() ||
    extractProjectOriginFromTrackingRequest(params.req, params.rawBody, {
      idePulse: params.idePulse,
    });
  const extracted = extractedRaw ? normalizeProjectOrigin(extractedRaw) : undefined;

  if (trackingRailsDisabled() || !params.userId || allowlist.size === 0) {
    return {
      projectOrigin: extracted ?? null,
      allowlist,
      enforced: false,
    };
  }

  if (!extracted) {
    throw new ProjectTrackingRailError(
      "project_origin is required. Map this repository in Workspace and set msgf.tenantKey (IDE) or send x-msgf-project-origin — MSGF only tracks initiated project branches.",
      "ERR_PROJECT_ORIGIN_REQUIRED"
    );
  }

  if (!allowlist.has(extracted)) {
    throw new ProjectTrackingRailError(
      `project_origin "${extracted}" is not mapped to your account. Add the repo under Workspace → Projects — MSGF does not track unmapped or personal paths.`,
      "ERR_PROJECT_ORIGIN_NOT_MAPPED"
    );
  }

  return {
    projectOrigin: extracted,
    allowlist,
    enforced: true,
  };
}

/** Stamp pulse / ingest bodies so downstream persistence and eco metrics stay scoped. */
export function stampProjectOriginOnPayload(
  rawBody: unknown,
  projectOrigin: string | null
): unknown {
  if (!projectOrigin?.trim() || rawBody == null || typeof rawBody !== "object") {
    return rawBody;
  }
  const origin = projectOrigin.trim().slice(0, 256);
  const body = { ...(rawBody as Record<string, unknown>) };
  body.project_origin = origin;
  const meta =
    body.metadata && typeof body.metadata === "object"
      ? { ...(body.metadata as Record<string, unknown>) }
      : {};
  meta.project_origin = origin;
  body.metadata = meta;
  return body;
}

/**
 * Personal dashboard health: never aggregate every mapped repo server-side.
 * Use the sole mapping when there is exactly one; otherwise client picks via `project_origin`.
 */
export function personalDashboardProjectOrigins(mapped: string[]): string[] {
  const origins = mapped.map((o) => o.trim()).filter(Boolean);
  if (origins.length === 1) return origins;
  return [];
}
