import type { MsgfGuardSettings } from "./config";
import {
  MSGF_ACCESS_ROLE_HEADER,
  MSGF_FALLBACK_ROLE_HEADER,
  MSGF_ORGANIZATION_ID_HEADER,
} from "./constants";

/** V3.2 three-tier dashboard roles (IDE → Cloud Run RBAC). */
export type MsgfAccessRole = "global_admin" | "company_admin" | "dev";

const ROLE_ALIASES: Record<string, MsgfAccessRole> = {
  global_admin: "global_admin",
  globaladmin: "global_admin",
  global: "global_admin",
  global_administrator: "global_admin",
  company_admin: "company_admin",
  companyadmin: "company_admin",
  company: "company_admin",
  admin: "company_admin",
  dev: "dev",
  developer: "dev",
  develop: "dev",
};

export function normalizeAccessRole(raw: string | undefined | null): MsgfAccessRole | null {
  const key = raw?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  return ROLE_ALIASES[key] ?? null;
}

export function hasValidAuthToken(settings: MsgfGuardSettings): boolean {
  return settings.authToken.trim().length >= 8;
}

/**
 * Personal-token sandbox: valid bearer, no `msgf.organizationId`, and tenant is not bound to a team org slug.
 */
export function shouldApplySandboxCompanyAdminFallback(settings: MsgfGuardSettings): boolean {
  if (!hasValidAuthToken(settings)) return false;
  if (settings.organizationId.trim()) return false;

  const explicitTenant = settings.tenantKey.trim();
  if (!explicitTenant) return true;

  const orgSlug = settings.organizationId.trim();
  if (orgSlug && explicitTenant === orgSlug) return false;

  return !explicitTenant.includes("/");
}

export function buildRoleTrackingHeaders(settings: MsgfGuardSettings): Record<string, string> {
  const headers: Record<string, string> = {};

  const configuredRole = normalizeAccessRole(settings.role);
  if (configuredRole) {
    headers[MSGF_ACCESS_ROLE_HEADER] = configuredRole;
  }

  if (settings.organizationId.trim()) {
    headers[MSGF_ORGANIZATION_ID_HEADER] = settings.organizationId.trim();
  }

  if (shouldApplySandboxCompanyAdminFallback(settings)) {
    headers[MSGF_FALLBACK_ROLE_HEADER] = "company_admin";
  }

  return headers;
}
