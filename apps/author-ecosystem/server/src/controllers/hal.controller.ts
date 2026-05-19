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
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { forwardAuthorPulseToMsgf, latenciesToUniversalKeystrokes } from "../lib/msgfPulseBridge.js";
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
};

export const halController = Router();

const linguisticAnalyzer = new LinguisticAnalyzer();

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

    const identityRoot = body.identityRoot === true;
    const keystrokeDna =
      body.keystrokeDna != null && typeof body.keystrokeDna === "object"
        ? (body.keystrokeDna as Record<string, unknown>)
        : null;
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
        recalibration_event: recalibrationEvent,
        recalibration_reason: recalibrationReason,
      })
      .select("id, session_id, created_at")
      .single();

    if (error) {
      console.error("[hal/session] Supabase insert error:", error.message);
      return res.status(500).json({ error: "Failed to persist HAL session", detail: error.message });
    }

    const msgfPulse =
      process.env.MSGF_AUTHOR_HAL_PULSE_ENABLED?.trim().toLowerCase() === "0"
        ? {
            ok: false,
            configured: true,
            status: null,
            url: null,
            response: null,
            error: "Disabled by MSGF_AUTHOR_HAL_PULSE_ENABLED=0.",
          }
        : await forwardAuthorPulseToMsgf({
            userId: authorUserId || sessionId,
            tenantId,
            body: {
              keystrokes: latenciesToUniversalKeystrokes(latencyMs, {
                target: `author:${manuscriptId}`,
              }),
            },
            idempotencyKey: `hal:${sessionId}`,
          });

    return res.status(201).json({
      ok: true,
      id: data.id,
      sessionId: data.session_id,
      createdAt: data.created_at,
      locale,
      rhythmAnomalyThreshold,
      is_ime_session: rhythm.isImeSession,
      typingScore: raw_sample.typing_score,
      linguisticMatchFactor: raw_sample.linguistic_match_factor,
      halScore: raw_sample.hal_score,
      is_training_phase: isTrainingPhase,
      identityRoot,
      recalibrationEvent,
      stylometric_snapshot,
      msgf_pulse: {
        ok: msgfPulse.ok,
        configured: msgfPulse.configured,
        status: msgfPulse.status,
        error: msgfPulse.error,
        response: msgfPulse.response,
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
