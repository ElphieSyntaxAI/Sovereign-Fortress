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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
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
export const DASHBOARD_PRIMARY_LINKS: DashboardNavLink[] = [
  { label: "Dashboard", href: "/dashboard", matchPath: "/dashboard" },
  {
    label: "Reports",
    href: "/dashboard/daily-reports",
    matchPath: "/dashboard/daily-reports",
  },
  { label: "Security", href: "/security", matchPath: "/security" },
  { label: "Workspace", href: "/workspace", matchPath: "/workspace" },
];

export const DASHBOARD_ACCOUNT_LINKS: DashboardNavLink[] = [
  { label: "Account", href: "/account", matchPath: "/account" },
];

export const DASHBOARD_PRODUCT_LINKS: DashboardNavLink[] = [
  { label: "Docs", href: "/getting-started", matchPath: "/getting-started" },
  { label: "System Status", href: "/status", matchPath: "/status" },
  { label: "Other Products", href: "/other-products", matchPath: "/other-products" },
  { label: "Platform hub", href: "/", matchPath: "/" },
];

export const DASHBOARD_ADMIN_LINKS: DashboardNavLink[] = [
  { label: "Portal", href: "/admin/portal", matchPath: "/admin/portal" },
  { label: "Pillar health", href: "/admin/dashboard", matchPath: "/admin/dashboard" },
  { label: "Ops", href: "/admin/ops", matchPath: "/admin/ops" },
];

/** @deprecated Flat list kept for older imports. Prefer the grouped menus. */
export const DASHBOARD_SETTINGS_LINKS: DashboardNavLink[] = [
  ...DASHBOARD_ACCOUNT_LINKS,
  ...DASHBOARD_PRODUCT_LINKS,
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
