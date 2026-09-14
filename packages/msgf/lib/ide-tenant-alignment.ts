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
 * Align IDE `msgf.tenantKey` with `p4_profiles.tenant_id` (operational license tenant).
 * Workspace presets use `org/repo` project_origin; profiles use slugs like `author_ecosystem`.
 */

import {
  resolveOperationalTenantId,
  type PlatformId,
} from "@/lib/platform-persona-auth";
import { MONOREPO_WORKSPACE_PRESETS } from "@/lib/services/monorepo-workspace-presets";
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";

const MANIFEST_TO_PLATFORM: Record<string, PlatformId> = {
  tenant_author: "author",
  tenant_education: "education",
  tenant_gated: "gatedai",
};

function operationalTenantForPreset(
  preset: (typeof MONOREPO_WORKSPACE_PRESETS)[number]
): string | null {
  const key = preset.tenant_manifest_key?.trim();
  if (!key) return null;
  const platform = MANIFEST_TO_PLATFORM[key];
  return platform ? resolveOperationalTenantId(platform) : null;
}

/** Map `elphiesyntax/author-ecosystem` → `author_ecosystem` when preset-linked. */
export function operationalTenantForProjectOrigin(projectOrigin: string): string | null {
  const origin = sanitizeTenantScope(projectOrigin);
  if (!origin.includes("/")) return null;
  const preset = MONOREPO_WORKSPACE_PRESETS.find((p) => p.project_origin === origin);
  return preset ? operationalTenantForPreset(preset) : null;
}

/** Map `apps/author-ecosystem` (folder path) → `author_ecosystem`. */
export function operationalTenantForLocalPath(localPath: string): string | null {
  const normalized = sanitizeTenantScope(localPath).replace(/\\/g, "/");
  const preset = MONOREPO_WORKSPACE_PRESETS.find(
    (p) =>
      normalized === p.suggested_local_path ||
      normalized.endsWith(`/${p.suggested_local_path}`)
  );
  return preset ? operationalTenantForPreset(preset) : null;
}

function looksLikeProjectOrigin(key: string): boolean {
  const slash = key.indexOf("/");
  return slash > 0 && slash < key.length - 1;
}

/**
 * True when header tenant key matches profile/license tenant (direct or via monorepo preset).
 */
export function ideTenantKeysAlignForLicense(
  licenseTenantId: string,
  headerTenantKey: string
): boolean {
  const license = sanitizeTenantScope(licenseTenantId);
  const header = sanitizeTenantScope(headerTenantKey);
  if (!header) return true;
  if (license === header) return true;

  // Gated AI platform license — IDE uses mapped org/repo project_origin for telemetry.
  if (license === "tenant_gated" && looksLikeProjectOrigin(header)) return true;

  const fromOrigin = operationalTenantForProjectOrigin(header);
  if (fromOrigin && fromOrigin === license) return true;

  const fromPath = operationalTenantForLocalPath(header);
  if (fromPath && fromPath === license) return true;

  const licenseFromOrigin = operationalTenantForProjectOrigin(license);
  if (licenseFromOrigin && licenseFromOrigin === header) return true;

  return false;
}

/**
 * True when IDE token row tenant_id matches X-MSGF-Tenant-Key — including monorepo
 * `elphiesyntax/author-ecosystem` ↔ `apps/author-ecosystem` for the same preset.
 */
export function ideTokenTenantAlignsWithHeader(
  tokenTenantId: string,
  headerTenantKey: string
): boolean {
  const token = sanitizeTenantScope(tokenTenantId);
  const header = sanitizeTenantScope(headerTenantKey);
  if (!header) return true;
  if (!token) return false;
  if (token === header) return true;

  for (const preset of MONOREPO_WORKSPACE_PRESETS) {
    const origin = sanitizeTenantScope(preset.project_origin);
    const path = sanitizeTenantScope(preset.suggested_local_path);
    const tokenMatches = token === origin || token === path;
    const headerMatches = header === origin || header === path;
    if (tokenMatches && headerMatches) return true;
  }

  return (
    ideTenantKeysAlignForLicense(token, header) || ideTenantKeysAlignForLicense(header, token)
  );
}
