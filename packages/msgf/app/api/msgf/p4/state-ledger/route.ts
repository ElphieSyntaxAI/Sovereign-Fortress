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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
/**
 * POST /api/msgf/p4/state-ledger
 *
 * P4 State Ledger ingress for Syntax Education "The Call" telemetry (and legacy keystrokes).
 * Redis hot active slice + Postgres `state_beats` verification — routing unchanged.
 */
import { randomUUID } from "crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import {
  MSGF_ENTITY_ID_HEADER,
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import { ingestP4StateLedgerTelemetry } from "@/lib/services/p4-state-ledger-controller";
import { ZodError } from "zod";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyPulseCorsHeaders(req, res);
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

    const entityId =
      req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim() || user.id;

    const rawBody = await req.json();
    const result = await ingestP4StateLedgerTelemetry({
      supabase,
      tenantId,
      entityId,
      rawBody,
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      pillar: "P4",
      tenant_id: tenantId,
      entity_id: entityId,
      domain: result.domain,
      event_count: result.eventCount,
      chunk_count: result.chunks.length,
      hot_layer_hit: result.hotLayerHit,
      verify_results: result.verifyResults,
      suggested_learning_breakdowns: result.suggestedBreakdowns,
      assignment_id: result.assignmentId ?? null,
      subject_domain: result.subjectDomain ?? null,
      ecosystem_source: result.ecosystemSource,
      telemetry_mode: result.telemetryMode,
      focus_beats_appended: result.focusBeatsAppended,
      cell_mutation_count: result.cellMutationCount,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return json(
        req,
        { error: "Invalid telemetry payload", details: e.flatten(), trace_id: traceId },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/msgf/p4/state-ledger]", e);
    return json(req, { error: message, trace_id: traceId }, { status: 500 });
  }
}

/**
 * Service-role ingest (BFF / sandbox) when `x-msgf-entity-id` + admin key present.
 */
export async function PUT(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const entityId = req.headers.get(MSGF_ENTITY_ID_HEADER)?.trim();
    if (!entityId) {
      return json(
        req,
        { error: "x-msgf-entity-id is required for service ingest.", trace_id: traceId },
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
    const result = await ingestP4StateLedgerTelemetry({
      supabase: adminSupabase,
      tenantId,
      entityId,
      rawBody,
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      pillar: "P4",
      tenant_id: tenantId,
      entity_id: entityId,
      domain: result.domain,
      event_count: result.eventCount,
      chunk_count: result.chunks.length,
      hot_layer_hit: result.hotLayerHit,
      verify_results: result.verifyResults,
      suggested_learning_breakdowns: result.suggestedBreakdowns,
      ecosystem_source: result.ecosystemSource,
      telemetry_mode: result.telemetryMode,
      focus_beats_appended: result.focusBeatsAppended,
      cell_mutation_count: result.cellMutationCount,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return json(
        req,
        { error: "Invalid telemetry payload", details: e.flatten(), trace_id: traceId },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/msgf/p4/state-ledger PUT]", e);
    return json(req, { error: message, trace_id: traceId }, { status: 500 });
  }
}
