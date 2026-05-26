import { createHash } from "node:crypto";
import multer from "multer";
import { Router, type Request, type Response } from "express";

import {
  buildCommitPreviewText,
  detectStructureMergeRisk,
  recordIngestHallRejection,
  runDocumentIngestShadowPreflight,
  runDualStructureReview,
  sessionHadBlockingClarification,
  sessionHadBlockingConflicts,
} from "../lib/documentIngestMsgfGuard.js";
import {
  answerFoundInSource,
  countWords,
  DOCUMENT_SLOTS,
  estimatePages,
  requiresAuthorshipGate,
  SLOT_LABELS,
  type DocumentIngestSlot,
  type ProposedWikiEntry,
} from "../lib/documentIngestGate.js";
import {
  analyzeDocumentIngest,
  fallbackAuthorshipQuestions,
  resolveQuestionCount,
} from "../lib/documentIngestLlm.js";
import {
  resolveNextStatusAfterScan,
  type ClarifyingQuestion,
  type IngestConflict,
} from "../lib/documentIngestStructure.js";
import { compileDocumentIngest } from "../lib/documentIngestCompile.js";
import { normalizeProposedWikiEntry, type IngestPlotBeat } from "../lib/documentIngestOutline.js";
import type { IngestOutlineBeat } from "../lib/documentIngestGate.js";
import { assertUuid } from "../lib/halMetrics.js";
import { recordHalStartupSession } from "../lib/halStartupRecord.js";
import {
  HAL_STARTUP_MIN_WORDS,
  HAL_STARTUP_TARGET_SECONDS,
  pickHalStartupPrompt,
} from "../lib/onboardingPrompts.js";
import { structureDocumentText } from "../lib/documentTextStructure.js";
import { fetchGoogleDocFullDocumentOAuth } from "../lib/googleDocMultiTab.js";
import {
  fetchGoogleDocMetaOAuth,
  fetchGoogleDocPlainTextOAuth,
} from "../lib/googleDocOAuth.js";
import { splitTabSections } from "../lib/documentPlanningTaxonomy.js";
import { getGoogleOAuthClientForTenant } from "../lib/googleOAuthTokens.js";
import { parseManuscriptToText } from "../lib/narrative/IngestionService.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const onboardingController = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 18 * 1024 * 1024, files: 1 },
});

const MAX_SOURCE_CHARS = 400_000;

function compileScanPayload(params: {
  sourceText: string;
  proposed: ProposedWikiEntry[];
  outline_beats: IngestOutlineBeat[];
}) {
  const compiled = compileDocumentIngest({
    outlineBeats: params.outline_beats as IngestPlotBeat[],
    proposedWiki: params.proposed,
    sourceText: params.sourceText,
  });
  const sourceText = compiled.source_text ?? params.sourceText;
  return {
    sourceText,
    proposed: compiled.proposed_wiki,
    outline_beats: compiled.outline_beats as IngestOutlineBeat[],
    compile_stats: compiled.stats,
    content_digest: createHash("sha256").update(sourceText, "utf8").digest("hex").slice(0, 24),
  };
}

async function ensureStarterManuscript(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  manuscriptId?: string
): Promise<string> {
  if (manuscriptId?.trim()) {
    const id = manuscriptId.trim();
    const { data } = await supabase
      .from("p4_manuscripts")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) return id;
  }

  const { data: existing } = await supabase
    .from("p4_manuscripts")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return String(existing.id);

  const { data: created, error } = await supabase
    .from("p4_manuscripts")
    .insert({
      tenant_id: tenantId,
      title: "My first manuscript",
      project_phase: "working",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String(created.id);
}

function parseSlot(raw: unknown): DocumentIngestSlot | null {
  const s = String(raw ?? "").trim();
  return (DOCUMENT_SLOTS as string[]).includes(s) ? (s as DocumentIngestSlot) : null;
}

/** GET /api/onboarding/status */
onboardingController.get("/api/onboarding/status", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("p4_profiles")
    .select(
      "hal_startup_completed_at, hal_startup_prompt, hal_startup_word_count"
    )
    .eq("user_id", user.userId)
    .maybeSingle();

  const { data: openReview } = await supabase
    .from("p4_document_ingest_sessions")
    .select(
      "id, slot, status, proposed_wiki, outline_beats, scan_thoughts, word_count, original_filename, content_signals, ingest_conflicts, clarifying_questions"
    )
    .eq("tenant_id", user.userId)
    .eq("status", "review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prompt =
    profile?.hal_startup_prompt?.trim() ||
    pickHalStartupPrompt(user.userId);

  return res.status(200).json({
    hal_startup_completed: Boolean(profile?.hal_startup_completed_at),
    hal_startup_prompt: prompt,
    hal_startup_target_seconds: HAL_STARTUP_TARGET_SECONDS,
    hal_startup_min_words: HAL_STARTUP_MIN_WORDS,
    hal_startup_word_count: profile?.hal_startup_word_count ?? null,
    document_review: openReview
      ? {
          session_id: openReview.id,
          slot: openReview.slot,
          slot_label: SLOT_LABELS[openReview.slot as DocumentIngestSlot] ?? openReview.slot,
          word_count: openReview.word_count,
          original_filename: openReview.original_filename,
          proposed_wiki: openReview.proposed_wiki,
          outline_beats: openReview.outline_beats ?? [],
          scan_thoughts: openReview.scan_thoughts,
          content_signals: openReview.content_signals ?? [],
          ingest_conflicts: openReview.ingest_conflicts ?? [],
          clarifying_questions: openReview.clarifying_questions ?? [],
        }
      : null,
  });
});

/** POST /api/onboarding/hal-startup */
onboardingController.post("/api/onboarding/hal-startup", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const content = String(body.content ?? "").trim();
    const latencies = Array.isArray(body.keystrokeLatencies)
      ? body.keystrokeLatencies.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];
    const keystrokeDna =
      body.keystrokeDna != null && typeof body.keystrokeDna === "object"
        ? (body.keystrokeDna as Record<string, unknown>)
        : null;

    const words = countWords(content);
    if (words < HAL_STARTUP_MIN_WORDS) {
      return res.status(400).json({
        error: `Write at least ${HAL_STARTUP_MIN_WORDS} words for your startup pace calibration.`,
        word_count: words,
      });
    }

    const supabase = getSupabaseAdmin();
    const manuscriptId = await ensureStarterManuscript(
      supabase,
      user.userId,
      body.manuscript_id != null ? String(body.manuscript_id) : undefined
    );

    const prompt =
      String(body.prompt ?? "").trim() || pickHalStartupPrompt(user.userId);

    const { ledgerId, sessionId, wordCount } = await recordHalStartupSession({
      supabase,
      tenantId: user.userId,
      authorUserId: user.userId,
      manuscriptId,
      content,
      keystrokeLatencies: latencies.length ? latencies : [80, 95, 110, 88, 102],
      keystrokeDna,
      locale: body.locale != null ? String(body.locale) : "en",
    });

    const now = new Date().toISOString();
    await supabase
      .from("p4_profiles")
      .update({
        hal_startup_completed_at: now,
        hal_startup_prompt: prompt,
        hal_startup_word_count: wordCount,
        hal_startup_ledger_id: ledgerId,
        updated_at: now,
      })
      .eq("user_id", user.userId);

    return res.status(200).json({
      success: true,
      manuscript_id: manuscriptId,
      session_id: sessionId,
      word_count: wordCount,
      message: "HAL startup pace saved as your identity root baseline.",
    });
  } catch (e) {
    console.error("[onboarding/hal-startup]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "HAL startup failed" });
  }
});

/**
 * POST /api/onboarding/document/scan — multipart: file, manuscript_id, slot
 * Returns session_id + scan_thoughts; may require authorship step next.
 */
onboardingController.post(
  "/api/onboarding/document/scan",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    try {
      const slot = parseSlot(req.body?.slot);
      if (!slot) {
        return res.status(400).json({ error: "slot must be world_bible, current_draft, or character_sheet" });
      }
      const manuscriptId = assertUuid(String(req.body?.manuscript_id ?? ""), "manuscript_id");
      const f = req.file;
      if (!f?.buffer?.length) {
        return res.status(400).json({ error: "Missing file" });
      }

      const plain = await parseManuscriptToText(f.buffer, f.originalname || "upload.txt");
      if (!plain.trim()) return res.status(400).json({ error: "Document is empty" });
      const sourceText = structureDocumentText(plain).slice(0, MAX_SOURCE_CHARS);
      const wordCount = countWords(sourceText);
      const pageEstimate = estimatePages(wordCount);
      const gate = requiresAuthorshipGate(wordCount, pageEstimate);
      const qCount = gate ? resolveQuestionCount(sourceText) : 0;

      const supabase = getSupabaseAdmin();
      const { data: ms } = await supabase
        .from("p4_manuscripts")
        .select("id")
        .eq("id", manuscriptId)
        .eq("tenant_id", user.userId)
        .maybeSingle();
      if (!ms) return res.status(404).json({ error: "Manuscript not found" });

      const enriched = await analyzeDocumentIngest({
        supabase,
        tenantId: user.userId,
        text: sourceText,
        slot,
        manuscriptId,
        questionCount: qCount,
      });

      const proposed = enriched.proposed.map((p) =>
        normalizeProposedWikiEntry(p, manuscriptId, slot)
      );
      const compiledScan = compileScanPayload({
        sourceText,
        proposed,
        outline_beats: enriched.outline_beats,
      });

      const questions =
        gate && enriched.questions.length >= 3
          ? enriched.questions
          : gate
            ? fallbackAuthorshipQuestions(qCount)
            : [];

      const status = resolveNextStatusAfterScan({
        gate,
        authorshipQuestionCount: questions.length,
        clarifying: enriched.clarifying_questions,
      });

      const { data: session, error } = await supabase
        .from("p4_document_ingest_sessions")
        .insert({
          tenant_id: user.userId,
          manuscript_id: manuscriptId,
          slot,
          original_filename: f.originalname || "upload",
          word_count: countWords(compiledScan.sourceText),
          page_estimate: pageEstimate,
          requires_authorship_gate: gate,
          authorship_questions: questions,
          scan_thoughts: enriched.thoughts,
          proposed_wiki: compiledScan.proposed,
          outline_beats: compiledScan.outline_beats,
          content_signals: enriched.content_signals,
          story_fingerprint: { ...enriched.story_fingerprint, msgf: enriched.msgf_meta },
          ingest_conflicts: enriched.ingest_conflicts,
          clarifying_questions: enriched.clarifying_questions,
          status,
          content_digest: compiledScan.content_digest,
          source_text: compiledScan.sourceText,
        })
        .select("id, status")
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        success: true,
        session_id: session.id,
        status: session.status,
        word_count: wordCount,
        page_estimate: pageEstimate,
        requires_authorship_gate: gate,
        scan_thoughts: enriched.thoughts,
        authorship_questions: questions,
        proposed_wiki: status === "review" ? compiledScan.proposed : [],
        outline_beats: compiledScan.outline_beats,
        compile_stats: compiledScan.compile_stats,
        content_signals: enriched.content_signals,
        ingest_conflicts: enriched.ingest_conflicts,
        clarifying_questions: enriched.clarifying_questions,
        used_llm: enriched.usedLlm,
        msgf_meta: enriched.msgf_meta,
      });
    } catch (e) {
      console.error("[onboarding/document/scan]", e);
      return res.status(500).json({ error: e instanceof Error ? e.message : "Scan failed" });
    }
  }
);

/**
 * POST /api/onboarding/document/scan-google
 * Body: { google_doc_id, manuscript_id, slot }
 */
onboardingController.post("/api/onboarding/document/scan-google", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  try {
    const slot = parseSlot((req.body as { slot?: unknown })?.slot);
    if (!slot) {
      return res.status(400).json({ error: "slot must be world_bible, current_draft, or character_sheet" });
    }
    const manuscriptId = assertUuid(
      String((req.body as { manuscript_id?: unknown })?.manuscript_id ?? ""),
      "manuscript_id"
    );
    const googleDocId = String((req.body as { google_doc_id?: unknown })?.google_doc_id ?? "").trim();
    if (!googleDocId) return res.status(400).json({ error: "google_doc_id is required" });

    const supabase = getSupabaseAdmin();
    const { data: ms } = await supabase
      .from("p4_manuscripts")
      .select("id")
      .eq("id", manuscriptId)
      .eq("tenant_id", user.userId)
      .maybeSingle();
    if (!ms) return res.status(404).json({ error: "Manuscript not found" });

    const { client } = await getGoogleOAuthClientForTenant(supabase, user.userId);
    const [meta, fetched] = await Promise.all([
      fetchGoogleDocMetaOAuth(client, googleDocId),
      fetchGoogleDocFullDocumentOAuth(client, googleDocId),
    ]);
    const plain = fetched.text;
    const tabCount = fetched.tabCount;
    const tabSections = splitTabSections(plain);

    if (!plain.trim()) return res.status(400).json({ error: "Google Doc is empty" });
    const sourceText = structureDocumentText(plain).slice(0, MAX_SOURCE_CHARS);
    const wordCount = countWords(sourceText);
    const pageEstimate = estimatePages(wordCount);
    const gate = requiresAuthorshipGate(wordCount, pageEstimate);
    const qCount = gate ? resolveQuestionCount(sourceText) : 0;

    const enriched = await analyzeDocumentIngest({
      supabase,
      tenantId: user.userId,
      text: sourceText,
      slot,
      manuscriptId,
      questionCount: qCount,
    });

    const proposed = enriched.proposed.map((p) => normalizeProposedWikiEntry(p, manuscriptId, slot));
    const compiledScan = compileScanPayload({
      sourceText,
      proposed,
      outline_beats: enriched.outline_beats,
    });

    const questions =
      gate && enriched.questions.length >= 3
        ? enriched.questions
        : gate
          ? fallbackAuthorshipQuestions(qCount)
          : [];

    const status = resolveNextStatusAfterScan({
      gate,
      authorshipQuestionCount: questions.length,
      clarifying: enriched.clarifying_questions,
    });

    const { data: session, error } = await supabase
      .from("p4_document_ingest_sessions")
      .insert({
        tenant_id: user.userId,
        manuscript_id: manuscriptId,
        slot,
        original_filename: `${meta.name}.gdoc`,
        word_count: countWords(compiledScan.sourceText),
        page_estimate: pageEstimate,
        requires_authorship_gate: gate,
        authorship_questions: questions,
        scan_thoughts: enriched.thoughts,
        proposed_wiki: compiledScan.proposed,
        outline_beats: compiledScan.outline_beats,
        content_signals: enriched.content_signals,
        story_fingerprint: { ...enriched.story_fingerprint, msgf: enriched.msgf_meta },
        ingest_conflicts: enriched.ingest_conflicts,
        clarifying_questions: enriched.clarifying_questions,
        status,
        content_digest: compiledScan.content_digest,
        source_text: compiledScan.sourceText,
      })
      .select("id, status")
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      success: true,
      session_id: session.id,
      status: session.status,
      word_count: wordCount,
      page_estimate: pageEstimate,
      requires_authorship_gate: gate,
      scan_thoughts: enriched.thoughts,
      authorship_questions: questions,
      proposed_wiki: status === "review" ? compiledScan.proposed : [],
      outline_beats: compiledScan.outline_beats,
      compile_stats: compiledScan.compile_stats,
      content_signals: enriched.content_signals,
      ingest_conflicts: enriched.ingest_conflicts,
      clarifying_questions: enriched.clarifying_questions,
      used_llm: enriched.usedLlm,
      msgf_meta: enriched.msgf_meta,
      google_doc: meta,
      google_doc_tabs: {
        count: tabCount,
        method: fetched.method,
        sections: tabSections.map((s) => ({
          title: s.title,
          path: s.path,
          layer: s.layer,
        })),
      },
      outline_beat_count: compiledScan.outline_beats.length,
    });
  } catch (e) {
    console.error("[onboarding/document/scan-google]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Google Doc scan failed" });
  }
});

/** POST /api/onboarding/document/verify-clarification */
onboardingController.post("/api/onboarding/document/verify-clarification", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const sessionId = assertUuid(String(body.session_id ?? ""), "session_id");
  const answers = Array.isArray(body.answers) ? body.answers.map((a) => String(a)) : [];
  const notes = String(body.notes ?? "").trim();

  const supabase = getSupabaseAdmin();
  const { data: session, error } = await supabase
    .from("p4_document_ingest_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.status !== "clarification") {
    return res.status(400).json({ error: "Session is not awaiting clarification." });
  }

  const questions = (session.clarifying_questions ?? []) as ClarifyingQuestion[];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    if (!q.required) continue;
    const ans = (answers[i] ?? notes).trim();
    if (ans.length < 8) {
      return res.status(400).json({
        error: "Answer required clarifying questions (at least a short sentence).",
        failed_index: i,
      });
    }
  }

  const wrongManuscript = answers.some((a) =>
    /wrong manuscript|different book|split files|re-upload/i.test(a)
  );
  if (wrongManuscript) {
    await supabase
      .from("p4_document_ingest_sessions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    return res.status(200).json({
      success: true,
      cancelled: true,
      message: "Import cancelled. Upload each book to its own manuscript, then scan again.",
    });
  }

  const archiveOnly = answers.some((a) => /old archive|do not overwrite|wiki only/i.test(a));
  const clarification_answers = questions.map((q, i) => ({
    id: q.id,
    code: q.code,
    answer: answers[i] ?? "",
  }));
  if (notes) clarification_answers.push({ id: "notes", code: "author_notes", answer: notes });

  const nextStatus =
    session.requires_authorship_gate &&
    Array.isArray(session.authorship_questions) &&
    (session.authorship_questions as unknown[]).length > 0
      ? "authorship"
      : "review";

  await supabase
    .from("p4_document_ingest_sessions")
    .update({
      status: nextStatus,
      clarification_answers,
      updated_at: new Date().toISOString(),
      ...(archiveOnly
        ? {
            ingest_conflicts: [
              ...((session.ingest_conflicts as unknown[]) ?? []),
              {
                code: "archive_only",
                severity: "warning",
                message: "Author chose wiki-only merge; outline may stay unchanged on commit.",
              },
            ],
          }
        : {}),
    })
    .eq("id", sessionId);

  return res.status(200).json({
    success: true,
    status: nextStatus,
    proposed_wiki: nextStatus === "review" ? session.proposed_wiki : [],
    outline_beats: session.outline_beats ?? [],
    ingest_conflicts: session.ingest_conflicts ?? [],
    message:
      nextStatus === "authorship"
        ? "Clarification saved. Complete authorship checks next."
        : "Clarification saved. Review wiki and outline beats before submitting.",
  });
});

/** POST /api/onboarding/document/verify-authorship */
onboardingController.post("/api/onboarding/document/verify-authorship", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const sessionId = assertUuid(String(body.session_id ?? ""), "session_id");
  const answers = Array.isArray(body.answers) ? body.answers.map((a) => String(a)) : [];

  const supabase = getSupabaseAdmin();
  const { data: session, error } = await supabase
    .from("p4_document_ingest_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!session) return res.status(404).json({ error: "Session not found" });

  const questions = (session.authorship_questions ?? []) as Array<{ id?: string; question?: string }>;
  if (answers.length < questions.length) {
    return res.status(400).json({ error: "Answer every authorship question." });
  }

  const source = String(session.source_text ?? "");
  const failures: number[] = [];
  for (let i = 0; i < questions.length; i++) {
    if (!answerFoundInSource(answers[i] ?? "", source)) failures.push(i);
  }
  if (failures.length > 0) {
    return res.status(400).json({
      error: "One or more answers could not be matched to your document. Quote phrasing that appears in the text.",
      failed_indices: failures,
    });
  }

  await supabase
    .from("p4_document_ingest_sessions")
    .update({ status: "review", updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  return res.status(200).json({
    success: true,
    status: "review",
    proposed_wiki: session.proposed_wiki,
    outline_beats: session.outline_beats ?? [],
    message: "Authorship verified. Review wiki and outline beats before submitting.",
  });
});

/** POST /api/onboarding/document/commit — submit | cancel */
onboardingController.post("/api/onboarding/document/commit", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? "submit").trim().toLowerCase();
  const sessionId = assertUuid(String(body.session_id ?? ""), "session_id");

  const supabase = getSupabaseAdmin();
  const { data: session, error } = await supabase
    .from("p4_document_ingest_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!session) return res.status(404).json({ error: "Session not found" });

  if (action === "cancel") {
    await supabase
      .from("p4_document_ingest_sessions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    return res.status(200).json({ success: true, cancelled: true });
  }

  if (action === "reject") {
    const rejectionReason = String(body.rejection_reason ?? body.reason ?? "").trim()
      || "Author reported bad document ingest mapping.";
    const proposedReject = (Array.isArray(body.proposed_wiki)
      ? body.proposed_wiki
      : session.proposed_wiki) as ProposedWikiEntry[];
    const outlineReject = (
      Array.isArray(body.outline_beats) ? body.outline_beats : session.outline_beats
    ) as IngestOutlineBeat[];
    const preview = buildCommitPreviewText({
      slot: session.slot as DocumentIngestSlot,
      filename: String(session.original_filename ?? "upload"),
      sourceText: String(session.source_text ?? ""),
      proposed: proposedReject,
      outlineBeats: outlineReject,
    });
    const hall = await recordIngestHallRejection({
      supabase,
      tenantId: user.userId,
      entityId: user.userId,
      manuscriptId: String(session.manuscript_id),
      slot: session.slot as DocumentIngestSlot,
      sessionId,
      reason: rejectionReason,
      previewText: preview,
      code: "user_reject",
    });
    await supabase
      .from("p4_document_ingest_sessions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    return res.status(200).json({
      success: true,
      rejected: true,
      hall_recorded: hall.recorded,
      message: "Import rejected. This pattern was recorded so future imports can be guarded.",
    });
  }

  if (session.status === "clarification") {
    return res.status(400).json({ error: "Answer clarifying questions before submitting." });
  }
  if (session.status !== "review") {
    return res.status(400).json({ error: "Session is not ready for submit (complete clarification/authorship first)." });
  }

  const archiveOnly = Array.isArray(session.clarification_answers)
    ? (session.clarification_answers as Array<{ code?: string; answer?: string }>).some(
        (a) =>
          a.code === "import_intent" &&
          typeof a.answer === "string" &&
          /old archive|wiki only/i.test(a.answer)
      )
    : false;

  const proposed = (Array.isArray(body.proposed_wiki) ? body.proposed_wiki : session.proposed_wiki) as ProposedWikiEntry[];
  const outlineBeats = (
    Array.isArray(body.outline_beats) ? body.outline_beats : session.outline_beats
  ) as IngestOutlineBeat[];
  const sourceText = String(session.source_text ?? "");
  const forceCommit = body.force_commit === true || String(body.force_commit).toLowerCase() === "true";

  const normalizedProposed = proposed.map((p) =>
    normalizeProposedWikiEntry(p, String(session.manuscript_id), session.slot as DocumentIngestSlot)
  );
  const previewText = buildCommitPreviewText({
    slot: session.slot as DocumentIngestSlot,
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
    sessionHadBlockingClarification(session.clarifying_questions as ClarifyingQuestion[]) ||
    sessionHadBlockingConflicts(session.ingest_conflicts as IngestConflict[]);

  let dualReview: Awaited<ReturnType<typeof runDualStructureReview>> | null = null;
  if (needsDualReview && !forceCommit) {
    dualReview = await runDualStructureReview({ sourceText, preview: previewText });
    const failDual = dualReview.ran && dualReview.structure_valid === false;
    const failHeuristic = mergeRisk.risk && !dualReview.ran;
    if (failDual || failHeuristic) {
      const reason = failDual
        ? dualReview!.reason
        : mergeRisk.reason;
      await recordIngestHallRejection({
        supabase,
        tenantId: user.userId,
        entityId: user.userId,
        manuscriptId: String(session.manuscript_id),
        slot: session.slot as DocumentIngestSlot,
        sessionId,
        reason,
        previewText,
        code: failDual && dualReview!.models_disagree ? "structure_dual_fail" : "structure_merge_risk",
      });
      return res.status(409).json({
        error: "INGEST_STRUCTURE_REVIEW_FAILED",
        message: reason,
        models_disagree: dualReview?.models_disagree ?? false,
        merge_risk: mergeRisk,
        dual_review: dualReview,
        hint: "Fix the mapping in review, or resubmit with force_commit if you accept the risk.",
      });
    }
  }

  const shadow = await runDocumentIngestShadowPreflight(supabase, user.userId, previewText);
  if (shadow.blocked) {
    await recordIngestHallRejection({
      supabase,
      tenantId: user.userId,
      entityId: user.userId,
      manuscriptId: String(session.manuscript_id),
      slot: session.slot as DocumentIngestSlot,
      sessionId,
      reason: shadow.reason,
      previewText,
      code: "shadow_block",
    });
    return res.status(403).json({
      error: "INGEST_DEFEND_BLOCKED",
      tier: shadow.tier,
      reason: shadow.reason,
      shadow,
      message:
        "MSGF shadow mode blocked this import — it matches a prior bad pattern in your Hall. Adjust the mapping or split the document.",
    });
  }

  try {
    const result = await commitDocumentIngestToBackend({
      supabase,
      tenantId: user.userId,
      manuscriptId: String(session.manuscript_id),
      slot: session.slot as DocumentIngestSlot,
      filename: String(session.original_filename ?? "upload"),
      sourceText,
      proposed: normalizedProposed,
      outlineBeats: archiveOnly ? [] : outlineBeats,
      syncMsgfBrain: body.sync_msgf_brain !== false,
    });

    await supabase
      .from("p4_document_ingest_sessions")
      .update({
        status: "committed",
        proposed_wiki: proposed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    return res.status(200).json({
      success: true,
      committed: true,
      ...result,
      planning: result.planning,
      shadow,
      merge_risk: mergeRisk.risk ? mergeRisk : undefined,
      dual_review: dualReview?.ran ? dualReview : undefined,
      message:
        "Wiki building blocks, scene cards, and outline updated. Open Plot Sandbox or Wiki to continue.",
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[onboarding/document/commit]", e);
    await recordIngestHallRejection({
      supabase,
      tenantId: user.userId,
      entityId: user.userId,
      manuscriptId: String(session.manuscript_id),
      slot: session.slot as DocumentIngestSlot,
      sessionId,
      reason: errMsg,
      previewText,
      code: "commit_failed",
    });
    return res.status(500).json({ error: errMsg });
  }
});
