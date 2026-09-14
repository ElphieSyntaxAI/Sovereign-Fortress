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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Monorepo app → workspace presets: each customer-facing app is its own `msgf_user_projects` row.
 * `project_origin` tags pillar health, eco, and ingest metadata per silo (not one blob for the whole repo).
 */

export type MonorepoWorkspacePreset = {
  /** Stable id for UI keys. */
  id: string;
  display_name: string;
  /** Stored on `msgf_user_projects.project_origin` — scopes dashboard health filters. */
  project_origin: string;
  /** Suggested relative path from monorepo root when registering a local folder. */
  suggested_local_path: string;
  /** Optional GitHub `owner/repo` when the app is published separately. */
  suggested_github_repo?: string;
  /** Matches `tenant-manifest.json` tenant label when applicable. */
  tenant_manifest_key?: string;
  product_url?: string;
};

/**
 * Elphie Syntax monorepo — register each app as its own workspace (not the repo root only).
 */
export const MONOREPO_WORKSPACE_PRESETS: readonly MonorepoWorkspacePreset[] = [
  {
    id: "msgf-gated-ai",
    display_name: "MSGF Gated AI (platform)",
    project_origin: "elphiesyntax/msgf",
    suggested_local_path: "packages/msgf",
    product_url: "https://elphiesgatedai.elphiesyntax.com",
    tenant_manifest_key: "tenant_gated",
  },
  {
    id: "author-ecosystem",
    display_name: "Author Ecosystem",
    project_origin: "elphiesyntax/author-ecosystem",
    suggested_local_path: "apps/author-ecosystem",
    suggested_github_repo: "elphiesyntax/author-ecosystem",
    product_url: "https://authorecosystem.elphiesyntax.com",
    tenant_manifest_key: "tenant_author",
  },
  {
    id: "syntax-educates",
    display_name: "Syntax Educates",
    project_origin: "elphiesyntax/syntax-educates",
    suggested_local_path: "apps/syntax-educates",
    product_url: "https://syntaxeducates.elphiesyntax.com",
    tenant_manifest_key: "tenant_education",
  },
  {
    id: "client-vortex",
    display_name: "Vortex Client",
    project_origin: "elphiesyntax/client-vortex",
    suggested_local_path: "apps/client-vortex",
    tenant_manifest_key: "vortex",
  },
] as const;

export function buildCreateProjectBodyFromPreset(
  preset: MonorepoWorkspacePreset,
  overrides?: { display_name?: string; local_path?: string }
) {
  return {
    source_type: "local" as const,
    display_name: overrides?.display_name?.trim() || preset.display_name,
    local_path: overrides?.local_path?.trim() || preset.suggested_local_path,
    project_origin: preset.project_origin,
  };
}
