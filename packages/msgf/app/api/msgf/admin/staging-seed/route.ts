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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { isStagingDeploy } from "@/lib/deploy-env";
import {
  assertSessionOperatorIsAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import {
  firstGlobalAdminEmail,
  getStagingSeedStatus,
  runStagingReadinessSeed,
  stripeTestReady,
} from "@/lib/staging-readiness-seed";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

function stagingGuard() {
  if (!isStagingDeploy()) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return null;
}

async function requireStagingAdmin() {
  const blocked = stagingGuard();
  if (blocked) return { blocked };
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      blocked: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const admin = createAdminClient();
  const op = await resolveSessionDashboardOperator(admin, user);
  assertSessionOperatorIsAdmin(op);
  if (op.role !== "GLOBAL_ADMIN") {
    return {
      blocked: NextResponse.json({ ok: false, error: "GLOBAL_ADMIN required" }, { status: 403 }),
    };
  }
  return { admin, user };
}

export async function GET() {
  try {
    const ctx = await requireStagingAdmin();
    if ("blocked" in ctx && ctx.blocked) return ctx.blocked;
    const status = await getStagingSeedStatus(ctx.admin!);
    return NextResponse.json({
      ok: true,
      deploy_env: "staging",
      stripe_test_ready: stripeTestReady(),
      ...status,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "staging-seed failed";
    const status = /Unauthorized|admin|GLOBAL_ADMIN/i.test(message) ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST() {
  try {
    const ctx = await requireStagingAdmin();
    if ("blocked" in ctx && ctx.blocked) return ctx.blocked;
    const result = await runStagingReadinessSeed(ctx.admin!, {
      operatorEmail:
        ctx.user?.email || firstGlobalAdminEmail(process.env.MSGF_GLOBAL_ADMIN_EMAILS),
    });
    return NextResponse.json({
      ok: true,
      operator_email: result.operator.email,
      operator_created: result.operator.created,
      buyer_email: result.buyer.email,
      buyer_created: result.buyer.created,
      solo_tenant: result.soloTenantId,
      author_tenant: result.authorTenantId,
      solo_license_minted: result.soloLicense.created,
      author_license_minted: result.authorLicense.created,
      solo_license_key: result.soloLicense.plaintextKey,
      author_license_key: result.authorLicense.plaintextKey,
      buyer_password: result.buyer.password,
      note: "Plaintext keys appear only when newly minted. Copy now; hashes only are stored.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "staging-seed failed";
    const status = /Unauthorized|admin|GLOBAL_ADMIN/i.test(message) ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
