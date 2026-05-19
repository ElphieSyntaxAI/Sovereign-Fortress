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

export const PLATFORM_TENANT_ID: Record<PlatformId, string> = {
  author: "tenant_author",
  education: "tenant_education",
  gatedai: "tenant_gated",
};

/** Platforms blocked from sign-in until product launch. */
export const PLATFORM_COMING_SOON: Record<PlatformId, boolean> = {
  author: true,
  education: true,
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

export function resolvePostLoginRedirect(platform: PlatformId): string {
  if (platform === "author") return "/dashboard";
  if (platform === "education") {
    return (
      process.env.EDUCATION_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_EDUCATION_APP_URL?.trim() ||
      "https://syntaxeducates.elphiesyntax.com"
    );
  }
  const base =
    process.env.MSGF_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim() ||
    "https://elphiesgatedai.elphiesyntax.com";
  return base.endsWith("/dashboard") ? base : `${base.replace(/\/$/, "")}/dashboard`;
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
