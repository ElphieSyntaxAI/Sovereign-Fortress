import { randomUUID } from "node:crypto";

import { processCalibration, schoolEncryptionKeyFromEnv } from "@elphie-syntax/core/lib/forensics/calibration";
import { Router, type Request, type Response } from "express";

import { LinguisticAnalyzer } from "../lib/forensics/linguistics.js";
import {
  HalRollingBaselineRow,
  linguisticMatchFactor,
  maxRelativeDriftAgainstBaseline,
} from "../lib/halLinguisticFactor.js";
import {
  assertUuid,
  computeHalScore,
  HalValidationError,
  parseHalLocale,
  resolveHalImeRhythm,
  rhythmAnomalyThresholdForLocale,
  stylometricFromContentDelta,
  varianceSample,
} from "../lib/halMetrics.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

/** Allowed structured reasons for audit / UI. */
export const RECALIBRATION_REASON_CODES = [
  "physical_change",
  "hardware_change",
  "time_decay",
  "injury",
  "time_gap",
  "other",
] as const;

export type RecalibrationReasonCode = (typeof RECALIBRATION_REASON_CODES)[number];

type RecalibrateBody = {
  tenantId?: unknown;
  tenantScope?: unknown;
  reason?: unknown;
  reasonDetail?: unknown;
  contentDelta?: unknown;
  keystrokeLatencies?: unknown;
  manuscriptId?: unknown;
  authorUserId?: unknown;
  keystrokeDna?: unknown;
  locale?: unknown;
  isImeSession?: unknown;
  compositionEvents?: unknown;
  committedBlockLatenciesMs?: unknown;
  compositionBlocks?: unknown;
};

function isReasonCode(s: string): s is RecalibrationReasonCode {
  return (RECALIBRATION_REASON_CODES as readonly string[]).includes(s);
}

const linguisticAnalyzer = new LinguisticAnalyzer();

export const recalibrationController = Router();

/**
 * POST /api/forensics/recalibrate
 * Establishes a new bridge baseline: HAL row (IDENTITY_ROOT + recalibration), new p4_forensic_profiles row (encrypted for schools), audit log.
 */
recalibrationController.post("/api/forensics/recalibrate", async (req: Request, res: Response) => {
  try {
    const body = req.body as RecalibrateBody;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "JSON body required" });
    }

    const reasonRaw = String(body.reason ?? "").trim();
    if (!reasonRaw || !isReasonCode(reasonRaw)) {
      return res.status(400).json({
        error: "reason is required",
        allowed: RECALIBRATION_REASON_CODES,
      });
    }
    const reason = reasonRaw as RecalibrationReasonCode;

    const tenantId = assertUuid(String(body.tenantId ?? ""), "tenantId");

    const scopeRaw = String(body.tenantScope ?? "author").toLowerCase().trim();
    if (scopeRaw !== "author" && scopeRaw !== "school") {
      return res.status(400).json({ error: "tenantScope must be 'author' or 'school'" });
    }
    const isSchool = scopeRaw === "school";

    const manuscriptId =
      String(body.manuscriptId ?? "").trim() || "forensic-bridge-recalibration";

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

    if (!contentDelta.trim()) {
      return res.status(400).json({ error: "contentDelta is required for bridge calibration" });
    }

    const reasonDetail =
      typeof body.reasonDetail === "string" ? body.reasonDetail.trim() || null : null;
    const recalibrationReasonFull = reasonDetail ? `${reason}: ${reasonDetail}` : reason;

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

    const { data: rollingRow, error: rollingError } = await supabase
      .from("p4_hal_ledger_rolling_avg_5")
      .select(
        "tenant_id,sample_sessions,avg_ttr,avg_avg_sentence_length_words,avg_punctuation_frequency,avg_function_word_weight,avg_sentence_length_std_dev"
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (rollingError) {
      console.error("[forensics/recalibrate] rolling baseline error:", rollingError.message);
      return res.status(500).json({
        error: "Failed to load linguistic baseline",
        detail: rollingError.message,
      });
    }

    const baseline = rollingRow as HalRollingBaselineRow | null;
    const maxRelativeDelta = baseline
      ? maxRelativeDriftAgainstBaseline(linguisticProfile, baseline)
      : null;
    const matchFactor = linguisticMatchFactor(maxRelativeDelta);
    const majorLinguisticDrift = maxRelativeDelta != null && maxRelativeDelta > 0.2;
    const halScoreFinal = typingScore * matchFactor;

    let authorUserId: string | null = null;
    if (body.authorUserId != null && String(body.authorUserId).trim() !== "") {
      authorUserId = assertUuid(String(body.authorUserId), "authorUserId");
    }

    const sessionId = randomUUID();
    const keystrokeDna =
      body.keystrokeDna != null && typeof body.keystrokeDna === "object"
        ? (body.keystrokeDna as Record<string, unknown>)
        : null;

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
      linguistic_match_factor: Math.round(matchFactor * 10000) / 10000,
      typing_score: Math.round(typingScore * 10000) / 10000,
      hal_score_final: Math.round(halScoreFinal * 10000) / 10000,
      identity_marker: "IDENTITY_ROOT" as const,
      bridge_profile: true as const,
      recalibration_event: true as const,
      recalibration_reason_code: reason,
      ...(reasonDetail ? { recalibration_reason_detail: reasonDetail } : {}),
    };

    const raw_sample = {
      manuscriptId,
      locale,
      is_ime_session: rhythm.isImeSession,
      rhythm_anomaly_threshold: rhythmAnomalyThreshold,
      hal_score: Math.round(halScoreFinal * 10000) / 10000,
      typing_score: Math.round(typingScore * 10000) / 10000,
      linguistic_match_factor: Math.round(matchFactor * 10000) / 10000,
      manual_keystrokes: rhythm.rawKeystrokeLatencyMs.length,
      rhythm_unit_count: manualKeystrokes,
      total_words: totalWords,
      latency_variance: Math.round(latencyVariance * 100) / 100,
      latency_count: latencyMs.length,
      ...(rhythm.rawKeystrokeLatencyMs.length !== latencyMs.length || rhythm.isImeSession
        ? { raw_keystroke_latency_ms: rhythm.rawKeystrokeLatencyMs }
        : {}),
      session_marker: "IDENTITY_ROOT" as const,
      bridge_recalibration: true as const,
      recalibration_reason_code: reason,
      ...(keystrokeDna ? { keystroke_dna: keystrokeDna } : {}),
    };

    const { id: forensicProfileId, calibration, encrypted } = await processCalibration(supabase, {
      tenantId,
      tenantScope: isSchool ? "school_tenant" : "author",
      rawText: contentDelta,
      latencyMs: rawLatencies,
      committedBlockLatenciesMs: rhythm.isImeSession ? rhythm.latencyMsForRhythm : undefined,
      is_ime_session: rhythm.isImeSession,
      locale,
      resolveSchoolEncryptionKey: isSchool
        ? (id) => Promise.resolve(schoolEncryptionKeyFromEnv(id))
        : undefined,
    });

    const { error: forensicUpdateError } = await supabase
      .from("p4_forensic_profiles")
      .update({
        recalibration_event: true,
        recalibration_reason: recalibrationReasonFull,
      })
      .eq("id", forensicProfileId);

    if (forensicUpdateError) {
      console.error("[forensics/recalibrate] forensic profile update error:", forensicUpdateError.message);
      return res.status(500).json({
        error: "Failed to tag forensic bridge profile",
        detail: forensicUpdateError.message,
      });
    }

    const rawSampleWithProfile = {
      ...raw_sample,
      forensic_profile_id: forensicProfileId,
    };

    const { data: halRow, error: halError } = await supabase
      .from("p4_hal_ledger")
      .insert({
        tenant_id: tenantId,
        author_user_id: authorUserId,
        session_id: sessionId,
        keystroke_latency_ms: latencyMs,
        manual_word_count: totalWords,
        ai_assisted_word_count: 0,
        stylometric_snapshot: {
          ...stylometric_snapshot,
          forensic_profile_id: forensicProfileId,
        },
        raw_sample: rawSampleWithProfile,
        recalibration_event: true,
        recalibration_reason: recalibrationReasonFull,
      })
      .select("id, session_id, created_at")
      .single();

    if (halError) {
      console.error("[forensics/recalibrate] HAL insert error:", halError.message);
      return res.status(500).json({ error: "Failed to persist HAL recalibration", detail: halError.message });
    }

    const halLedgerId = halRow.id as string;

    const { error: logError } = await supabase.from("p4_recalibration_logs").insert({
      tenant_id: tenantId,
      hal_ledger_id: halLedgerId,
      recalibration_reason: reason,
      notes: reasonDetail,
      metadata: {
        forensic_profile_id: forensicProfileId,
        tenant_scope: scopeRaw,
        bridge_profile: true,
      },
    });

    if (logError) {
      console.error("[forensics/recalibrate] audit log error:", logError.message);
      return res.status(500).json({
        error: "Failed to write recalibration audit log",
        detail: logError.message,
      });
    }

    return res.status(201).json({
      ok: true,
      baselineReset: true,
      status: "Baseline Reset",
      reason,
      locale,
      rhythmAnomalyThreshold,
      is_ime_session: rhythm.isImeSession,
      identityRoot: {
        marker: "IDENTITY_ROOT",
        halLedgerId,
        sessionId: halRow.session_id,
        forensicProfileId,
        createdAt: halRow.created_at,
        keystrokeSeriesDigest: calibration.keystroke_fingerprint.series_digest,
        calibrationTimestamp: calibration.timestamp,
      },
      profileEncrypted: encrypted,
      halScore: raw_sample.hal_score,
      typingScore: raw_sample.typing_score,
      linguisticMatchFactor: raw_sample.linguistic_match_factor,
    });
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[forensics/recalibrate]", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Internal error",
    });
  }
});
