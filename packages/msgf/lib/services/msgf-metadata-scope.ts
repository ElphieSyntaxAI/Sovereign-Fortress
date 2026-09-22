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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Tenant / entity silo fields on `pillar_vectors.metadata` and related JSONB.
 */

import { isUuidString } from "@/src/lib/tenant-ids";
import { resolveSubpathHash } from "@/lib/services/vector-scope-key";

export type MsgfMetadataScope = {
  /** License / project silo (pillars, ingest, narrative tenant_id). */
  tenantId: string;
  /** Human actor UUID (biometrics, state_beats, incidents user_id). */
  entityId?: string;
  /** Repo or monorepo root tag for dashboard filtering. */
  projectOrigin?: string;
  /** Employer / tenant company silo (dashboard isolation, incident metadata). */
  companyId?: string | null;
  /** File path or dir used to stamp `subpath_hash` (A4 dual-key). */
  filePath?: string | null;
  dirPrefix?: string | null;
  /** Override hash when already computed. */
  subpathHash?: string | null;
};

export function normalizeTenantId(tenantId: string): string {
  const tid = tenantId.trim();
  if (!tid) {
    throw new Error("tenantId is required");
  }
  return tid;
}

/**
 * Derives a stable repo tag from ingested file paths when the client omits `project_origin`.
 */
export function deriveProjectOrigin(
  files: { path: string }[],
  explicit?: string | null
): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed.slice(0, 256);

  const paths = files.map((f) => f.path.replace(/\\/g, "/")).filter(Boolean);
  if (paths.length === 0) return "unknown";

  const segments = paths.map((p) => p.split("/").filter(Boolean));
  const minLen = Math.min(...segments.map((s) => s.length));
  const common: string[] = [];

  for (let i = 0; i < minLen; i++) {
    const seg = segments[0][i];
    if (segments.every((s) => s[i] === seg)) common.push(seg);
    else break;
  }

  if (common.length >= 2) return common.slice(0, 2).join("/");
  if (common.length === 1) return common[0];
  return segments[0][0] ?? "unknown";
}

/** Merges tenant silo + optional entity + repo tag + subpath_hash into metadata JSONB. */
export function withMsgfMetadataScope(
  meta: Record<string, unknown>,
  scope: MsgfMetadataScope
): Record<string, unknown> {
  const tenantId = normalizeTenantId(scope.tenantId);
  const entityCandidate = scope.entityId?.trim() || (isUuidString(tenantId) ? tenantId : "");
  const projectOrigin = scope.projectOrigin?.trim();
  const companyRaw = scope.companyId?.trim();
  const subpathHash = resolveSubpathHash({
    filePath: scope.filePath,
    dirPrefix: scope.dirPrefix,
    explicitHash: scope.subpathHash,
  });
  const filePath = scope.filePath?.trim();

  return {
    ...meta,
    tenant_id: tenantId,
    ...(entityCandidate && isUuidString(entityCandidate)
      ? { entity_id: entityCandidate }
      : {}),
    ...(projectOrigin ? { project_origin: projectOrigin.slice(0, 256) } : {}),
    ...(companyRaw && isUuidString(companyRaw) ? { company_id: companyRaw } : {}),
    ...(subpathHash ? { subpath_hash: subpathHash } : {}),
    ...(filePath ? { file_path: filePath.replace(/\\/g, "/").slice(0, 512) } : {}),
  };
}

/**
 * Pillar baseline queries prefer a UUID tenant_id; fall back to JWT / license slug resolution.
 */
export function resolveTenantIdForPillars(
  tenantId: string,
  userMetadata?: Record<string, unknown> | null
): string {
  const tid = tenantId.trim();
  if (isUuidString(tid)) return tid;

  const fromJwt = userMetadata?.tenant_id;
  if (typeof fromJwt === "string" && isUuidString(fromJwt)) {
    return fromJwt.trim();
  }

  return normalizeTenantId(tid);
}
