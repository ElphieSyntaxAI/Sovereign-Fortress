import type { AuthorWorkspaceLens } from "./authorWorkspaceLens";
import { isAuthorFanHubEnabled, isAuthorHelperEnabled } from "./postMvpGates";

export type AuthorNavItem = {
  to: string;
  label: string;
  /** Prefix match for active state (e.g. /outline matches /outline/foo). */
  matchPrefix?: string;
};

export const CREATIVE_NAV: AuthorNavItem[] = [
  { to: "/manuscripts", label: "Manuscripts" },
  { to: "/wiki", label: "Wiki", matchPrefix: "/wiki" },
  { to: "/outline", label: "Outline", matchPrefix: "/outline" },
  { to: "/drafting", label: "Drafting", matchPrefix: "/drafting" },
  { to: "/revision", label: "Revision passes", matchPrefix: "/revision" },
  { to: "/editor-suggestions", label: "Editor suggestions", matchPrefix: "/editor-suggestions" },
  { to: "/notifications", label: "Notifications" },
  { to: "/settings", label: "Settings" },
];

export const BUSINESS_NAV: AuthorNavItem[] = [
  { to: "/guild", label: "Creative Guild", matchPrefix: "/guild" },
  { to: "/fan-management", label: "Fan management", matchPrefix: "/fan-management" },
  { to: "/publishing-requests", label: "Publishing requests", matchPrefix: "/publishing-requests" },
];

export function navItemsForLens(lens: AuthorWorkspaceLens): AuthorNavItem[] {
  if (lens !== "business") return CREATIVE_NAV;
  return BUSINESS_NAV.filter((item) => {
    if (item.to === "/guild" && !isAuthorHelperEnabled()) return false;
    if (item.to === "/fan-management" && !isAuthorFanHubEnabled()) return false;
    return true;
  });
}
