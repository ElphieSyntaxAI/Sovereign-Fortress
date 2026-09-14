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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * POST /api/msgf/document-compiler/commit
 * DEFEND-guarded commit for document compiler sessions.
 */
import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ingestCurriculumDocumentWithCompiler } from "@/lib/education/education-curriculum-ingest";
import { subjectDomainToLevel1Category } from "@/lib/education/curriculum-metadata";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import { MSGF_TENANT_ID_HEADER, MSGF_TENANT_KEY_HEADER } from "@/lib/msgf-http-headers";
import { buildGenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import {
  buildCommitPreviewText,
  runDocumentCompilerDefend,
} from "@/lib/services/document-compiler/defend-guard";
import {
  loadDocumentCompilerSession,
  updateDocumentCompilerSession,
} from "@/lib/services/document-compiler/session-store";
import type { CompilerBeatArtifact, CompilerWikiArtifact } from "@/lib/services/document-compiler";
import { createAdminClient } from "@/utils/supabase/admin";

const CommitBodySchema = z.object({
  session_id: z.string().uuid(),
  proposed: z.array(z.record(z.unknown())).optional(),
  outline_beats: z.array(z.record(z.unknown())).optional(),
  force_commit: z.boolean().optional(),
});

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyPulseCorsHeaders(req, NextResponse.json(data, init));
}

function resolveTenant(req: NextRequest, sessionTenant: string): string {
  const header =
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
  return resolveTenantIdForPillars(header || sessionTenant, undefined);
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const body = CommitBodySchema.parse(await req.json());
    const admin = createAdminClient();
    const session = await loadDocumentCompilerSession(admin, body.session_id);
    if (!session) {
      return json(req, { ok: false, error: "Session not found.", trace_id: traceId }, { status: 404 });
    }

    const tenantId = resolveTenant(req, session.tenant_id);
    const proposed = (body.proposed ?? session.proposed_wiki) as CompilerWikiArtifact[];
    const outlineBeats = (body.outline_beats ?? session.outline_beats) as CompilerBeatArtifact[];
    const sourceText = session.source_text ?? "";

    const previewText = buildCommitPreviewText({
      domain_profile: session.domain_profile,
      filename: session.original_filename,
      sourceText,
      proposed,
      outlineBeats,
    });

    const defend = await runDocumentCompilerDefend({
      supabase: admin,
      tenantId,
      sourceText,
      previewText,
      proposed,
      outlineBeats,
      forceCommit: body.force_commit,
    });

    if (defend.blocked) {
      return json(
        req,
        {
          ok: false,
          blocked: true,
          reason: defend.block_reason,
          defend,
          trace_id: traceId,
        },
        { status: 422 }
      );
    }

    let persist: Record<string, unknown> = { mode: "defend_only" };

    if (session.domain_profile === "education_curriculum" && session.compiler_state) {
      const subject =
        (session.subject_domain as "ela" | "history" | "math" | "science" | "general") ?? "general";
      const level1 =
        subjectDomainToLevel1Category(subject) ?? "1.0_ELA";
      const bugIndex = buildGenealogicalBugIndex({
        level_1_category: level1,
        level_1_1_branch: "1.1_CURRICULUM",
        level_1_1_1_instance: "1.1.1_DOCUMENT_COMPILER",
      });
      const ingest = await ingestCurriculumDocumentWithCompiler({
        supabase: admin,
        tenantId,
        sourceDocument: session.original_filename,
        fullText: sourceText,
        bugIndex,
        subjectDomain: subject,
        compilerState: session.compiler_state,
      });
      persist = { mode: "education_curriculum", ...ingest };
    } else if (session.domain_profile === "author_narrative") {
      persist = {
        mode: "author_narrative",
        delegated: true,
        message: "Author BFF persists to p4_narrative_library_chunks after local review.",
      };
    }

    await updateDocumentCompilerSession(admin, session.id, {
      proposed_wiki: proposed,
      outline_beats: outlineBeats,
      status: "committed",
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      session_id: session.id,
      defend,
      persist,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(req, { ok: false, error: message, trace_id: traceId }, { status: 400 });
  }
}
