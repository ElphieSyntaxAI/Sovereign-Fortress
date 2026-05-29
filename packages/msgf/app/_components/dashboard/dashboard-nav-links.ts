export type DashboardNavLink = {
  label: string;
  href: string;
  /** Highlight when pathname matches (hash links use dashboard path only). */
  matchPath?: string;
  accent?: "amber";
};

export const DASHBOARD_PRIMARY_LINKS = (
  tokenSavingsHref: string
): DashboardNavLink[] => [
  { label: "Dashboard", href: "/dashboard", matchPath: "/dashboard" },
  {
    label: "Daily Reports",
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
  { label: "Pillar Guide", href: "/getting-started#six-pillars" },
  { label: "System Status", href: "/status", matchPath: "/status" },
  { label: "Other Products", href: "/other-products", matchPath: "/other-products" },
];
