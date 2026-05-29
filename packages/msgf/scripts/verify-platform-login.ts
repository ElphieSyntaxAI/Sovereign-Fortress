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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * Diagnose why platform login / MSGF admin access fails for an account.
 *
 *   npm run verify:platform-login -w msgf -- --email=you@example.com --password='YourPass!'
 *   npm run verify:platform-login -w msgf -- --email=you@example.com   # role check only (service role)
 */

import { createClient } from "@supabase/supabase-js";

import { resolveSessionDashboardOperator } from "@/lib/msgf-admin-session";

function parseArgs(argv: string[]) {
  let email = "";
  let password = "";
  for (const arg of argv) {
    if (arg.startsWith("--email=")) email = arg.slice("--email=".length).trim();
    else if (arg.startsWith("--password=")) password = arg.slice("--password=".length);
    else if (arg === "--help" || arg === "-h") {
      console.log(`verify-platform-login
  --email=...       Required
  --password=...    Optional — tests password sign-in (anon key)
`);
      process.exit(0);
    }
  }
  return { email, password };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const { email, password } = parseArgs(process.argv.slice(2));
  if (!email) {
    console.error("Pass --email=...");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\n[verify:platform-login]\n");

  const cookieDomain = process.env.MSGF_AUTH_COOKIE_DOMAIN?.trim() || "(not set — host-only cookies)";
  const globalEmails = process.env.MSGF_GLOBAL_ADMIN_EMAILS?.trim() || "(not set)";
  console.log(`  MSGF_AUTH_COOKIE_DOMAIN: ${cookieDomain}`);
  console.log(`  MSGF_GLOBAL_ADMIN_EMAILS: ${globalEmails}`);
  console.log(
    "  Production: use .elphiesyntax.com on MSGF + Author deploys for cross-subdomain sessions.\n"
  );

  let userId = "";
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = listed.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!match?.id) {
    console.error(`✗ No Supabase user for ${email}`);
    console.error("  Run: npm run create:platform-admin -w msgf -- --email=... --password=...");
    process.exit(1);
  }
  userId = match.id;
  console.log(`✓ Auth user exists (${userId})`);
  console.log(`  email_confirmed_at: ${match.email_confirmed_at ?? "NOT CONFIRMED"}`);
  if (!match.email_confirmed_at) {
    console.warn("  → Confirm email in inbox, or run create:platform-admin (auto-confirms).");
  }

  if (password && anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      console.error(`✗ Password sign-in failed: ${error?.message ?? "no session"}`);
    } else {
      console.log("✓ Password sign-in works (anon client)");
    }
  } else if (password) {
    console.warn("  (skipped password test — missing anon/publishable key)");
  }

  const { data: profile, error: profErr } = await admin
    .from("p4_profiles")
    .select("msgf_access_role, user_role, tenant_id, username")
    .eq("user_id", userId)
    .maybeSingle();

  if (profErr) {
    console.warn(`  p4_profiles read: ${profErr.message}`);
  } else if (!profile) {
    console.warn("✗ No p4_profiles row — run create:platform-admin or sign in once on MSGF.");
  } else {
    console.log(`✓ p4_profiles: role=${profile.msgf_access_role} tenant=${profile.tenant_id}`);
  }

  const op = await resolveSessionDashboardOperator(admin, {
    id: userId,
    email,
    app_metadata: match.app_metadata ?? {},
    user_metadata: match.user_metadata ?? {},
    aud: "authenticated",
    created_at: match.created_at,
  } as import("@supabase/supabase-js").User);

  console.log(`  Resolved MSGF operator role: ${op.role}`);

  if (op.role === "GLOBAL_ADMIN" || op.role === "COMPANY_ADMIN") {
    console.log("\n✓ This account can access /admin/dashboard after signing in on:");
    console.log("  https://elphiesgatedai.elphiesyntax.com/admin/sign-in?next=/admin/portal");
    console.log("  Local: http://127.0.0.1:3001/admin/sign-in?next=/admin/portal\n");
  } else {
    console.error("\n✗ Not an MSGF operator — admin portal will show Unauthorized.");
    console.error("  Fix:");
    console.error(`    npm run create:platform-admin -w msgf -- --email=${email} --promote-existing`);
    console.error(`    Add to packages/msgf/.env.local: MSGF_GLOBAL_ADMIN_EMAILS=${email}\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
