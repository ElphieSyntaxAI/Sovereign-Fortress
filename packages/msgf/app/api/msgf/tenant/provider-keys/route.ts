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
 * Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
 */
/**
 * Tenant BYOK: persist Gemini / Anthropic API keys encrypted via CryptoService.
 *
 * - POST — body `{ "provider": "gemini" | "anthropic", "api_key": "<secret>" }` (plaintext only in transit).
 * - GET — `{ gemini_configured, anthropic_configured }` (no secrets).
 * - DELETE — query `?provider=gemini|anthropic` revokes stored credential.
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { MSGF_TENANT_ID_HEADER } from "@/lib/msgf-http-headers";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import {
  deleteTenantProviderCredential,
  listTenantProviderCredentialPresence,
  parseTenantProvider,
  upsertTenantProviderCredential,
} from "@/lib/services/tenant-provider-credentials";

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const headerTenant = req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() || "";
    const tenantId = resolveTenantIdForPillars(
      headerTenant,
      user.user_metadata as Record<string, unknown>
    );

    const admin = createAdminClient();
    const presence = await listTenantProviderCredentialPresence({ admin, tenantId });

    return json({
      tenant_id: tenantId,
      gemini_configured: presence.gemini,
      anthropic_configured: presence.anthropic,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    console.error("[provider-keys GET]", e);
    return json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }

    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const provider = parseTenantProvider(o.provider);
    const apiKey = typeof o.api_key === "string" ? o.api_key : "";

    if (!provider) {
      return json({ error: 'provider must be "gemini" or "anthropic".' }, { status: 400 });
    }
    if (!apiKey.trim()) {
      return json({ error: "api_key is required." }, { status: 400 });
    }

    const headerTenant = req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() || "";
    const tenantId = resolveTenantIdForPillars(
      headerTenant,
      user.user_metadata as Record<string, unknown>
    );

    const admin = createAdminClient();
    await upsertTenantProviderCredential({
      admin,
      tenantId,
      provider,
      plainApiKey: apiKey,
    });

    return json({ ok: true, tenant_id: tenantId, provider });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    console.error("[provider-keys POST]", e);
    return json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = parseTenantProvider(req.nextUrl.searchParams.get("provider"));
    if (!provider) {
      return json({ error: 'Query provider must be "gemini" or "anthropic".' }, { status: 400 });
    }

    const headerTenant = req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() || "";
    const tenantId = resolveTenantIdForPillars(
      headerTenant,
      user.user_metadata as Record<string, unknown>
    );

    const admin = createAdminClient();
    await deleteTenantProviderCredential({ admin, tenantId, provider });

    return json({ ok: true, tenant_id: tenantId, provider });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    console.error("[provider-keys DELETE]", e);
    return json({ error: msg }, { status: 500 });
  }
}
