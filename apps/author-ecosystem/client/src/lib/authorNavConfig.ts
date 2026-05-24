import type { AuthorWorkspaceLens } from "./authorWorkspaceLens";

export type AuthorNavItem = {
  to: string;
  label: string;
  /** Prefix match for active state (e.g. /outline matches /outline/foo). */
  matchPrefix?: string;
};

export const CREATIVE_NAV: AuthorNavItem[] = [
  { to: "/manuscripts", label: "Manuscripts" },
  { to: "/outline", label: "Outline", matchPrefix: "/outline" },
  { to: "/drafting", label: "Drafting", matchPrefix: "/drafting" },
  { to: "/revision", label: "Revision passes", matchPrefix: "/revision" },
  { to: "/editor-suggestions", label: "Editor suggestions", matchPrefix: "/editor-suggestions" },
  { to: "/notifications", label: "Notifications" },
  { to: "/settings", label: "Settings" },
];

export const BUSINESS_NAV: AuthorNavItem[] = [
  { to: "/guild", label: "Creative Guild", matchPrefix: "/guild" },
  { to: "/publishing-requests", label: "Publishing requests", matchPrefix: "/publishing-requests" },
];

export function navItemsForLens(lens: AuthorWorkspaceLens): AuthorNavItem[] {
  return lens === "business" ? BUSINESS_NAV : CREATIVE_NAV;
}
