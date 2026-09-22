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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Multi-tenant platform + persona maps for unified login (P3 Entity Profile / `p4_profiles`).
 */
export const PLATFORM_IDS = ["author", "education", "gatedai"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export type PersonaOption = { id: string; label: string };

export const PERSONAS_BY_PLATFORM: Record<PlatformId, PersonaOption[]> = {
  author: [
    { id: "author", label: "Author" },
    { id: "editor", label: "Editor" },
    { id: "helper", label: "Helper" },
    { id: "publisher", label: "Publisher" },
  ],
  education: [
    { id: "student", label: "Student" },
    { id: "teacher", label: "Teacher" },
    { id: "administration_it", label: "Administration / IT" },
  ],
  gatedai: [
    { id: "developer", label: "Developer" },
    { id: "company_owner_it", label: "Company Owner / IT Admin" },
  ],
};

/** CI / manifest silo labels (tenant-manifest.json). */
export const PLATFORM_MANIFEST_TENANT: Record<PlatformId, string> = {
  author: "tenant_author",
  education: "tenant_education",
  gatedai: "tenant_gated",
};

/**
 * Operational `tenant_id` stored on `p4_profiles`, `state_beats`, and Pulse headers.
 * Author uses `author_ecosystem` (MSGF pulse + MsgfBridge default).
 */
export function resolveOperationalTenantId(platform: PlatformId): string {
  if (platform === "author") {
    return (
      process.env.MSGF_AUTHOR_TENANT_ID?.trim() ||
      process.env.NEXT_PUBLIC_MSGF_AUTHOR_TENANT_ID?.trim() ||
      "author_ecosystem"
    );
  }
  if (platform === "education") {
    return (
      process.env.MSGF_EDUCATION_TENANT_ID?.trim() ||
      process.env.NEXT_PUBLIC_MSGF_EDUCATION_TENANT_ID?.trim() ||
      "syntax_education"
    );
  }
  return (
    process.env.MSGF_GATED_TENANT_ID?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_GATED_TENANT_ID?.trim() ||
    "tenant_gated"
  );
}

/** @deprecated Prefer {@link resolveOperationalTenantId} at runtime. */
export const PLATFORM_TENANT_ID: Record<PlatformId, string> = {
  author: "author_ecosystem",
  education: "syntax_education",
  gatedai: "tenant_gated",
};

/** Platforms blocked from sign-in until product launch. */
export const PLATFORM_COMING_SOON: Record<PlatformId, boolean> = {
  author: false,
  /** Phase 1 Education auth live — student / teacher / administration_it. */
  education: false,
  gatedai: false,
};

export const ELPHIE_PLATFORM_COOKIE = "elphie_platform";
export const ELPHIE_PERSONA_COOKIE = "elphie_persona";

export type PlatformLoginBody = {
  email: string;
  password: string;
  platform: PlatformId;
  persona: string;
};

export function isPlatformId(v: unknown): v is PlatformId {
  return typeof v === "string" && (PLATFORM_IDS as readonly string[]).includes(v);
}

export function isPersonaValidForPlatform(platform: PlatformId, persona: string): boolean {
  const p = persona.trim().toLowerCase();
  return PERSONAS_BY_PLATFORM[platform].some((o) => o.id === p);
}

/** Maps UI persona to `p4_profiles.user_role` / Supabase `user_metadata` role slug. */
export function personaToProfileRole(platform: PlatformId, persona: string): string {
  const p = persona.trim().toLowerCase();
  if (platform === "author") {
    if (p === "editor" || p === "helper" || p === "publisher" || p === "author") return p;
    return "author";
  }
  if (platform === "education") {
    if (p === "student" || p === "teacher" || p === "administration_it") return p;
    return "student";
  }
  if (p === "company_owner_it") return "company_admin";
  if (p === "developer") return "developer";
  return "developer";
}

function msgfAppOrigin(): string {
  return (
    process.env.MSGF_APP_URL?.trim()?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim()?.replace(/\/$/, "") ||
    "https://elphiesgatedai.elphiesyntax.com"
  );
}

function authorAppOrigin(): string {
  return (
    process.env.AUTHOR_APP_URL?.trim()?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_AUTHOR_APP_URL?.trim()?.replace(/\/$/, "") ||
    "https://authorecosystem.elphiesyntax.com"
  );
}

function educationAppOrigin(): string {
  return (
    process.env.EDUCATION_APP_URL?.trim()?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_EDUCATION_APP_URL?.trim()?.replace(/\/$/, "") ||
    "https://syntaxeducates.elphiesyntax.com"
  );
}

function sharedAuthCookieDomain(): string | undefined {
  const raw =
    process.env.MSGF_AUTH_COOKIE_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_AUTH_COOKIE_DOMAIN?.trim();
  if (!raw || raw.toLowerCase() === "host") return undefined;
  return raw;
}

function hostSharesAuthCookie(requestHost: string | undefined, targetOrigin: string): boolean {
  if (!requestHost?.trim()) return false;
  const host = requestHost.trim().toLowerCase().split(":")[0];
  const domain = sharedAuthCookieDomain();
  if (!domain?.startsWith(".")) {
    try {
      return new URL(targetOrigin).hostname.toLowerCase() === host;
    } catch {
      return false;
    }
  }
  const root = domain.slice(1).toLowerCase();
  try {
    const targetHost = new URL(targetOrigin).hostname.toLowerCase();
    const hostOk = host === root || host.endsWith(`.${root}`);
    const targetOk = targetHost === root || targetHost.endsWith(`.${root}`);
    return hostOk && targetOk;
  } catch {
    return false;
  }
}

/** Education SPA path after platform login (persona-aware). */
export function educationPathForPersona(persona?: string): string {
  const p = (persona ?? "student").trim().toLowerCase();
  if (p === "teacher") return "/teacher";
  if (p === "administration_it") return "/curriculum";
  return "/sandbox";
}

export function resolvePostLoginRedirect(platform: PlatformId, persona?: string): string {
  if (platform === "author") {
    const base = authorAppOrigin();
    if (!process.env.AUTHOR_APP_URL?.trim() && !process.env.NEXT_PUBLIC_AUTHOR_APP_URL?.trim()) {
      return "/home";
    }
    return `${base}/home`;
  }
  if (platform === "education") {
    return `${educationAppOrigin()}${educationPathForPersona(persona)}`;
  }
  const base = msgfAppOrigin();
  return `${base}/dashboard`;
}

/**
 * After BFF login: when cookies are not shared across subdomains, send the user to sign-in
 * on the destination app instead of /dashboard (avoids "logged in on Author, logged out on MSGF").
 */
export function resolvePostLoginRedirectForRequest(
  platform: PlatformId,
  requestHost?: string,
  persona?: string
): string {
  if (platform === "author") {
    return resolvePostLoginRedirect(platform, persona);
  }

  const destination = platform === "education" ? educationAppOrigin() : msgfAppOrigin();
  const nextPath =
    platform === "education" ? educationPathForPersona(persona) : "/dashboard";

  if (hostSharesAuthCookie(requestHost, destination)) {
    return platform === "education"
      ? `${destination}${nextPath}`
      : `${destination}${nextPath}`;
  }

  const signInNext = encodeURIComponent(nextPath);
  return `${destination}/sign-in?next=${signInNext}`;
}

export function parsePlatformLoginBody(body: Record<string, unknown>): PlatformLoginBody | null {
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const platformRaw = String(body.platform ?? "").trim().toLowerCase();
  const persona = String(body.persona ?? "").trim().toLowerCase();
  if (!email || !password || !isPlatformId(platformRaw)) return null;
  if (!isPersonaValidForPlatform(platformRaw, persona)) return null;
  return { email, password, platform: platformRaw, persona };
}
