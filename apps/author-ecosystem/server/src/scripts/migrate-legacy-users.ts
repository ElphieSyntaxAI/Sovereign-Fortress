/**
 * One-time (or idempotent) migration: msgf_legacy_users → Supabase Auth + public.p4_profiles.
 *
 * Prerequisites:
 * - Apply migration `20260514140000_p4_profiles.sql` to the Supabase project.
 * - Monorepo root `.env.local` (or `.env`) with:
 *   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Passwords: legacy bcrypt hashes cannot be imported into GoTrue. Each migrated user gets a random
 * password; they must use "Forgot password" (or an admin invite flow) before first Supabase sign-in.
 *
 * Usage (from apps/author-ecosystem/server):
 *   npm run migrate:legacy-users
 * Dry run (no writes):
 *   DRY_RUN=1 npm run migrate:legacy-users
 */
import { randomBytes } from "node:crypto";

import { loadMonorepoRootEnv } from "../lib/database/loadRootEnv.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

loadMonorepoRootEnv();

type LegacyUserRow = {
  user_id: string;
  username: string;
  email: string;
  tier_id: number;
  user_role: string;
  preferred_theme: string;
};

function randomPassword(): string {
  return randomBytes(32).toString("base64url");
}

const dryRun = (process.env.DRY_RUN ?? "").trim() === "1";

async function main(): Promise<void> {
  const admin = getSupabaseAdmin();

  const { data: legacyRows, error: legacyErr } = await admin
    .from("msgf_legacy_users")
    .select("user_id, username, email, tier_id, user_role, preferred_theme");

  if (legacyErr) {
    throw new Error(`Failed to read msgf_legacy_users: ${legacyErr.message}`);
  }

  const rows = (legacyRows ?? []) as LegacyUserRow[];
  console.log(`[migrate-legacy-users] Found ${rows.length} legacy user(s). dryRun=${dryRun}`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const legacyId = String(row.user_id).trim();
    const email = String(row.email).trim().toLowerCase();

    const { data: existingProfile } = await admin
      .from("p4_profiles")
      .select("user_id")
      .eq("legacy_user_id", legacyId)
      .maybeSingle();

    if (existingProfile?.user_id) {
      console.log(`[skip] legacy_user_id=${legacyId} already mapped to auth user ${existingProfile.user_id}`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] would migrate ${email} legacy_user_id=${legacyId}`);
      continue;
    }

    const password = randomPassword();
    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        legacy_user_id: legacyId,
        username: row.username,
        user_role: row.user_role,
        preferred_theme: row.preferred_theme,
        terms_role: row.user_role,
      },
      app_metadata: {
        tier_id: row.tier_id,
      },
    });

    if (createErr || !createdUser.user?.id) {
      const msg = createErr?.message ?? "unknown error";
      if (msg.toLowerCase().includes("already been registered") || msg.toLowerCase().includes("already registered")) {
        console.warn(`[warn] ${email}: ${msg} — resolve manually or link existing auth user to p4_profiles.`);
        skipped += 1;
        continue;
      }
      console.error(`[fail] legacy_user_id=${legacyId} email=${email}: ${msg}`);
      failed += 1;
      continue;
    }

    const authUserId = createdUser.user.id;

    const { error: profileErr } = await admin.from("p4_profiles").insert({
      user_id: authUserId,
      legacy_user_id: legacyId,
      username: row.username,
      tier_id: row.tier_id,
      user_role: row.user_role,
      preferred_theme: row.preferred_theme,
    });

    if (profileErr) {
      console.error(`[fail] p4_profiles insert legacy_user_id=${legacyId}: ${profileErr.message}`);
      failed += 1;
      try {
        await admin.auth.admin.deleteUser(authUserId);
      } catch {
        // best-effort rollback
      }
      continue;
    }

    console.log(`[ok] ${email} legacy_user_id=${legacyId} → auth.users.id=${authUserId}`);
    created += 1;
  }

  console.log(
    `[migrate-legacy-users] done. created=${created} skipped=${skipped} failed=${failed} dryRun=${dryRun}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
