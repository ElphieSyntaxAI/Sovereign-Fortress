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
export type DashboardNavLink = {
  label: string;
  href: string;
  /** Highlight when pathname matches (hash links use dashboard path only). */
  matchPath?: string;
  accent?: "amber";
};

/**
 * Authenticated app chrome only. Do not point “Home” at `/` — that is the public
 * platform chooser (`PlatformHubLanding`), not the governance dashboard.
 */
export const DASHBOARD_PRIMARY_LINKS = (
  tokenSavingsHref: string
): DashboardNavLink[] => [
  { label: "Dashboard", href: "/dashboard", matchPath: "/dashboard" },
  {
    label: "Reports",
    href: "/dashboard/daily-reports",
    matchPath: "/dashboard/daily-reports",
  },
  { label: "Token Savings", href: tokenSavingsHref, matchPath: "/dashboard", accent: "amber" },
  {
    label: "Security View",
    href: "/dashboard#security-view",
    matchPath: "/dashboard",
  },
  { label: "Workspace", href: "/workspace", matchPath: "/workspace" },
];

export const DASHBOARD_SETTINGS_LINKS: DashboardNavLink[] = [
  { label: "Account", href: "/account", matchPath: "/account" },
  { label: "Pillar Guide", href: "/getting-started#six-pillars" },
  { label: "System Status", href: "/status", matchPath: "/status" },
  { label: "Other Products", href: "/other-products", matchPath: "/other-products" },
  { label: "Platform hub", href: "/", matchPath: "/" },
];

/** Primary links shown on marketing chrome when signed in (same destinations as app nav). */
export const SIGNED_IN_MARKETING_PRIMARY_LINKS: DashboardNavLink[] = [
  { label: "Dashboard", href: "/dashboard", matchPath: "/dashboard" },
  {
    label: "Reports",
    href: "/dashboard/daily-reports",
    matchPath: "/dashboard/daily-reports",
  },
  { label: "Workspace", href: "/workspace", matchPath: "/workspace" },
  { label: "Account", href: "/account", matchPath: "/account" },
];
