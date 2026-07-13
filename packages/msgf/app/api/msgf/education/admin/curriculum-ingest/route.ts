/**
 * POST /api/msgf/education/admin/curriculum-ingest
 * Scan + optional commit wrapper for district curriculum PDFs/text.
 */
import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import {
  buildDocumentCompilerStructuralSignals,
  runMultiPassDocumentCompiler,
} from "@/lib/services/document-compiler";
import {
  createDocumentCompilerSession,
  updateDocumentCompilerSession,
} from "@/lib/services/document-compiler/session-store";
import { createAdminClient } from "@/utils/supabase/admin";

const BodySchema = z.object({
  text: z.string().min(1).max(512_000),
  tenant_id: z.string().min(1),
  source_document: z.string().max(512).optional(),
  subject_domain: z.enum(["ela", "history", "math", "science", "general"]).optional(),
  commit: z.boolean().optional(),
  session_id: z.string().uuid().optional(),
});

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyPulseCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const body = BodySchema.parse(await req.json());
    const admin = createAdminClient();

    if (body.commit && body.session_id) {
      const commitUrl = new URL("/api/msgf/document-compiler/commit", req.url);
      const commitRes = await fetch(commitUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-msgf-tenant-id": body.tenant_id,
        },
        body: JSON.stringify({ session_id: body.session_id }),
      });
      const commitJson = await commitRes.json();
      return json(req, { trace_id: traceId, ...commitJson }, { status: commitRes.status });
    }

    const session = await createDocumentCompilerSession(admin, {
      tenantId: body.tenant_id,
      domainProfile: "education_curriculum",
      subjectDomain: body.subject_domain,
      filename: body.source_document ?? "curriculum-upload",
      sourceText: body.text,
    });
    if ("error" in session) {
      return json(req, { ok: false, error: session.error, trace_id: traceId }, { status: 500 });
    }

    const signals = buildDocumentCompilerStructuralSignals(body.text);
    const result = await runMultiPassDocumentCompiler({
      text: body.text,
      domain_profile: "education_curriculum",
      manuscriptId: session.id,
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
      },
      commit_hint: "POST with { session_id, commit: true } to persist enriched shards.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(req, { ok: false, error: message, trace_id: traceId }, { status: 400 });
  }
}
