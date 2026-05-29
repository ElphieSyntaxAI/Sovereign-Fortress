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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/** Dev vs tenant lens for dashboard Security View (page-scoped, like Author creative/business). */

export type SecurityViewLens = "dev" | "user";

export const SECURITY_LENS_STORAGE_KEY = "elphie_msgf_security_lens";
export const SECURITY_PROJECT_STORAGE_KEY = "elphie_msgf_security_project_origin";

export function readStoredSecurityProject(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(SECURITY_PROJECT_STORAGE_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function storeSecurityProject(projectOrigin: string): void {
  try {
    localStorage.setItem(SECURITY_PROJECT_STORAGE_KEY, projectOrigin);
  } catch {
    /* private mode */
  }
}

export const SECURITY_LENS_META: Record<
  SecurityViewLens,
  { label: string; title: string; description: string; hash: string }
> = {
  dev: {
    label: "Dev",
    title: "IDE & verify loop",
    description:
      "Extension wiring, allowlisted Safe Build / Run Scripts, and Vault/Hall outcomes from your machine.",
    hash: "#security-view-dev",
  },
  user: {
    label: "Tenant",
    title: "Tenant containment",
    description:
      "Pulse routing, credit guard, deduped incidents, and six-pillar governance inside your silo.",
    hash: "#security-view",
  },
};

export function parseSecurityViewLens(raw: unknown): SecurityViewLens {
  return raw === "dev" ? "dev" : "user";
}

export function readStoredSecurityLens(): SecurityViewLens {
  if (typeof window === "undefined") return "user";
  try {
    return parseSecurityViewLens(localStorage.getItem(SECURITY_LENS_STORAGE_KEY));
  } catch {
    return "user";
  }
}

export function storeSecurityLens(lens: SecurityViewLens): void {
  try {
    localStorage.setItem(SECURITY_LENS_STORAGE_KEY, lens);
  } catch {
    /* private mode */
  }
}

export function lensFromHash(hash: string): SecurityViewLens {
  if (hash.includes("security-view-dev")) return "dev";
  return "user";
}

export function hashForSecurityLens(lens: SecurityViewLens): string {
  return SECURITY_LENS_META[lens].hash;
}
