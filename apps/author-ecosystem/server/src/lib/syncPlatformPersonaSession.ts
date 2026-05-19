import type { Response } from "express";
import type { User } from "@supabase/supabase-js";
import {
  ELPHIE_PERSONA_COOKIE,
  ELPHIE_PLATFORM_COOKIE,
  PLATFORM_COMING_SOON,
  PLATFORM_TENANT_ID,
  personaToProfileRole,
  type PlatformId,
} from "msgf/lib/platform-persona-auth";

import { bffCookieBaseOptions } from "./bffAuthCookies.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

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
 * After Supabase sign-in: persist platform/persona on auth user + P3 (`p4_profiles`) and set
 * cross-subdomain context cookies when `MSGF_AUTH_COOKIE_DOMAIN=.elphiesyntax.com`.
 */
export async function syncPlatformPersonaSession(
  res: Response,
  user: User,
  ctx: PlatformPersonaContext
): Promise<void> {
  if (PLATFORM_COMING_SOON[ctx.platform]) {
    throw new Error("This platform is not yet available for sign-in.");
  }

  const role = personaToProfileRole(ctx.platform, ctx.persona);
  const tenantId = PLATFORM_TENANT_ID[ctx.platform];
  const admin = getSupabaseAdmin();

  const meta = { ...(user.user_metadata ?? {}) };
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      platform: ctx.platform,
      persona: ctx.persona,
      terms_role: role,
      user_role: role,
      tenant_id: tenantId,
    },
  });

  const username =
    typeof meta.username === "string" && meta.username.trim()
      ? meta.username.trim()
      : user.email?.split("@")[0] ?? "entity";

  const { data: tierRow } = await admin
    .from("msgf_legacy_tiers")
    .select("tier_id")
    .eq("name", "Tier 1: Fan Access")
    .maybeSingle();
  const tierId = typeof tierRow?.tier_id === "number" ? tierRow.tier_id : 1;

  await admin.from("p4_profiles").upsert(
    {
      user_id: user.id,
      username,
      tier_id: tierId,
      user_role: role,
      tenant_id: tenantId,
      preferred_theme: typeof meta.preferred_theme === "string" ? meta.preferred_theme : "Pleasure",
    },
    { onConflict: "user_id" }
  );

  platformContextCookies(res, ctx.platform, ctx.persona);
}
