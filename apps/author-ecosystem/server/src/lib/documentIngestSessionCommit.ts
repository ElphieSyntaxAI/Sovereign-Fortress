import type { SupabaseClient } from "@supabase/supabase-js";

import { commitDocumentIngestToBackend } from "./commitDocumentIngest.js";
import {
  buildCommitPreviewText,
  detectStructureMergeRisk,
  recordIngestHallRejection,
  runDocumentIngestShadowPreflight,
  runDualStructureReview,
  sessionHadBlockingClarification,
  sessionHadBlockingConflicts,
} from "./documentIngestMsgfGuard.js";
import type { DocumentIngestSlot, IngestOutlineBeat, ProposedWikiEntry } from "./documentIngestGate.js";
import { normalizeProposedWikiEntry } from "./documentIngestOutline.js";
import type { ClarifyingQuestion, IngestConflict } from "./documentIngestStructure.js";

export type IngestSessionRow = {
  id: string;
  tenant_id: string;
  manuscript_id: string;
  slot: string;
  status: string;
  original_filename?: string | null;
  source_text?: string | null;
  proposed_wiki?: unknown;
  outline_beats?: unknown;
  clarifying_questions?: unknown;
  clarification_answers?: unknown;
  ingest_conflicts?: unknown;
  story_fingerprint?: unknown;
};

export type ExecuteIngestCommitResult =
  | {
      ok: true;
      committed: true;
      wiki_entry_count: number;
      planning: Awaited<ReturnType<typeof commitDocumentIngestToBackend>>["planning"];
      message: string;
      merge_risk?: ReturnType<typeof detectStructureMergeRisk>;
    }
  | {
      ok: false;
      committed: false;
      httpStatus: number;
      error: string;
      code?: string;
      hint?: string;
    };

export function isAutoWikiBuildEnabled(): boolean {
  const v = process.env.DOCUMENT_INGEST_AUTO_WIKI?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return false;
}

export async function executeDocumentIngestSessionCommit(
  supabase: SupabaseClient,
  params: {
    session: IngestSessionRow;
    tenantId: string;
    proposed?: ProposedWikiEntry[];
    outlineBeats?: IngestOutlineBeat[];
    forceCommit?: boolean;
    autoCommit?: boolean;
    syncMsgfBrain?: boolean;
  }
): Promise<ExecuteIngestCommitResult> {
  const session = params.session;
  const sessionId = session.id;
  const slot = session.slot as DocumentIngestSlot;

  if (session.status !== "review") {
    return {
      ok: false,
      committed: false,
      httpStatus: 400,
      error: "Session is not ready for submit (complete clarification/authorship first).",
    };
  }

  const clarificationAnswers = Array.isArray(session.clarification_answers)
    ? (session.clarification_answers as Array<{ answer?: string }>)
    : [];
  const archiveOnly = clarificationAnswers.some((a) =>
    /old archive|do not overwrite|wiki only/i.test(String(a.answer ?? ""))
  );

  const proposedRaw = (params.proposed ??
    (Array.isArray(session.proposed_wiki) ? session.proposed_wiki : [])) as ProposedWikiEntry[];
  const proposed = proposedRaw.filter(
    (p) => p && typeof p === "object" && String(p.excerpt ?? "").trim().length >= 1
  );
  const outlineBeats = (
    params.outlineBeats ??
    (Array.isArray(session.outline_beats) ? session.outline_beats : [])
  ) as IngestOutlineBeat[];
  const sourceText = String(session.source_text ?? "");

  const normalizedProposed = proposed.map((p) =>
    normalizeProposedWikiEntry(p, String(session.manuscript_id), slot)
  );
  const previewText = buildCommitPreviewText({
    slot,
    filename: String(session.original_filename ?? "upload"),
    sourceText,
    proposed: normalizedProposed,
    outlineBeats: archiveOnly ? [] : outlineBeats,
  });

  const mergeRisk = detectStructureMergeRisk(
    sourceText,
    normalizedProposed,
    archiveOnly ? [] : outlineBeats
  );
  const needsDualReview =
    mergeRisk.risk ||
    sessionHadBlockingClarification(
      session.clarifying_questions as ClarifyingQuestion[],
      clarificationAnswers
    ) ||
    sessionHadBlockingConflicts(session.ingest_conflicts as IngestConflict[]);

  const forceCommit = params.forceCommit === true || params.autoCommit === true;

  if (needsDualReview && !forceCommit) {
    const dualReview = await runDualStructureReview({ sourceText, preview: previewText });
    const failDual = dualReview.ran && dualReview.structure_valid === false;
    if (failDual) {
      const reason = dualReview.reason;
      await recordIngestHallRejection({
        supabase,
        tenantId: params.tenantId,
        entityId: params.tenantId,
        manuscriptId: String(session.manuscript_id),
        slot,
        sessionId,
        reason,
        previewText,
        code: failDual && dualReview.models_disagree ? "structure_dual_fail" : "structure_merge_risk",
      });
      return {
        ok: false,
        committed: false,
        httpStatus: 409,
        error: "INGEST_STRUCTURE_REVIEW_FAILED",
        code: "INGEST_STRUCTURE_REVIEW_FAILED",
        hint: "Fix the mapping in review, or resubmit with force_commit if you accept the risk.",
      };
    }
  }

  const shadow = await runDocumentIngestShadowPreflight(supabase, params.tenantId, previewText);
  if (shadow.blocked) {
    await recordIngestHallRejection({
      supabase,
      tenantId: params.tenantId,
      entityId: params.tenantId,
      manuscriptId: String(session.manuscript_id),
      slot,
      sessionId,
      reason: shadow.reason,
      previewText,
      code: "shadow_block",
    });
    return {
      ok: false,
      committed: false,
      httpStatus: 403,
      error: "INGEST_DEFEND_BLOCKED",
      code: "INGEST_DEFEND_BLOCKED",
      hint: "MSGF shadow mode blocked this import — adjust the document or split the upload.",
    };
  }

  try {
    const fp =
      session.story_fingerprint && typeof session.story_fingerprint === "object"
        ? (session.story_fingerprint as Record<string, unknown>)
        : {};
    const msgf =
      fp.msgf && typeof fp.msgf === "object" ? (fp.msgf as Record<string, unknown>) : {};
    const semanticRegions = Array.isArray(msgf.semantic_regions)
      ? (msgf.semantic_regions as import("./narrative/semanticChunking.js").SemanticRegion[])
      : undefined;
    const compilerState =
      msgf.compiler_state &&
      typeof msgf.compiler_state === "object" &&
      (msgf.compiler_state as { version?: string }).version === "3-pass-v1"
        ? (msgf.compiler_state as import("./documentIngestMultiPassCompiler.js").DocumentIngestCompilerState)
        : undefined;

    const result = await commitDocumentIngestToBackend({
      supabase,
      tenantId: params.tenantId,
      manuscriptId: String(session.manuscript_id),
      slot,
      filename: String(session.original_filename ?? "upload"),
      sourceText,
      proposed: normalizedProposed,
      outlineBeats: archiveOnly ? [] : outlineBeats,
      syncMsgfBrain:
        params.syncMsgfBrain === true || process.env.MSGF_DOCUMENT_INGEST_SYNC_BRAIN === "1",
      semanticRegions,
      compilerState,
    });

    await supabase
      .from("p4_document_ingest_sessions")
      .update({
        status: "committed",
        proposed_wiki: proposed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    return {
      ok: true,
      committed: true,
      wiki_entry_count: result.planning.wiki_entry_count,
      planning: result.planning,
      merge_risk: mergeRisk.risk ? mergeRisk : undefined,
      message:
        result.planning.wiki_entry_count > 0
          ? "Wiki building blocks, scene cards, and outline updated automatically."
          : normalizedProposed.length > 0
            ? "Outline updated. Some wiki rows were skipped (excerpt too short or duplicate) — widen excerpts in review or add on Wiki."
            : "Outline and RAG index updated. Add lore manually if no character/setting rows were extracted.",
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await recordIngestHallRejection({
      supabase,
      tenantId: params.tenantId,
      entityId: params.tenantId,
      manuscriptId: String(session.manuscript_id),
      slot,
      sessionId,
      reason: errMsg,
      previewText,
      code: "commit_failed",
    });
    return {
      ok: false,
      committed: false,
      httpStatus: 500,
      error: errMsg,
    };
  }
}

export async function tryAutoCommitIngestSession(
  supabase: SupabaseClient,
  sessionId: string,
  tenantId: string
): Promise<ExecuteIngestCommitResult | null> {
  if (!isAutoWikiBuildEnabled()) return null;

  const { data: session, error } = await supabase
    .from("p4_document_ingest_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !session) return null;
  if (session.status !== "review") return null;

  return executeDocumentIngestSessionCommit(supabase, {
    session: session as IngestSessionRow,
    tenantId,
    autoCommit: true,
  });
}
