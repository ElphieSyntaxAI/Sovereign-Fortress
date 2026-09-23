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
/**
 * POST /api/msgf/document-compiler/scan
 * Run 3-pass document compiler and persist session state.
 */
import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import { MSGF_TENANT_ID_HEADER, MSGF_TENANT_KEY_HEADER } from "@/lib/msgf-http-headers";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import {
  createDocumentCompilerSession,
  updateDocumentCompilerSession,
} from "@/lib/services/document-compiler/session-store";
import {
  buildDocumentCompilerStructuralSignals,
  runMultiPassDocumentCompiler,
} from "@/lib/services/document-compiler";
import { createAdminClient } from "@/utils/supabase/admin";

const ScanBodySchema = z.object({
  text: z.string().min(1).max(512_000),
  domain_profile: z
    .enum(["author_narrative", "education_curriculum", "generic"])
    .default("generic"),
  tenant_id: z.string().optional(),
  project_origin: z.string().max(128).optional(),
  slot: z.enum(["world_bible", "current_draft", "character_sheet"]).optional(),
  manuscript_id: z.string().uuid().optional(),
  subject_domain: z.enum(["ela", "history", "math", "science", "general"]).optional(),
  filename: z.string().max(256).optional(),
});

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyPulseCorsHeaders(req, NextResponse.json(data, init));
}

function resolveTenant(req: NextRequest, bodyTenant?: string): string {
  const header =
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    req.headers.get(MSGF_TENANT_ID_HEADER)?.trim() ||
    bodyTenant?.trim();
  return resolveTenantIdForPillars(header || "default", undefined);
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const body = ScanBodySchema.parse(await req.json());
    const tenantId = resolveTenant(req, body.tenant_id);
    const admin = createAdminClient();

    const session = await createDocumentCompilerSession(admin, {
      tenantId,
      domainProfile: body.domain_profile,
      projectOrigin: body.project_origin,
      manuscriptId: body.manuscript_id,
      subjectDomain: body.subject_domain,
      filename: body.filename,
      sourceText: body.text,
    });
    if ("error" in session) {
      return json(req, { ok: false, error: session.error, trace_id: traceId }, { status: 500 });
    }

    const signals = buildDocumentCompilerStructuralSignals(body.text);
    const result = await runMultiPassDocumentCompiler({
      text: body.text,
      domain_profile: body.domain_profile,
      manuscriptId: body.manuscript_id ?? session.id,
      slot: body.slot,
      subject_domain: body.subject_domain,
      signals,
    });

    await updateDocumentCompilerSession(admin, session.id, {
      compiler_state: result.state,
      proposed_wiki: result.proposed,
      outline_beats: result.outline_beats,
      status: "review",
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      session_id: session.id,
      compiler_state: result.state,
      artifacts: {
        proposed: result.proposed,
        outline_beats: result.outline_beats,
        semantic_regions: result.semantic_regions,
      },
      msgf_meta: {
        signals_summary: signals.summary,
        window_errors: result.window_errors,
        passes_completed: result.state.passes_completed,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(req, { ok: false, error: message, trace_id: traceId }, { status: 400 });
  }
}
