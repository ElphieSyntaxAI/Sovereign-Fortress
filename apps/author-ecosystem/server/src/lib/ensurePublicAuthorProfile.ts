import type { SupabaseClient, User } from "@supabase/supabase-js";

function displayNameForUser(user: Pick<User, "email" | "user_metadata">): string {
  const meta = user.user_metadata ?? {};
  if (typeof meta.display_name === "string" && meta.display_name.trim()) {
    return meta.display_name.trim();
  }
  if (typeof meta.username === "string" && meta.username.trim()) {
    return meta.username.trim();
  }
  return user.email?.split("@")[0]?.trim() || "Author";
}

/**
 * `legal_attestations.user_id` references `public.profiles.id` (same UUID as `auth.users`).
 * MSGF handoff / platform login only upserts `p4_profiles` — this row is required for Vault Pact attest.
 */
export async function ensurePublicAuthorProfile(
  admin: SupabaseClient,
  user: Pick<User, "id" | "email" | "user_metadata">
): Promise<void> {
  const userId = user.id.trim();
  if (!userId) {
    throw new Error("ensurePublicAuthorProfile: user id is required.");
  }

  const { data: existing, error: readErr } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (readErr) {
    throw new Error(`ensurePublicAuthorProfile: profiles read failed: ${readErr.message}`);
  }
  if (existing?.id) return;

  const displayName = displayNameForUser(user);
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`ensurePublicAuthorProfile: profiles upsert failed: ${error.message}`);
  }
}
