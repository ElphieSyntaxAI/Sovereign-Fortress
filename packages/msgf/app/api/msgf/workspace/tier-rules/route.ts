/**
 * @msgf-license-header
 * GET/POST/PATCH/DELETE /api/msgf/workspace/tier-rules — COMPANY_ADMIN CRUD (Part B2)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteCompanyTierRule,
  insertCompanyTierRule,
  listCompanyTierRules,
  patchCompanyTierRule,
} from "@/lib/services/converge-tier/company-tier-overrides";
import { CONVERGE_TIERS } from "@/lib/services/converge-tier/types";
import {
  assertCanManageTeam,
  requireWorkspaceTeamSession,
} from "@/lib/workspace-team-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  if (!session.companyId) {
    return NextResponse.json({ ok: false, error: "No company on profile." }, { status: 403 });
  }
  try {
    assertCanManageTeam(session);
  } catch {
    return NextResponse.json({ ok: false, error: "Company admin required." }, { status: 403 });
  }

  const admin = createAdminClient();
  const rules = await listCompanyTierRules(admin, session.companyId);
  return NextResponse.json({ ok: true, company_id: session.companyId, rules });
}

const postSchema = z
  .object({
    path_glob: z.string().min(1).max(512),
    force_tier: z.enum(CONVERGE_TIERS),
  })
  .strict();

export async function POST(req: NextRequest) {
  const session = await requireWorkspaceTeamSession();
  if (!session?.companyId) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    assertCanManageTeam(session);
  } catch {
    return NextResponse.json({ ok: false, error: "Company admin required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const rule = await insertCompanyTierRule(admin, {
      companyId: session.companyId,
      pathGlob: parsed.data.path_glob,
      forceTier: parsed.data.force_tier,
    });
    return NextResponse.json({ ok: true, rule });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Insert failed." },
      { status: 422 }
    );
  }
}

const patchSchema = z
  .object({
    id: z.string().uuid(),
    enabled: z.boolean().optional(),
    force_tier: z.enum(CONVERGE_TIERS).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest) {
  const session = await requireWorkspaceTeamSession();
  if (!session?.companyId) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    assertCanManageTeam(session);
  } catch {
    return NextResponse.json({ ok: false, error: "Company admin required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const rule = await patchCompanyTierRule(admin, {
      id: parsed.data.id,
      companyId: session.companyId,
      enabled: parsed.data.enabled,
      forceTier: parsed.data.force_tier,
    });
    return NextResponse.json({ ok: true, rule });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Update failed." },
      { status: 422 }
    );
  }
}

const deleteSchema = z.object({ id: z.string().uuid() }).strict();

export async function DELETE(req: NextRequest) {
  const session = await requireWorkspaceTeamSession();
  if (!session?.companyId) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    assertCanManageTeam(session);
  } catch {
    return NextResponse.json({ ok: false, error: "Company admin required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    await deleteCompanyTierRule(admin, { id: parsed.data.id, companyId: session.companyId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Delete failed." },
      { status: 422 }
    );
  }
}
