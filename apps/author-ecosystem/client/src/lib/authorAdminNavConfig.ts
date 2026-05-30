import {
  buildAuthorAdminMsgfLinks,
  buildMsgfToAuthorHandoffUrl,
  type AuthorAdminMsgfLinks,
} from "@elphie-syntax/core/author-admin-msgf-links";
import {
  buildMsgfAdminPortalUrl,
  buildMsgfAdminSignInUrl,
} from "@elphie-syntax/core/platform-admin-auth";

import type { AuthorRoleId } from "../context/AuthorRoleContext";

export type AuthorAdminNavItem = {
  id: string;
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
  section?: "platform" | "roles" | "account";
  matchPrefix?: string;
  roleId?: AuthorRoleId;
};

export type AuthorAdminProduct = {
  id: "msgf" | "author" | "education";
  title: string;
  summary: string;
  href: string;
  external?: boolean;
  tone: "emerald" | "amethyst" | "topaz";
};

function envOrigin(key: string, fallback: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[key]?.trim();
  return v?.replace(/\/+$/, "") || fallback;
}

function msgfOrigin(): string {
  return envOrigin("VITE_MSGF_APP_URL", "https://elphiesgatedai.elphiesyntax.com");
}

export function authorAdminMsgfLinks(): AuthorAdminMsgfLinks {
  return buildAuthorAdminMsgfLinks(msgfOrigin());
}

export function authorHandoffFromMsgf(authorReturnTo: string): string {
  return buildMsgfToAuthorHandoffUrl(msgfOrigin(), authorReturnTo);
}

export function authorAdminProducts(): AuthorAdminProduct[] {
  const msgfLinks = authorAdminMsgfLinks();
  const author = envOrigin("VITE_AUTHOR_APP_URL", "https://authorecosystem.elphiesyntax.com");
  const education = envOrigin("VITE_EDUCATION_APP_URL", "https://syntaxeducates.elphiesyntax.com");

  return [
    {
      id: "msgf",
      title: "MSGF — Gated AI",
      summary: "Ops console, pillar health, bugs, and Author tenant token savings.",
      href: msgfLinks.portal,
      external: true,
      tone: "emerald",
    },
    {
      id: "author",
      title: "Author Ecosystem",
      summary: "Sovereign manuscripts, wiki, HAL, and Vault Pact.",
      href: `${author}/home`,
      external: typeof window !== "undefined" && !window.location.origin.includes("localhost")
        ? window.location.hostname !== "authorecosystem.elphiesyntax.com"
        : false,
      tone: "amethyst",
    },
    {
      id: "education",
      title: "Syntax Education",
      summary: "LTI classrooms, allowance tiers, and teacher dashboards.",
      href: education,
      external: true,
      tone: "topaz",
    },
  ];
}

export function msgfOperatorSignInHref(): string {
  return buildMsgfAdminSignInUrl({
    from: "author",
    next: "/admin/portal",
    hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
    env: import.meta.env as Record<string, string | undefined>,
  });
}

export function msgfOperatorPortalHref(): string {
  return buildMsgfAdminPortalUrl({
    hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
    env: import.meta.env as Record<string, string | undefined>,
  });
}

/** Role workspace landing routes (after persona switch). */
export const ROLE_WORKSPACE_HOME: Record<
  AuthorRoleId,
  { path: string; lens: "creative" | "business"; label: string }
> = {
  author: { path: "/home", lens: "creative", label: "Author home" },
  editor: { path: "/editor-suggestions", lens: "creative", label: "Editor workspace" },
  helper: { path: "/guild", lens: "business", label: "Helper guild" },
  publisher: { path: "/publishing-requests", lens: "business", label: "Publisher requests" },
  fan: { path: "/fan-management", lens: "business", label: "Fan hub" },
};

export const AUTHOR_ADMIN_NAV: AuthorAdminNavItem[] = [
  { id: "admin", label: "Overview", to: "/admin", section: "platform", matchPrefix: "/admin" },
  { id: "msgf-ops", label: "MSGF ops", to: "/admin/ops", section: "platform", matchPrefix: "/admin/ops" },
  {
    id: "msgf-portal",
    label: "MSGF portal ↗",
    href: msgfOrigin() + "/admin/portal",
    external: true,
    section: "platform",
  },
  { id: "author", label: "Author", to: "/admin/workspace/author", section: "roles", roleId: "author" },
  { id: "editor", label: "Editor", to: "/admin/workspace/editor", section: "roles", roleId: "editor" },
  { id: "helper", label: "Helpers", to: "/admin/workspace/helper", section: "roles", roleId: "helper" },
  {
    id: "publisher",
    label: "Publishers",
    to: "/admin/workspace/publisher",
    section: "roles",
    roleId: "publisher",
  },
  { id: "fan", label: "Fans", to: "/admin/workspace/fan", section: "roles", roleId: "fan" },
  {
    id: "settings",
    label: "Global settings",
    to: "/admin/settings",
    section: "account",
    matchPrefix: "/admin/settings",
  },
  {
    id: "notifications",
    label: "Notifications",
    to: "/admin/notifications",
    section: "account",
    matchPrefix: "/admin/notifications",
  },
];
