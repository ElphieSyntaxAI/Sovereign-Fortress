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
 * Bootstrap a Supabase user with GLOBAL_ADMIN access for local platform testing.
 *
 *   npm run create:platform-admin -w msgf
 *   npm run create:platform-admin -w msgf -- --email=you@example.com --password='TestPass123!'
 *
 * Grants:
 * - `p4_profiles.msgf_access_role` = GLOBAL_ADMIN
 * - Supabase app/user metadata for admin session resolution
 * - Gated AI + Author entitlements (shared Supabase login across products)
 * - Author MSGF tenant brain baseline (`author_ecosystem`)
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { bootstrapTenantBrain } from "@/lib/services/brain-readiness";
import { syncPlatformEntitlement } from "@/lib/msgf-onboarding";
import { resolveOperationalTenantId } from "@/lib/platform-persona-auth";

function parseArgs(argv: string[]) {
  let email = "";
  let password = `PlatformAdmin!${crypto.randomBytes(4).toString("hex")}`;
  let promoteOnly = false;

  for (const arg of argv) {
    if (arg.startsWith("--email=")) email = arg.slice("--email=".length).trim();
    else if (arg.startsWith("--password=")) password = arg.slice("--password=".length);
    else if (arg === "--promote-existing") promoteOnly = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`create-platform-admin-test-user
  --email=...            Default: platform-admin+<timestamp>@elphiesyntax.test
  --password=...         Default: random PlatformAdmin!<hex>
  --promote-existing     Do not create user; only promote if email already exists
`);
      process.exit(0);
    }
  }

  if (!email) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    email = `platform-admin+${stamp}@elphiesyntax.test`;
  }

  return { email, password, promoteOnly };
}

async function findUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string
): Promise<{ id: string; email: string | undefined } | null> {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match?.id) return { id: match.id, email: match.email };
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    console.error(
      "[create:platform-admin] Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (packages/msgf/.env.local)."
    );
    process.exit(1);
  }

  const { email, password, promoteOnly } = parseArgs(process.argv.slice(2));
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = "";
  let created = false;

  const existing = await findUserByEmail(admin, email);
  if (existing?.id) {
    userId = existing.id;
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password });
    if (pwErr) {
      console.warn(`[create:platform-admin] password update skipped: ${pwErr.message}`);
    }
  } else if (promoteOnly) {
    console.error(`[create:platform-admin] No user for ${email}. Omit --promote-existing to create one.`);
    process.exit(1);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        msgf_access_role: "GLOBAL_ADMIN",
        role: "GLOBAL_ADMIN",
      },
      user_metadata: {
        msgf_access_role: "GLOBAL_ADMIN",
        persona: "global_admin",
        platform: "gatedai",
      },
    });
    if (error || !data.user?.id) {
      console.error("[create:platform-admin] createUser failed:", error?.message ?? "no user id");
      process.exit(1);
    }
    userId = data.user.id;
    created = true;
  }

  const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      msgf_access_role: "GLOBAL_ADMIN",
      role: "GLOBAL_ADMIN",
    },
    user_metadata: {
      msgf_access_role: "GLOBAL_ADMIN",
      persona: "global_admin",
      platform: "gatedai",
    },
  });
  if (metaErr) {
    console.error("[create:platform-admin] metadata update failed:", metaErr.message);
    process.exit(1);
  }

  const username = email.split("@")[0] || "platform-admin";

  const gated = await syncPlatformEntitlement({
    supabase: admin,
    entityId: userId,
    platform: "gatedai",
    persona: "developer",
    username,
  });

  const author = await syncPlatformEntitlement({
    supabase: admin,
    entityId: userId,
    platform: "author",
    persona: "author",
    username,
  });

  const authorTenant = resolveOperationalTenantId("author");
  await bootstrapTenantBrain(admin, authorTenant, userId);

  const { error: roleErr } = await admin
    .from("p4_profiles")
    .update({
      msgf_access_role: "GLOBAL_ADMIN",
      company_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (roleErr) {
    console.error("[create:platform-admin] p4_profiles role update failed:", roleErr.message);
    process.exit(1);
  }

  const msgfPort = process.env.PORT?.trim() || "3001";
  const msgfBase = process.env.MSGF_LOCAL_DEV_URL?.trim() || `http://127.0.0.1:${msgfPort}`;
  const authorBff = process.env.AUTHOR_BFF_URL?.trim() || "http://127.0.0.1:3002";
  const authorClient = process.env.AUTHOR_CLIENT_URL?.trim() || "http://127.0.0.1:5173";

  console.log("\n[platform-admin] Ready — same Supabase account across MSGF + Author\n");
  console.log(`  Email:       ${email}`);
  console.log(`  Password:    ${password}`);
  console.log(`  User id:     ${userId}`);
  console.log(`  Created:     ${created ? "yes (new auth user)" : "no (promoted existing)"}`);
  console.log(`  Gated tenant: ${gated.tenantId} · role ${gated.userRole}`);
  console.log(`  Author tenant: ${author.tenantId} · role ${author.userRole}`);
  console.log("\nAdd to packages/msgf/.env.local (belt-and-suspenders for admin sign-in):");
  console.log(`  MSGF_GLOBAL_ADMIN_EMAILS=${email}`);
  console.log("\nSign in (use this email + password everywhere):");
  console.log(`  MSGF admin portal:  ${msgfBase}/admin/sign-in?next=/admin/portal`);
  console.log(`  MSGF ops dashboard: ${msgfBase}/admin/dashboard`);
  console.log(`  Author token savings (tenant ${authorTenant}):`);
  console.log(`    ${msgfBase}/admin/dashboard#token-savings?tenant_id=${authorTenant}`);
  console.log(`  Author client:      ${authorClient}  (Gated AI tab → MSGF; Author tab → dashboard)`);
  console.log(`  Author BFF:         ${authorBff}`);
  console.log("\nGLOBAL_ADMIN sees all MSGF tenants on the ops dashboard, including Author pulse traffic");
  console.log("under tenant_id=author_ecosystem. Per-author UUIDs appear in pulse rows / heal queue filters.");
  console.log("\nOptional: npm run bootstrap:author-msgf -w msgf  (pulse license for BFF stress tests)\n");
}

main().catch((err) => {
  console.error("[create:platform-admin] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
