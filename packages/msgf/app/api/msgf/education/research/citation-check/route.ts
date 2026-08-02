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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * POST/PUT /api/msgf/education/research/citation-check
 *
 * Citation Hall Engine — pillars §2.6.1.
 *
 * Body: {@link CitationCheckRequestSchema}
 *   - `pastedText`: text the student just pasted into the host doc
 *   - `recentSnippets`: snippets the embedded research portal saw the student lift
 *
 * Routes the paste to Vault (`3.1.1_ANCHORED_SOURCE_STRING`) or Hall
 * (`3.1.2_UNATTRIBUTED_SOURCE_STRING` / `3.1.3_UNTRUSTED_DOMAIN`) via the existing
 * `persistToVault` / `persistToHall` constraint-ledger writers.
 */
import { randomUUID } from "crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { evaluateCitationGap } from "@/lib/education/research-portal";
import { trustedDomainsFromEnv } from "@/lib/education/trusted-domains";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyPulseCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json(req, { error: "Unauthorized", trace_id: traceId }, { status: 401 });
    }

    const headerTenant =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
    const userMetadata = user.user_metadata as Record<string, unknown> | undefined;
    const tenantId = resolveTenantIdForPillars(
      headerTenant || String(userMetadata?.tenant_id ?? "syntax_education"),
      userMetadata
    );
    const entityId = req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() || user.id;

    const rawBody = await req.json();
    const result = await evaluateCitationGap({
      supabase,
      tenantId,
      entityId,
      request: rawBody,
      trustedDomains: trustedDomainsFromEnv(),
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      pillar: "P6",
      subsystems: ["P4"],
      tenant_id: tenantId,
      entity_id: entityId,
      classification: result.classification,
      matched_snippet_id: result.matchedSnippetId ?? null,
      match_score: result.matchScore ?? null,
      source_url: result.sourceUrl ?? null,
      source_domain: result.sourceDomain ?? null,
      trusted_domain: result.trustedDomain,
      bug_index: result.bugIndex,
      narrative_log_id: result.persisted?.narrativeLogId ?? null,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return json(
        req,
        { error: "Invalid request body", details: e.flatten(), trace_id: traceId },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/msgf/education/research/citation-check]", e);
    return json(req, { error: message, trace_id: traceId }, { status: 500 });
  }
}

/**
 * Service-role variant for add-on BFFs that cannot use cookie auth.
 * Requires `x-msgf-entity-id` (the de-identified entity token from the LTI privacy gate).
 */
export async function PUT(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const entityId = req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim();
    if (!entityId) {
      return json(
        req,
        { error: "x-msgf-entity-id is required.", trace_id: traceId },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const headerTenant =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
      "syntax_education";
    const tenantId = resolveTenantIdForPillars(headerTenant, null);

    const rawBody = await req.json();
    const result = await evaluateCitationGap({
      supabase: adminSupabase,
      tenantId,
      entityId,
      request: rawBody,
      trustedDomains: trustedDomainsFromEnv(),
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      tenant_id: tenantId,
      entity_id: entityId,
      classification: result.classification,
      matched_snippet_id: result.matchedSnippetId ?? null,
      match_score: result.matchScore ?? null,
      source_url: result.sourceUrl ?? null,
      source_domain: result.sourceDomain ?? null,
      trusted_domain: result.trustedDomain,
      bug_index: result.bugIndex,
      narrative_log_id: result.persisted?.narrativeLogId ?? null,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return json(
        req,
        { error: "Invalid request body", details: e.flatten(), trace_id: traceId },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/msgf/education/research/citation-check PUT]", e);
    return json(req, { error: message, trace_id: traceId }, { status: 500 });
  }
}
