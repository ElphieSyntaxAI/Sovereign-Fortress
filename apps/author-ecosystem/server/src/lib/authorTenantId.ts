import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * BFF row scope (`p4_manuscripts.tenant_id`, Google credentials, etc.).
 * Prefer `user_metadata.legacy_user_id` when present (post-migration authors).
 */
export function bffTenantIdFromSupabaseUser(user: Pick<User, "id" | "user_metadata">): string {
  const meta = user.user_metadata ?? {};
  const legacyRaw = meta["legacy_user_id"];
  if (typeof legacyRaw === "string" && legacyRaw.trim()) return legacyRaw.trim();
  if (typeof legacyRaw === "number") return String(legacyRaw);
  return user.id;
}

/** Expand a tenant id to auth uuid + legacy uuid when `p4_profiles` maps them. */
export async function expandBffTenantIdAliases(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string[]> {
  const ids = new Set<string>([tenantId.trim()].filter(Boolean));
  const { data: byUser } = await supabase
    .from("p4_profiles")
    .select("user_id, legacy_user_id")
    .eq("user_id", tenantId)
    .maybeSingle();
  if (byUser?.legacy_user_id) ids.add(String(byUser.legacy_user_id));

  const { data: byLegacy } = await supabase
    .from("p4_profiles")
    .select("user_id, legacy_user_id")
    .eq("legacy_user_id", tenantId)
    .maybeSingle();
  if (byLegacy?.user_id) ids.add(String(byLegacy.user_id));

  return [...ids];
}
