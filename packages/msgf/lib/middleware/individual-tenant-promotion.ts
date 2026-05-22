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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/**
 * Independent developer auto-promotion — personal sandbox tenant + company_admin
 * strictly within the caller's own silo (no cross-corporate visibility).
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import {
  MSGF_ACCESS_ROLE_HEADER,
  MSGF_FALLBACK_ROLE_HEADER,
  MSGF_IDE_PULSE_HEADER,
  MSGF_OPERATOR_USER_ID_HEADER,
  MSGF_ORGANIZATION_ID_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import {
  MSGF_AUTO_PROMOTED_HEADER,
  MSGF_PERSONAL_SANDBOX_HEADER,
} from "@/lib/msgf-http-headers";
import { fetchProfileCompanyAndRole } from "@/lib/msgf-operator-access";
import { extractBearerTokenFromRequest } from "@/lib/services/pulse-license";
import {
  allocatePersonalSandboxTenantId,
  isIndependentDeveloper,
  isPersonalSandboxTenant,
} from "@/lib/msgf-tenant-governance";

export type ParsedTenantAuth = {
  tenantKey: string | null;
  bearerToken: string | null;
};

export function parseTenantKeyAndAuth(request: NextRequest): ParsedTenantAuth {
  return {
    tenantKey:
      request.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      request.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
      null,
    bearerToken: extractBearerTokenFromRequest(request),
  };
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "individual-tenant-promotion: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveAuthUserId(request: NextRequest): Promise<string | null> {
  const bearer = extractBearerTokenFromRequest(request);
  if (bearer && !bearer.startsWith("msgf_live_")) {
    try {
      const admin = supabaseAdmin();
      const { data, error } = await admin.auth.getUser(bearer);
      if (!error && data.user?.id) return data.user.id;
    } catch {
      /* fall through to cookie session */
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* read-only */
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  }

  return null;
}

function denyCrossScope(message: string): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code: "ERR_TENANT_SCOPE_VIOLATION",
    },
    { status: 403 }
  );
}

/**
 * Validates tenant + auth, promotes independent developers to company_admin on their personal silo.
 * Returns a forwarded request with trusted headers, or 403 when scope is violated.
 */
export async function applyIndividualTenantPromotion(
  request: NextRequest
): Promise<{ request: NextRequest; response: NextResponse | null }> {
  const { tenantKey, bearerToken } = parseTenantKeyAndAuth(request);

  if (!tenantKey && !bearerToken) {
    return { request, response: null };
  }

  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return { request, response: null };
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    console.warn("[individual-tenant-promotion] admin client unavailable:", e);
    return { request, response: null };
  }

  const profile = await fetchProfileCompanyAndRole(admin, userId);
  const independent = isIndependentDeveloper({
    company_id: profile.company_id,
    tenantKey,
  });

  if (!independent) {
    if (tenantKey && isPersonalSandboxTenant(tenantKey)) {
      const canonical = allocatePersonalSandboxTenantId(userId);
      if (tenantKey !== canonical && !tenantKey.endsWith(userId)) {
        return {
          request,
          response: denyCrossScope(
            "Corporate accounts cannot access individual sandbox tenant keys."
          ),
        };
      }
    }
    return { request, response: null };
  }

  const scopedTenant = allocatePersonalSandboxTenantId(userId);

  if (
    tenantKey &&
    isPersonalSandboxTenant(tenantKey) &&
    tenantKey !== scopedTenant &&
    !tenantKey.endsWith(userId)
  ) {
    return {
      request,
      response: denyCrossScope(
        "Personal sandbox tenant key does not match your developer identity."
      ),
    };
  }

  const headers = new Headers(request.headers);
  headers.delete(MSGF_FALLBACK_ROLE_HEADER);
  headers.delete(MSGF_ACCESS_ROLE_HEADER);
  headers.delete(MSGF_ORGANIZATION_ID_HEADER);

  headers.set(MSGF_TENANT_KEY_HEADER, scopedTenant);
  headers.set(MSGF_TENANT_ID_HEADER, scopedTenant);
  headers.set(MSGF_ACCESS_ROLE_HEADER, "company_admin");
  headers.set(MSGF_PERSONAL_SANDBOX_HEADER, "1");
  headers.set(MSGF_AUTO_PROMOTED_HEADER, "1");
  headers.set(MSGF_OPERATOR_USER_ID_HEADER, userId);

  if (request.headers.get(MSGF_IDE_PULSE_HEADER)?.trim() === "1") {
    headers.set(MSGF_IDE_PULSE_HEADER, "1");
  }

  const forwarded = new NextRequest(request, { headers });
  return { request: forwarded, response: null };
}
