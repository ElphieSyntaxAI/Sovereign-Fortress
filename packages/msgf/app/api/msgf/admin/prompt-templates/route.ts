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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * GET/POST /api/msgf/admin/prompt-templates
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  createPromptTemplateVersion,
  diffTemplateBodies,
  listPromptTemplates,
} from "@/lib/services/prompt-templates";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

async function resolveTenantId(
  req: NextRequest,
  admin: ReturnType<typeof createAdminClient>,
  requested?: string | null
): Promise<string> {
  if (requested?.trim()) return requested.trim();
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new MsgfAdminAuthError("Unauthorized", 401);
  const { data } = await admin
    .from("p4_profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (typeof data?.tenant_id === "string" && data.tenant_id.trim()) || user.id;
}

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);
    if (op.role === "DEVELOPER") {
      return adminJson(req, { ok: false, error: "Forbidden" }, { status: 403 });
    }
    const tenantId = await resolveTenantId(
      req,
      admin,
      req.nextUrl.searchParams.get("tenant_id")
    );
    const name = req.nextUrl.searchParams.get("name");
    const templates = await listPromptTemplates(admin, tenantId, name);

    let diff: ReturnType<typeof diffTemplateBodies> | null = null;
    if (name && templates.length >= 2) {
      const newer = templates[0];
      const older = templates[1];
      if (newer && older) {
        diff = diffTemplateBodies(older.template_body, newer.template_body);
      }
    }

    return adminJson(req, { ok: true, tenant_id: tenantId, templates, diff });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    return adminJson(
      req,
      { ok: false, error: e instanceof Error ? e.message : "list failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);
    if (op.role === "DEVELOPER") {
      return adminJson(req, { ok: false, error: "Forbidden" }, { status: 403 });
    }
    const body = (await req.json()) as {
      tenant_id?: string;
      name?: string;
      template_body?: string;
    };
    const tenantId = await resolveTenantId(req, admin, body.tenant_id);
    if (!body.name?.trim() || body.template_body == null) {
      return adminJson(req, { ok: false, error: "name and template_body required" }, { status: 400 });
    }
    const row = await createPromptTemplateVersion(admin, {
      tenant_id: tenantId,
      name: body.name,
      template_body: body.template_body,
    });
    return adminJson(req, { ok: true, template: row });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    return adminJson(
      req,
      { ok: false, error: e instanceof Error ? e.message : "create failed" },
      { status: 500 }
    );
  }
}
