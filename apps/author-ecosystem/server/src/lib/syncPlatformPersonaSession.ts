import type { Response } from "express";
import type { User } from "@supabase/supabase-js";
import {
  ELPHIE_PERSONA_COOKIE,
  ELPHIE_PLATFORM_COOKIE,
  PLATFORM_COMING_SOON,
  personaToProfileRole,
  resolveOperationalTenantId,
  type PlatformId,
} from "msgf/lib/platform-persona-auth";
import { MSGF } from "msgf/onboarding";

import { bffCookieBaseOptions } from "./bffAuthCookies.js";
import { ensurePublicAuthorProfile } from "./ensurePublicAuthorProfile.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

export function setPlatformContextCookies(res: Response, platform: PlatformId, persona: string): void {
  platformContextCookies(res, platform, persona);
}

export type PlatformPersonaContext = {
  platform: PlatformId;
  persona: string;
};

function platformContextCookies(res: Response, platform: PlatformId, persona: string): void {
  const base = bffCookieBaseOptions();
  const opts = {
    ...base,
    maxAge: base.maxAge,
    httpOnly: true,
  };
  res.cookie(ELPHIE_PLATFORM_COOKIE, platform, opts);
  res.cookie(ELPHIE_PERSONA_COOKIE, persona, opts);
}

/**
 * After Supabase sign-in: persist platform/persona, MSGF license on `p4_profiles` (P3),
 * pledge beat, brain baseline, and cross-subdomain context cookies.
 */
export async function syncPlatformPersonaSession(
  res: Response,
  user: User,
  ctx: PlatformPersonaContext
): Promise<{
  tenantId: string;
  userRole: string;
  provisionedLicense: boolean;
}> {
  if (PLATFORM_COMING_SOON[ctx.platform]) {
    throw new Error("This platform is not yet available for sign-in.");
  }

  const admin = getSupabaseAdmin();
  const meta = { ...(user.user_metadata ?? {}) };
  const username =
    typeof meta.username === "string" && meta.username.trim()
      ? meta.username.trim()
      : user.email?.split("@")[0] ?? "entity";

  const { tenantId, userRole, provisionedLicense } = await MSGF.syncPlatformEntitlement({
    supabase: admin,
    entityId: user.id,
    username,
    platform: ctx.platform,
    persona: ctx.persona,
    preferredTheme: typeof meta.preferred_theme === "string" ? meta.preferred_theme : "Pleasure",
  });

  await ensurePublicAuthorProfile(admin, user);

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      platform: ctx.platform,
      persona: ctx.persona,
      terms_role: userRole,
      user_role: userRole,
      tenant_id: tenantId,
      msgf_license_provisioned: provisionedLicense,
    },
  });

  platformContextCookies(res, ctx.platform, ctx.persona);

  return { tenantId, userRole, provisionedLicense };
}

/** @deprecated Use {@link syncPlatformPersonaSession} — kept for imports that only need tenant slug. */
export function authorOperationalTenantId(): string {
  return resolveOperationalTenantId("author");
}

/** @deprecated */
export function personaToAuthorRole(persona: string): string {
  return personaToProfileRole("author", persona);
}
