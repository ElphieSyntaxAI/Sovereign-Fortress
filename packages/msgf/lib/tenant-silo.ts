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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
import manifest from "@/config/tenant-manifest.json";

export type TenantManifestEntry = {
  label?: string;
  WHITELISTED_PATHS: string[];
};

export type TenantManifest = {
  version: number;
  tenants: Record<string, TenantManifestEntry>;
};

const M = manifest as TenantManifest;

export function getTenantManifest(): TenantManifest {
  return M;
}

export function getWhitelistedPathsForTenant(tenantId: string): string[] | null {
  const t = M.tenants[tenantId];
  return t?.WHITELISTED_PATHS ?? null;
}

/** Glob-lite: `**` = any depth under prefix; trailing `/**` = directory tree. */
export function pathMatchesWhitelist(
  filePath: string,
  patterns: string[]
): boolean {
  const p = filePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
  return patterns.some((pattern) => matchesOne(p, pattern.replace(/\\/g, "/")));
}

function escRe(s: string) {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function matchesOne(file: string, pattern: string): boolean {
  if (pattern.endsWith("/**")) {
    const root = pattern.slice(0, -3);
    return file === root || file.startsWith(`${root}/`);
  }
  if (pattern.endsWith("/*")) {
    const root = pattern.slice(0, -2);
    if (file === root) return true;
    if (!file.startsWith(`${root}/`)) return false;
    const rest = file.slice(root.length + 1);
    return !rest.includes("/");
  }
  if (pattern.includes("**")) {
    const idx = pattern.indexOf("**");
    const left = pattern.slice(0, idx);
    const right = pattern.slice(idx + 2);
    if (!file.startsWith(left)) return false;
    if (right.length > 0 && !file.endsWith(right)) return false;
    return true;
  }
  if (pattern.includes("*")) {
    const re = new RegExp(
      `^${pattern.split("*").map(escRe).join("[^/]*")}$`
    );
    return re.test(file);
  }
  return file === pattern;
}

export function assertPathsAllowedForTenant(
  tenantId: string,
  paths: string[]
): { ok: true } | { ok: false; violations: string[] } {
  const list = getWhitelistedPathsForTenant(tenantId);
  if (!list) {
    return { ok: false, violations: [`Unknown tenant_id: ${tenantId}`] };
  }
  const violations = paths.filter((f) => !pathMatchesWhitelist(f, list));
  if (violations.length) return { ok: false, violations };
  return { ok: true };
}
