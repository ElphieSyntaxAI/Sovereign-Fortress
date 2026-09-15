import { randomUUID } from "node:crypto";

import { Router, type Request, type Response } from "express";

import { LinguisticAnalyzer } from "../lib/forensics/linguistics.js";
import {
  HalRollingBaselineRow,
  linguisticMatchFactor,
  maxRelativeDriftAgainstBaseline,
} from "../lib/halLinguisticFactor.js";
import {
  computeHalScore,
  HalValidationError,
  parseHalLocale,
  resolveHalImeRhythm,
  rhythmAnomalyThresholdForLocale,
  stylometricFromContentDelta,
  varianceSample,
  assertUuid,
} from "../lib/halMetrics.js";
import { P4_HAL_LEDGER, P4_HAL_LEDGER_ROLLING_AVG_5 } from "../lib/database/canonicalIdentifiers.js";
import { assertBffManuscriptTenantSession } from "../middleware/author-gate.js";
import { readBearerUser, tryReadBearerUser } from "../lib/readBearerJwtUser.js";
import type { AuthorHalDnaEvent } from "../lib/msgfPulseBridge.js";
import { syncAuthorHalChunksToMsgf } from "../lib/authorHalMsgfSync.js";
import { getAuthorMsgfMappingStatus } from "../lib/authorMsgfMapping.js";
import {
  acceptHalOfflineResync,
  issueHalOfflineLease,
  renewHalOfflineLease,
} from "../lib/halOfflineResync.js";
import type { SealedHalBatch } from "../lib/halOfflineSeal.js";
import {
  httpStatusForTamper,
  runHalTamperChecks,
  type HalDnaEventLike,
} from "../lib/halTamperChecks.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

type HalSessionBody = {
  tenantId?: unknown;
  manuscriptId?: unknown;
  keystrokeLatencies?: unknown;
  contentDelta?: unknown;
  authorUserId?: unknown;
  /** When true, marks this row as the tenant typing baseline (`IDENTITY_ROOT`). */
  identityRoot?: unknown;
  /** Optional full keystroke stream from forensic UI (keydown/keyup). */
  keystrokeDna?: unknown;
  recalibrationEvent?: unknown;
  recalibrationReason?: unknown;
  /** `en` | `es` | `ja` — affects stylometrics, rhythm scoring (IME relax for `ja`), and calibration thresholds. */
  locale?: unknown;
  /** Explicit IME session flag (optional if `compositionEvents` is sent). */
  isImeSession?: unknown;
  /** e.g. `["compositionstart","compositionend"]` — presence sets IME session. */
  compositionEvents?: unknown;
  /** Per-committed-string dwell / gap (ms). Preferred rhythm series when IME. */
  committedBlockLatenciesMs?: unknown;
  /** Alternative: array of per-key flight arrays, one per IME commitment; summed into block latencies. */
  compositionBlocks?: unknown;
  /** Skip MSGF packets already sent (incremental chunk sync). */
  lastSyncedChunkIndex?: unknown;
  /** When false, persist ledger only (no MSGF Pulse). */
  syncMsgf?: unknown;
};

export const halController = Router();

const linguisticAnalyzer = new LinguisticAnalyzer();

function extractHalDnaEvents(
  keystrokeDna: Record<string, unknown> | null,
  fallbackLatencies: number[]
): AuthorHalDnaEvent[] {
  const raw = keystrokeDna?.events;
  if (Array.isArray(raw)) {
    const out: AuthorHalDnaEvent[] = [];
    for (const e of raw) {
      if (!e || typeof e !== "object") continue;
      const row = e as Record<string, unknown>;
      if (typeof row.key !== "string") continue;
      out.push({
        key: row.key,
        timestamp: row.timestamp as string | number | undefined,
        flightTime: Number(row.flightTime ?? row.flightMs) || undefined,
        dwellTime: Number(row.dwellTime ?? row.dwellMs) || undefined,
        isBackspace: row.isBackspace === true,
        isSystemEvent: row.isSystemEvent === true,
        wordsPasted:
          typeof row.wordsPasted === "number" ? row.wordsPasted : undefined,
      });
    }
    if (out.length > 0) return out;
  }
  return fallbackLatencies.map((n) => ({ key: "AuthorHAL", flightTime: n }));
}

/** Lightweight incremental MSGF sync (175-word packets) without full ledger write. */
halController.post("/api/hal/chunk-pulse", async (req: Request, res: Response) => {
  try {
    const body = req.body as HalSessionBody;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "JSON body required" });
    }

    const tenantId = assertUuid(String(body.tenantId ?? ""), "tenantId");
    const manuscriptId = String(body.manuscriptId ?? "").trim();
    if (!manuscriptId) {
      return res.status(400).json({ error: "manuscriptId is required" });
    }

    const contentDelta =
      typeof body.contentDelta === "string"
        ? body.contentDelta
        : body.contentDelta != null
          ? JSON.stringify(body.contentDelta)
          : "";

    if (!contentDelta.trim()) {
      return res.status(400).json({ error: "contentDelta is required for chunk sync" });
    }

    const locale = parseHalLocale(body.locale);
    const style = stylometricFromContentDelta(contentDelta, locale);

    let authorUserId: string | null = null;
    const bearer = tryReadBearerUser(req);
    if (bearer?.userId) {
      authorUserId = bearer.userId;
    } else if (body.authorUserId != null && String(body.authorUserId).trim() !== "") {
      authorUserId = assertUuid(String(body.authorUserId), "authorUserId");
    }

    const keystrokeDna =
      body.keystrokeDna != null && typeof body.keystrokeDna === "object"
        ? (body.keystrokeDna as Record<string, unknown>)
        : null;

    const rawLatencies: number[] = Array.isArray(body.keystrokeLatencies)
      ? body.keystrokeLatencies.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];

    const rhythm = resolveHalImeRhythm({
      keystrokeLatencies: rawLatencies,
      isImeSession: body.isImeSession === true,
      compositionEvents: body.compositionEvents,
      committedBlockLatenciesMs: body.committedBlockLatenciesMs,
      compositionBlocks: body.compositionBlocks,
    });

    const typingScore = computeHalScore(
      rhythm.rhythmUnitCount,
      style.word_count,
      rhythm.latencyMsForRhythm,
      locale,
      { isImeSession: rhythm.isImeSession }
    );

    const lastSynced =
      typeof body.lastSyncedChunkIndex === "number"
        ? body.lastSyncedChunkIndex
        : body.lastSyncedChunkIndex != null
          ? Number(body.lastSyncedChunkIndex)
          : null;

    if (process.env.MSGF_AUTHOR_HAL_PULSE_ENABLED?.trim().toLowerCase() === "0") {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "MSGF_AUTHOR_HAL_PULSE_ENABLED=0",
      });
    }

    if (!authorUserId) {
      return res.status(400).json({
        error:
          "authorUserId or Authorization Bearer required — MSGF entity id must be the signed-in user UUID.",
      });
    }

    const sync = await syncAuthorHalChunksToMsgf({
      userId: authorUserId,
      tenantId,
      manuscriptId,
      contentDelta,
      events: extractHalDnaEvents(keystrokeDna, rhythm.rawKeystrokeLatencyMs),
      halScore: typingScore,
      typingScore,
      locale,
      isImeSession: rhythm.isImeSession,
      rhythmUnitCount: rhythm.rhythmUnitCount,
      wordCount: style.word_count,
      lastSyncedChunkIndex: Number.isFinite(lastSynced) ? lastSynced : null,
    });

    const mapping = getAuthorMsgfMappingStatus();
    return res.status(200).json({
      ok: sync.errors.length === 0,
      packets_sent: sync.packetsSent,
      last_chunk_index: sync.lastChunkIndex,
      last_routing: sync.last_routing,
      routings: sync.routings,
      errors: sync.errors,
      msgf_mapping_ready: mapping.ready,
      msgf_dashboard: mapping.dashboard_links,
    });
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[hal/chunk-pulse]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Internal error",
    });
  }
});

halController.post("/api/hal/session", async (req: Request, res: Response) => {
  try {
    const body = req.body as HalSessionBody;

    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "JSON body required" });
    }

    const tenantId = assertUuid(String(body.tenantId ?? ""), "tenantId");
    const manuscriptId = String(body.manuscriptId ?? "").trim();
    if (!manuscriptId) {
      return res.status(400).json({ error: "manuscriptId is required" });
    }

    if (!Array.isArray(body.keystrokeLatencies)) {
      return res.status(400).json({ error: "keystrokeLatencies must be an array of numbers" });
    }
    const rawLatencies: number[] = [];
    for (const x of body.keystrokeLatencies) {
      const n = typeof x === "number" ? x : Number(x);
      if (!Number.isFinite(n)) {
        return res.status(400).json({ error: "keystrokeLatencies must be numeric values" });
      }
      rawLatencies.push(n);
    }

    const contentDelta =
      typeof body.contentDelta === "string"
        ? body.contentDelta
        : body.contentDelta != null
          ? JSON.stringify(body.contentDelta)
          : "";

    const locale = parseHalLocale(body.locale);

    const rhythm = resolveHalImeRhythm({
      keystrokeLatencies: rawLatencies,
      isImeSession: body.isImeSession === true,
      compositionEvents: body.compositionEvents,
      committedBlockLatenciesMs: body.committedBlockLatenciesMs,
      compositionBlocks: body.compositionBlocks,
    });

    const latencyMs = rhythm.latencyMsForRhythm;
    const manualKeystrokes = rhythm.rhythmUnitCount;

    const style = stylometricFromContentDelta(contentDelta, locale);
    const totalWords = style.word_count;

    const typingScore = computeHalScore(manualKeystrokes, totalWords, latencyMs, locale, {
      isImeSession: rhythm.isImeSession,
    });
    const latencyVariance = varianceSample(latencyMs);
    const rhythmAnomalyThreshold = rhythmAnomalyThresholdForLocale(locale);

    const linguisticProfile = linguisticAnalyzer.extract(contentDelta, locale);
    const linguisticAnomalies = linguisticAnalyzer.detectAnomalies(linguisticProfile);
    const anomalyCount = Object.values(linguisticAnomalies as Record<string, boolean>).filter(
      Boolean
    ).length;

    const identityRoot = body.identityRoot === true;
    const keystrokeDna =
      body.keystrokeDna != null && typeof body.keystrokeDna === "object"
        ? (body.keystrokeDna as Record<string, unknown>)
        : null;
    const dnaEventsForTamper = extractHalDnaEvents(keystrokeDna, rhythm.rawKeystrokeLatencyMs);

    const liveTamper = runHalTamperChecks({
      locale,
      latencyMs,
      events: dnaEventsForTamper as HalDnaEventLike[],
      claimedTypedWords: totalWords,
      contentDelta,
      linguisticAnomalyCount: anomalyCount,
    });
    if (!liveTamper.ok) {
      return res.status(httpStatusForTamper(liveTamper)).json({
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: liveTamper.hard,
        soft: liveTamper.soft,
        reasons: liveTamper.reasons,
      });
    }

    const supabase = getSupabaseAdmin();

    // Rolling linguistic baseline (post-recalibration window); canonical view `p4_hal_ledger_rolling_avg_5`.
    const { data: rollingRow, error: rollingError } = await supabase
      .from(P4_HAL_LEDGER_ROLLING_AVG_5)
      .select(
        "tenant_id,sample_sessions,avg_ttr,avg_avg_sentence_length_words,avg_punctuation_frequency,avg_function_word_weight,avg_sentence_length_std_dev"
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (rollingError) {
      console.error("[hal/session] rolling baseline error:", rollingError.message);
      return res.status(500).json({
        error: "Failed to load linguistic baseline",
        detail: rollingError.message,
      });
    }

    const baseline = rollingRow as HalRollingBaselineRow | null;
    const sampleSessions = baseline?.sample_sessions ?? 0;
    /** Fewer than 3 sessions in the rolling window: new tenant or post-recalibration; skip drift penalty. */
    const isTrainingPhase = sampleSessions < 3;

    const maxRelativeDelta = baseline
      ? maxRelativeDriftAgainstBaseline(linguisticProfile, baseline)
      : null;
    const matchFactorFromDrift = linguisticMatchFactor(maxRelativeDelta);
    const linguisticMatchFactorEffective = isTrainingPhase ? 1.0 : matchFactorFromDrift;
    const majorLinguisticDrift =
      !isTrainingPhase && maxRelativeDelta != null && maxRelativeDelta > 0.2;

    const halScoreFinal = typingScore * linguisticMatchFactorEffective;

    const recalibrationEvent = body.recalibrationEvent === true;
    const recalibrationReason =
      typeof body.recalibrationReason === "string" ? body.recalibrationReason.trim() || null : null;

    let authorUserId: string | null = null;
    if (body.authorUserId != null && String(body.authorUserId).trim() !== "") {
      authorUserId = assertUuid(String(body.authorUserId), "authorUserId");
    }

    const sessionId = randomUUID();

    const linguistic_profile = {
      ttr: linguisticProfile.ttr,
      avg_sentence_length_words: linguisticProfile.avgSentenceLengthWords,
      punctuation_frequency: linguisticProfile.punctuationFrequency,
      function_word_weight: linguisticProfile.functionWordWeight,
      sentence_length_std_dev: linguisticProfile.sentenceLengthStdDev,
    };

    const stylometric_snapshot = {
      locale,
      is_ime_session: rhythm.isImeSession,
      sync_mode: "live" as const,
      rhythm_anomaly_threshold: rhythmAnomalyThreshold,
      text_segmentation: style.segmentation,
      average_sentence_length: style.average_sentence_length_words,
      vocabulary_variety: style.vocabulary_variety,
      sentence_count: style.sentence_count,
      word_count: style.word_count,
      unique_word_count: style.unique_word_count,
      linguistic_profile,
      linguistic_anomalies: linguisticAnomalies,
      linguistic_baseline_rolling: baseline
        ? {
            sample_sessions: baseline.sample_sessions,
            avg_ttr: baseline.avg_ttr,
            avg_avg_sentence_length_words: baseline.avg_avg_sentence_length_words,
            avg_punctuation_frequency: baseline.avg_punctuation_frequency,
            avg_function_word_weight: baseline.avg_function_word_weight,
            avg_sentence_length_std_dev: baseline.avg_sentence_length_std_dev,
          }
        : null,
      linguistic_drift: {
        max_relative_delta: maxRelativeDelta,
        major_linguistic_drift: majorLinguisticDrift,
      },
      linguistic_match_factor: Math.round(linguisticMatchFactorEffective * 10000) / 10000,
      is_training_phase: isTrainingPhase,
      typing_score: Math.round(typingScore * 10000) / 10000,
      hal_score_final: Math.round(halScoreFinal * 10000) / 10000,
      tamper_flags: liveTamper.soft,
      ...(identityRoot ? { identity_marker: "IDENTITY_ROOT" as const } : {}),
      ...(recalibrationEvent
        ? {
            recalibration_event: true as const,
            ...(recalibrationReason ? { recalibration_reason: recalibrationReason } : {}),
          }
        : {}),
    };

    const raw_sample = {
      manuscriptId,
      locale,
      sync_mode: "live" as const,
      is_ime_session: rhythm.isImeSession,
      rhythm_anomaly_threshold: rhythmAnomalyThreshold,
      hal_score: Math.round(halScoreFinal * 10000) / 10000,
      typing_score: Math.round(typingScore * 10000) / 10000,
      linguistic_match_factor: Math.round(linguisticMatchFactorEffective * 10000) / 10000,
      is_training_phase: isTrainingPhase,
      manual_keystrokes: rhythm.rawKeystrokeLatencyMs.length,
      rhythm_unit_count: manualKeystrokes,
      total_words: totalWords,
      latency_variance: Math.round(latencyVariance * 100) / 100,
      latency_count: latencyMs.length,
      tamper_flags: liveTamper.soft,
      ...(rhythm.rawKeystrokeLatencyMs.length !== latencyMs.length ||
      rhythm.isImeSession
        ? { raw_keystroke_latency_ms: rhythm.rawKeystrokeLatencyMs }
        : {}),
      ...(identityRoot ? { session_marker: "IDENTITY_ROOT" as const } : {}),
      ...(keystrokeDna ? { keystroke_dna: keystrokeDna } : {}),
    };

    const { data, error } = await supabase
      .from(P4_HAL_LEDGER)
      .insert({
        tenant_id: tenantId,
        author_user_id: authorUserId,
        session_id: sessionId,
        keystroke_latency_ms: latencyMs,
        manual_word_count: totalWords,
        ai_assisted_word_count: 0,
        stylometric_snapshot,
        raw_sample,
        sync_mode: "live",
        recalibration_event: recalibrationEvent,
        recalibration_reason: recalibrationReason,
      })
      .select("id, session_id, created_at")
      .single();

    if (error) {
      console.error("[hal/session] Supabase insert error:", error.message);
      return res.status(500).json({ error: "Failed to persist HAL session", detail: error.message });
    }

    const dnaEvents = extractHalDnaEvents(keystrokeDna, rhythm.rawKeystrokeLatencyMs);
    const syncMsgf =
      body.syncMsgf !== false &&
      process.env.MSGF_AUTHOR_HAL_PULSE_ENABLED?.trim().toLowerCase() !== "0";

    const lastSynced =
      typeof body.lastSyncedChunkIndex === "number"
        ? body.lastSyncedChunkIndex
        : body.lastSyncedChunkIndex != null
          ? Number(body.lastSyncedChunkIndex)
          : null;

    const msgfPulse = !syncMsgf
      ? {
          packetsSent: 0,
          lastChunkIndex: Number.isFinite(lastSynced) ? lastSynced : null,
          results: [],
          errors: ["MSGF sync disabled."],
          last_routing: null as string | null,
          routings: [] as string[],
        }
      : await syncAuthorHalChunksToMsgf({
          userId: authorUserId || sessionId,
          tenantId,
          manuscriptId,
          contentDelta,
          events: dnaEvents,
          halScore: halScoreFinal,
          typingScore,
          locale,
          isImeSession: rhythm.isImeSession,
          rhythmUnitCount: manualKeystrokes,
          wordCount: totalWords,
          isTrainingPhase,
          sessionId,
          lastSyncedChunkIndex: Number.isFinite(lastSynced) ? lastSynced : null,
        });

    return res.status(201).json({
      ok: true,
      id: data.id,
      sessionId: data.session_id,
      createdAt: data.created_at,
      locale,
      sync_mode: "live",
      rhythmAnomalyThreshold,
      is_ime_session: rhythm.isImeSession,
      typingScore: raw_sample.typing_score,
      linguisticMatchFactor: raw_sample.linguistic_match_factor,
      halScore: raw_sample.hal_score,
      is_training_phase: isTrainingPhase,
      identityRoot,
      recalibrationEvent,
      tamper_flags: liveTamper.soft,
      stylometric_snapshot,
      msgf_pulse: {
        ok: syncMsgf && msgfPulse.errors.length === 0,
        configured: syncMsgf,
        packets_sent: msgfPulse.packetsSent,
        last_chunk_index: msgfPulse.lastChunkIndex,
        last_routing: msgfPulse.last_routing,
        routings: msgfPulse.routings,
        errors: msgfPulse.errors,
        dashboard: getAuthorMsgfMappingStatus().dashboard_links,
      },
    });
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[hal/session]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Internal error",
    });
  }
});

/** Issue focus/offline HMAC lease (client seals batches locally until reconnect). */
halController.post("/api/hal/offline-lease", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const tenantId = assertUuid(String(body.tenantId ?? ""), "tenantId");
    const manuscriptId = String(body.manuscriptId ?? "").trim();
    if (!manuscriptId) {
      return res.status(400).json({ error: "manuscriptId is required" });
    }

    let authorUserId: string | null = null;
    const bearer = tryReadBearerUser(req);
    if (bearer?.userId) authorUserId = bearer.userId;
    else if (body.authorUserId != null && String(body.authorUserId).trim()) {
      authorUserId = assertUuid(String(body.authorUserId), "authorUserId");
    }

    const extensionInstanceId =
      String(body.extensionInstanceId ?? body.extension_instance_id ?? "").trim() ||
      "chrome-extension";

    const lease = await issueHalOfflineLease({
      supabase: getSupabaseAdmin(),
      tenantId,
      manuscriptId,
      authorUserId,
      extensionInstanceId,
    });
    return res.status(201).json({ ok: true, ...lease });
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[hal/offline-lease]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Internal error",
    });
  }
});

halController.post("/api/hal/offline-lease/renew", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const renewed = await renewHalOfflineLease({
      supabase: getSupabaseAdmin(),
      leaseId: String(body.lease_id ?? body.leaseId ?? ""),
      tenantId: String(body.tenantId ?? ""),
      signingMaterial: String(body.signing_material ?? body.signingMaterial ?? ""),
    });
    return res.status(200).json({ ok: true, ...renewed });
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[hal/offline-lease/renew]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Internal error",
    });
  }
});

/** Verify sealed offline batches and persist full-value HAL ledger row. */
halController.post("/api/hal/offline-resync", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    let authorUserId: string | null = null;
    const bearer = tryReadBearerUser(req);
    if (bearer?.userId) authorUserId = bearer.userId;
    else if (body.authorUserId != null && String(body.authorUserId).trim()) {
      authorUserId = assertUuid(String(body.authorUserId), "authorUserId");
    }

    const result = await acceptHalOfflineResync({
      supabase: getSupabaseAdmin(),
      tenantId: String(body.tenantId ?? ""),
      manuscriptId: String(body.manuscriptId ?? ""),
      leaseId: String(body.lease_id ?? body.leaseId ?? ""),
      signingMaterial: String(body.signing_material ?? body.signingMaterial ?? ""),
      batches: (Array.isArray(body.batches) ? body.batches : []) as SealedHalBatch[],
      locale: body.locale,
      authorUserId,
      contentDelta: typeof body.contentDelta === "string" ? body.contentDelta : undefined,
    });
    return res.status(result.status).json(result.body);
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[hal/offline-resync]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Internal error",
    });
  }
});

const LOGIC_OUTCOMES = new Set(["LOGIC_WARNING", "AUDIT_PASSED", "CONFLICT_RESOLVED"]);

/** Persist Plot Sandbox narrative logic audit outcome on `p4_hal_ledger` (human oversight proof). */
halController.post("/api/hal/narrative-logic-proof", async (req: Request, res: Response) => {
  try {
    const user = readBearerUser(req, res);
    if (!user) return;

    const body = req.body as Record<string, unknown>;
    const tenantId = assertUuid(String(body.tenant_id ?? ""), "tenant_id");
    const manuscriptId = assertUuid(String(body.manuscript_id ?? ""), "manuscript_id");
    const scene_card_id = String(body.scene_card_id ?? "").trim() || randomUUID();
    const scene_index = Number(body.scene_index);
    if (!Number.isFinite(scene_index) || scene_index < 0) {
      return res.status(400).json({ error: "scene_index must be a non-negative number" });
    }

    let outcome = String(body.outcome ?? "AUDIT_PASSED").trim().toUpperCase().replace(/\s+/g, "_");
    if (!LOGIC_OUTCOMES.has(outcome)) outcome = "AUDIT_PASSED";

    const logic_warning = body.logic_warning != null ? String(body.logic_warning).trim() : null;
    const librarian_reply = String(body.librarian_reply ?? "").trim();
    const environment = String(body.environment ?? "");
    const cast = String(body.cast ?? "");
    const logic_hooks = String(body.logic_hooks ?? "");
    const scene_label = body.scene_label != null ? String(body.scene_label) : null;

    const narrative_logic_explanation =
      outcome === "LOGIC_WARNING"
        ? (logic_warning || librarian_reply).slice(0, 2000)
        : (librarian_reply || logic_warning || "").slice(0, 2000);

    const supabase = getSupabaseAdmin();
    const sess = await assertBffManuscriptTenantSession(supabase, { manuscriptId, tenantId });
    if (!sess.ok) {
      const status = /not found/i.test(sess.reason) ? 404 : 403;
      return res.status(status).json({ error: sess.reason });
    }

    let author_user_id: string | null = null;
    try {
      author_user_id = assertUuid(user.userId, "author_user_id");
    } catch {
      author_user_id = null;
    }

    const sessionId = randomUUID();
    const raw_sample = {
      manuscriptId,
      narrative_logic_proof: true,
      narrative_logic_outcome: outcome,
      narrative_logic_explanation,
      scene_card_id,
      scene_index,
      scene_label,
      environment,
      cast,
      logic_hooks,
      logic_warning: logic_warning || null,
      librarian_reply: librarian_reply.slice(0, 4000),
    };

    const stylometric_snapshot = {
      narrative_logic_proof: true,
      narrative_logic_outcome: outcome,
    };

    const { data: inserted, error: insErr } = await supabase
      .from(P4_HAL_LEDGER)
      .insert({
        tenant_id: tenantId,
        author_user_id,
        session_id: sessionId,
        keystroke_latency_ms: [],
        manual_word_count: 0,
        ai_assisted_word_count: 0,
        stylometric_snapshot,
        raw_sample,
      })
      .select("id, created_at")
      .single();

    if (insErr) {
      console.error("[hal/narrative-logic-proof] insert", insErr.message);
      return res.status(500).json({ error: insErr.message });
    }

    return res.status(201).json({
      ok: true,
      hal_ledger_id: inserted.id,
      created_at: inserted.created_at,
      narrative_logic_outcome: outcome,
    });
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[hal/narrative-logic-proof]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Internal error",
    });
  }
});
