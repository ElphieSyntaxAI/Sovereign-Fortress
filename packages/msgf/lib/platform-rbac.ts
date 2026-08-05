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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Platform RBAC — admin | security | auditor | dev (company-scoped team roles).
 * Independent personal sandbox sessions auto-receive admin + security + dev.
 */

export type PlatformRole = "admin" | "security" | "auditor" | "dev";

export type AccountStatus = "active" | "pending_signatures";

export type SessionPermissions = {
  roles: PlatformRole[];
  primaryRole: PlatformRole | null;
  isIndependentSandbox: boolean;
  accountStatus: AccountStatus;
  canAccessWorkspace: boolean;
  canAccessGovernanceDashboard: boolean;
  canManageTeam: boolean;
  canWriteDestructive: boolean;
  isReadOnlyCompliance: boolean;
  isDocuSignLocked: boolean;
};

const ALL_INDIE_ROLES: PlatformRole[] = ["admin", "security", "dev"];

export function normalizePlatformRole(raw: string | null | undefined): PlatformRole | null {
  const s = raw?.trim().toLowerCase();
  if (s === "admin" || s === "security" || s === "auditor" || s === "dev") return s;
  return null;
}

export function normalizeAccountStatus(raw: string | null | undefined): AccountStatus {
  return raw?.trim() === "pending_signatures" ? "pending_signatures" : "active";
}

function isMsgfOperatorAdminRole(raw: string | null | undefined): boolean {
  const s = raw?.trim().toUpperCase();
  return s === "GLOBAL_ADMIN" || s === "COMPANY_ADMIN";
}

/** Marketing / platform hub routes stay visible regardless of team RBAC slice. */
export function isAlwaysVisibleNavLink(href: string): boolean {
  const path = href.split("#")[0];
  return (
    path === "/" ||
    path.startsWith("/features") ||
    path.startsWith("/brain") ||
    path.startsWith("/other-products") ||
    path.startsWith("/getting-started") ||
    path.startsWith("/pricing") ||
    path.startsWith("/status")
  );
}

export function resolveSessionPermissions(input: {
  isIndependentSandbox: boolean;
  teamPlatformRole: string | null | undefined;
  accountStatus?: string | null | undefined;
  msgfAccessRole?: string | null | undefined;
}): SessionPermissions {
  const accountStatus = normalizeAccountStatus(input.accountStatus);
  const isIndependentSandbox = input.isIndependentSandbox;

  if (isMsgfOperatorAdminRole(input.msgfAccessRole)) {
    return {
      roles: ["admin", "security", "dev"],
      primaryRole: "admin",
      isIndependentSandbox,
      accountStatus,
      canAccessWorkspace: true,
      canAccessGovernanceDashboard: true,
      canManageTeam: true,
      canWriteDestructive: true,
      isReadOnlyCompliance: false,
      isDocuSignLocked: false,
    };
  }

  const roles: PlatformRole[] = isIndependentSandbox
    ? [...ALL_INDIE_ROLES]
    : (() => {
        const r = normalizePlatformRole(input.teamPlatformRole);
        return r ? [r] : ["dev"];
      })();

  const primaryRole = roles[0] ?? null;
  const hasAdmin = roles.includes("admin");
  const hasSecurity = roles.includes("security");
  const hasAuditor = roles.includes("auditor");
  const hasDev = roles.includes("dev");

  const canAccessWorkspace = isIndependentSandbox || hasAdmin || hasDev;
  const canAccessGovernanceDashboard =
    isIndependentSandbox || hasAdmin || hasSecurity || hasAuditor;

  const isDocuSignLocked =
    accountStatus === "pending_signatures" && (hasDev || hasSecurity) && !hasAdmin && !hasAuditor;

  return {
    roles,
    primaryRole,
    isIndependentSandbox,
    accountStatus,
    canAccessWorkspace,
    canAccessGovernanceDashboard,
    canManageTeam: isIndependentSandbox || hasAdmin,
    canWriteDestructive: isIndependentSandbox || hasAdmin,
    isReadOnlyCompliance: hasAuditor && !hasAdmin,
    isDocuSignLocked,
  };
}

export function filterNavLinksForPermissions<T extends { href: string; label: string }>(
  links: T[],
  permissions: SessionPermissions
): T[] {
  if (permissions.isIndependentSandbox || permissions.roles.includes("admin")) {
    return links;
  }
  if (permissions.roles.includes("dev") && !permissions.canAccessGovernanceDashboard) {
    return links.filter(
      (l) =>
        l.href.startsWith("/workspace") ||
        l.href.startsWith("/dashboard") ||
        isAlwaysVisibleNavLink(l.href)
    );
  }
  if (permissions.roles.includes("security") || permissions.roles.includes("auditor")) {
    return links.filter(
      (l) =>
        l.href.startsWith("/dashboard") ||
        l.href.startsWith("/admin") ||
        l.href.includes("security") ||
        l.href.includes("daily-reports") ||
        l.href.includes("token-savings")
    );
  }
  return links;
}
