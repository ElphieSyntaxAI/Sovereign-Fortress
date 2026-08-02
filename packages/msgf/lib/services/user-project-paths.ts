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
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";

export function normalizePathSegment(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}

/** Derive `owner/repo`-style origin from a local folder path (last two segments). */
export function deriveProjectOriginFromLocalPath(localPath: string): string {
  const normalized = normalizePathSegment(localPath);
  const parts = normalized.split("/").filter(Boolean);
  const raw =
    parts.length >= 2
      ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
      : (parts[parts.length - 1] ?? "local-project");
  return sanitizeTenantScope(raw).slice(0, 256);
}

/** Join parent absolute/relative path with a relative child (`apps/foo`). */
export function joinParentAndRelativeChild(parentPath: string, relativeChild: string): string {
  const parent = normalizePathSegment(parentPath);
  const child = normalizePathSegment(relativeChild);
  if (!parent) return child;
  if (!child) return parent;
  return `${parent}/${child}`;
}

export type LocalChildProjectInput = {
  source_type: "local";
  display_name: string;
  local_path: string;
  project_origin?: string;
};

/**
 * Build a local project mapping body from a monorepo parent + relative child folder.
 */
export function buildLocalChildProjectInput(params: {
  parentPath: string;
  relativeChild: string;
  displayName?: string;
  projectOrigin?: string;
}): LocalChildProjectInput {
  const local_path = joinParentAndRelativeChild(params.parentPath, params.relativeChild);
  const childLeaf =
    normalizePathSegment(params.relativeChild).split("/").filter(Boolean).pop() ??
    "local-project";
  return {
    source_type: "local",
    display_name: (params.displayName?.trim() || childLeaf).slice(0, 160),
    local_path,
    ...(params.projectOrigin?.trim()
      ? { project_origin: params.projectOrigin.trim() }
      : {}),
  };
}
