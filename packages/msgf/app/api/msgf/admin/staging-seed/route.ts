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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { isStagingDeploy } from "@/lib/deploy-env";
import {
  assertSessionOperatorIsAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import {
  STAGING_PLAN_PASSWORD,
  STAGING_PLAN_PERSONAS,
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
      plan_password: STAGING_PLAN_PASSWORD,
      plan_personas: {
        pro: STAGING_PLAN_PERSONAS.pro.email,
        startup_admin: STAGING_PLAN_PERSONAS.startupAdmin.email,
        startup_dev: STAGING_PLAN_PERSONAS.startupDev.email,
        startup_auditor: STAGING_PLAN_PERSONAS.startupAuditor.email,
        startup_security: STAGING_PLAN_PERSONAS.startupSecurity.email,
        enterprise_ciso: STAGING_PLAN_PERSONAS.enterprise.email,
      },
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
      plan_password: result.planPassword,
      pro_user_email: result.proUser.email,
      startup_company_id: result.startupCompanyId,
      startup_emails: result.startupMembers.map((m) => m.email),
      enterprise_company_id: result.enterpriseCompanyId,
      enterprise_ciso_email: result.enterpriseCiso.email,
      note: "Plaintext keys appear only when newly minted. Plan personas always use StagingReady!2026.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "staging-seed failed";
    const status = /Unauthorized|admin|GLOBAL_ADMIN/i.test(message) ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
