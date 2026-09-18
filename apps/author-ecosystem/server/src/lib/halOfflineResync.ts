/**
 * Issue / renew offline HAL leases and accept sealed resync (full-value authorship).
 */

import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  P4_HAL_LEDGER,
  P4_HAL_LEDGER_ROLLING_AVG_5,
  P4_HAL_OFFLINE_ACCEPTED_BATCHES,
  P4_HAL_OFFLINE_LEASES,
} from "./database/canonicalIdentifiers.js";
import { LinguisticAnalyzer } from "./forensics/linguistics.js";
import {
  linguisticMatchFactor,
  maxRelativeDriftAgainstBaseline,
  type HalRollingBaselineRow,
} from "./halLinguisticFactor.js";
import {
  computeHalScore,
  HalValidationError,
  parseHalLocale,
  rhythmAnomalyThresholdForLocale,
  stylometricFromContentDelta,
  varianceSample,
  assertUuid,
} from "./halMetrics.js";
import {
  generateLeaseSecret,
  hashLeaseSecret,
  HAL_OFFLINE_CLOCK_SKEW_MS,
  HAL_OFFLINE_MAX_BATCHES,
  HAL_OFFLINE_MAX_EVENTS,
  HAL_OFFLINE_MAX_HOURS,
  latenciesFromSealedEvents,
  eventsAsDna,
  safeEqualHex,
  verifySealedBatchChain,
  type SealedHalBatch,
} from "./halOfflineSeal.js";
import {
  httpStatusForTamper,
  runHalTamperChecks,
  type HalDnaEventLike,
} from "./halTamperChecks.js";

const linguisticAnalyzer = new LinguisticAnalyzer();

export type IssueLeaseParams = {
  supabase: SupabaseClient;
  tenantId: string;
  manuscriptId: string;
  authorUserId: string | null;
  extensionInstanceId: string;
};

export async function issueHalOfflineLease(params: IssueLeaseParams): Promise<{
  lease_id: string;
  expires_at: string;
  signing_material: string;
  max_events: number;
  max_batches: number;
  genesis_prev_hash: string;
}> {
  const tenantId = assertUuid(params.tenantId, "tenantId");
  const manuscriptId = String(params.manuscriptId ?? "").trim();
  if (!manuscriptId) throw new HalValidationError("manuscriptId is required");
  const extensionInstanceId = String(params.extensionInstanceId ?? "").trim() || "unknown-extension";

  const secret = generateLeaseSecret();
  const secretHash = hashLeaseSecret(secret);
  const expiresAt = new Date(Date.now() + HAL_OFFLINE_MAX_HOURS * 60 * 60 * 1000);

  const { data, error } = await params.supabase
    .from(P4_HAL_OFFLINE_LEASES)
    .insert({
      tenant_id: tenantId,
      manuscript_id: manuscriptId,
      author_user_id: params.authorUserId,
      extension_instance_id: extensionInstanceId,
      secret_hash: secretHash,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, expires_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to issue offline lease");
  }

  return {
    lease_id: data.id as string,
    expires_at: data.expires_at as string,
    signing_material: secret,
    max_events: HAL_OFFLINE_MAX_EVENTS,
    max_batches: HAL_OFFLINE_MAX_BATCHES,
    genesis_prev_hash: "0000000000000000000000000000000000000000000000000000000000000000",
  };
}

export async function renewHalOfflineLease(params: {
  supabase: SupabaseClient;
  leaseId: string;
  tenantId: string;
  signingMaterial: string;
}): Promise<{ lease_id: string; expires_at: string }> {
  const leaseId = assertUuid(params.leaseId, "lease_id");
  const tenantId = assertUuid(params.tenantId, "tenantId");
  const secretHash = hashLeaseSecret(String(params.signingMaterial ?? ""));

  const { data: lease, error } = await params.supabase
    .from(P4_HAL_OFFLINE_LEASES)
    .select("id, secret_hash, revoked_at, expires_at")
    .eq("id", leaseId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!lease) throw new HalValidationError("Lease not found");
  if (lease.revoked_at) throw new HalValidationError("Lease revoked");
  if (!safeEqualHex(String(lease.secret_hash), secretHash)) {
    throw new HalValidationError("Invalid signing material");
  }

  const expiresAt = new Date(Date.now() + HAL_OFFLINE_MAX_HOURS * 60 * 60 * 1000);
  const { data: updated, error: updErr } = await params.supabase
    .from(P4_HAL_OFFLINE_LEASES)
    .update({
      expires_at: expiresAt.toISOString(),
      renewed_at: new Date().toISOString(),
    })
    .eq("id", leaseId)
    .select("id, expires_at")
    .single();

  if (updErr || !updated) throw new Error(updErr?.message || "Failed to renew lease");
  return { lease_id: updated.id as string, expires_at: updated.expires_at as string };
}

function contentFingerprintFromBatches(batches: SealedHalBatch[]): string | null {
  const parts = batches
    .map((b) => b.content_fingerprint)
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  if (parts.length === 0) return null;
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export type OfflineResyncResult =
  | {
      ok: true;
      status: 201;
      body: Record<string, unknown>;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

export async function acceptHalOfflineResync(params: {
  supabase: SupabaseClient;
  tenantId: string;
  manuscriptId: string;
  leaseId: string;
  signingMaterial: string;
  batches: SealedHalBatch[];
  locale?: unknown;
  authorUserId?: string | null;
  contentDelta?: string;
}): Promise<OfflineResyncResult> {
  const tenantId = assertUuid(params.tenantId, "tenantId");
  const manuscriptId = String(params.manuscriptId ?? "").trim();
  if (!manuscriptId) {
    return { ok: false, status: 400, body: { error: "manuscriptId is required" } };
  }
  const leaseId = assertUuid(params.leaseId, "lease_id");
  const secret = String(params.signingMaterial ?? "");
  if (!secret) {
    return { ok: false, status: 400, body: { error: "signing_material is required" } };
  }
  const batches = Array.isArray(params.batches) ? params.batches : [];
  if (batches.length === 0) {
    return { ok: false, status: 400, body: { error: "batches required" } };
  }
  if (batches.length > HAL_OFFLINE_MAX_BATCHES) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: ["caps_exceeded"],
        reasons: [`Batch count exceeds ${HAL_OFFLINE_MAX_BATCHES}`],
      },
    };
  }

  const { data: lease, error: leaseErr } = await params.supabase
    .from(P4_HAL_OFFLINE_LEASES)
    .select("id, tenant_id, manuscript_id, secret_hash, expires_at, revoked_at, created_at")
    .eq("id", leaseId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (leaseErr) {
    return { ok: false, status: 500, body: { error: leaseErr.message } };
  }
  if (!lease) {
    return { ok: false, status: 404, body: { error: "Lease not found" } };
  }
  if (lease.revoked_at) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: ["seal_integrity"],
        reasons: ["Lease revoked"],
      },
    };
  }
  if (String(lease.manuscript_id) !== manuscriptId) {
    return { ok: false, status: 400, body: { error: "manuscriptId does not match lease" } };
  }
  if (new Date(String(lease.expires_at)).getTime() < Date.now()) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: ["seal_integrity"],
        reasons: ["Lease expired"],
      },
    };
  }
  if (!safeEqualHex(String(lease.secret_hash), hashLeaseSecret(secret))) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: ["seal_integrity"],
        reasons: ["Invalid HMAC signing material"],
      },
    };
  }

  const { data: lastAccepted } = await params.supabase
    .from(P4_HAL_OFFLINE_ACCEPTED_BATCHES)
    .select("batch_hash, created_at")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const chainStart =
    lastAccepted?.batch_hash && typeof lastAccepted.batch_hash === "string"
      ? String(lastAccepted.batch_hash)
      : undefined;

  const chain = verifySealedBatchChain({
    leaseId,
    manuscriptId,
    secret,
    batches,
    genesisPrevHash: chainStart,
  });
  if (!chain.ok) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: ["seal_integrity"],
        reasons: [`${chain.code}: ${chain.detail}`],
      },
    };
  }

  const batchIds = batches.map((b) => b.batch_id);
  const { data: existingBatches } = await params.supabase
    .from(P4_HAL_OFFLINE_ACCEPTED_BATCHES)
    .select("batch_id")
    .eq("tenant_id", tenantId)
    .eq("manuscript_id", manuscriptId)
    .in("batch_id", batchIds);

  const already = new Set((existingBatches ?? []).map((r) => String(r.batch_id)));
  const replayHit = batchIds.some((id) => already.has(id));

  const allEvents = batches.flatMap((b) => b.events);
  if (allEvents.length > HAL_OFFLINE_MAX_EVENTS) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: ["caps_exceeded"],
        reasons: [`Event count exceeds ${HAL_OFFLINE_MAX_EVENTS}`],
      },
    };
  }

  const startedAt = new Date(batches[0]!.started_at);
  const endedAt = new Date(batches[batches.length - 1]!.ended_at);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: ["seal_integrity"],
        reasons: ["Invalid batch started_at/ended_at"],
      },
    };
  }
  const leaseCreated = new Date(String(lease.created_at)).getTime();
  if (endedAt.getTime() - leaseCreated > HAL_OFFLINE_MAX_HOURS * 60 * 60 * 1000 + HAL_OFFLINE_CLOCK_SKEW_MS) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: ["clock_skew"],
        reasons: ["Offline span exceeds lease window"],
      },
    };
  }

  // Cross-path: live session for same manuscript whose created_at falls inside sealed window
  // (prevents double-claiming the same writing period as both live and sealed).
  const windowStart = new Date(startedAt.getTime() - 5 * 60 * 1000).toISOString();
  const windowEnd = new Date(endedAt.getTime() + 5 * 60 * 1000).toISOString();
  const { data: liveHits } = await params.supabase
    .from(P4_HAL_LEDGER)
    .select("id, created_at, raw_sample, sync_mode")
    .eq("tenant_id", tenantId)
    .gte("created_at", windowStart)
    .lte("created_at", windowEnd)
    .limit(40);

  const overlapsLive = (liveHits ?? []).some((row) => {
    const mode = row.sync_mode ?? (row.raw_sample as { sync_mode?: string } | null)?.sync_mode;
    if (mode === "offline_sealed") return false;
    const rs = row.raw_sample as { manuscriptId?: string } | null;
    return rs?.manuscriptId === manuscriptId;
  });

  const locale = parseHalLocale(params.locale);
  const latencyMs = latenciesFromSealedEvents(allEvents);
  const dna = eventsAsDna(allEvents);
  const contentDelta =
    typeof params.contentDelta === "string"
      ? params.contentDelta
      : `[AuthorEcosystem offline_sealed manuscript=${manuscriptId} tenant=${tenantId}]\n`;
  const style = stylometricFromContentDelta(contentDelta, locale);
  const wordEstimate = batches.reduce(
    (s, b) => s + (Number.isFinite(Number(b.word_count_estimate)) ? Number(b.word_count_estimate) : 0),
    0
  );
  const totalWords = Math.max(style.word_count, Math.round(wordEstimate));

  const linguisticProfile = linguisticAnalyzer.extract(contentDelta, locale);
  const linguisticAnomalies = linguisticAnalyzer.detectAnomalies(linguisticProfile);
  const anomalyCount = Object.values(linguisticAnomalies as Record<string, boolean>).filter(Boolean).length;

  const tamper = runHalTamperChecks({
    locale,
    latencyMs,
    events: dna as HalDnaEventLike[],
    claimedTypedWords: totalWords,
    contentDelta,
    linguisticAnomalyCount: anomalyCount,
    startedAt,
    endedAt,
    serverNow: new Date(),
    clockSkewMs: HAL_OFFLINE_CLOCK_SKEW_MS,
    eventCount: allEvents.length,
    batchCount: batches.length,
    batchAlreadyAccepted: replayHit,
    overlapsLiveSession: overlapsLive,
  });

  if (!tamper.ok) {
    return {
      ok: false,
      status: httpStatusForTamper(tamper),
      body: {
        error: "Could not verify session integrity",
        tamper_result: "rejected",
        hard: tamper.hard,
        soft: tamper.soft,
        reasons: tamper.reasons,
      },
    };
  }

  const typingScore = computeHalScore(latencyMs.length, totalWords, latencyMs, locale, {});
  const latencyVariance = varianceSample(latencyMs);
  const rhythmAnomalyThreshold = rhythmAnomalyThresholdForLocale(locale);

  const { data: rollingRow, error: rollingError } = await params.supabase
    .from(P4_HAL_LEDGER_ROLLING_AVG_5)
    .select(
      "tenant_id,sample_sessions,avg_ttr,avg_avg_sentence_length_words,avg_punctuation_frequency,avg_function_word_weight,avg_sentence_length_std_dev"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (rollingError) {
    return {
      ok: false,
      status: 500,
      body: { error: "Failed to load linguistic baseline", detail: rollingError.message },
    };
  }

  const baseline = rollingRow as HalRollingBaselineRow | null;
  const sampleSessions = baseline?.sample_sessions ?? 0;
  const isTrainingPhase = sampleSessions < 3;
  const maxRelativeDelta = baseline
    ? maxRelativeDriftAgainstBaseline(linguisticProfile, baseline)
    : null;
  const matchFactorFromDrift = linguisticMatchFactor(maxRelativeDelta);
  const linguisticMatchFactorEffective = isTrainingPhase ? 1.0 : matchFactorFromDrift;
  const majorLinguisticDrift =
    !isTrainingPhase && maxRelativeDelta != null && maxRelativeDelta > 0.2;
  const halScoreFinal = typingScore * linguisticMatchFactorEffective;

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
    is_ime_session: false,
    sync_mode: "offline_sealed" as const,
    rhythm_anomaly_threshold: rhythmAnomalyThreshold,
    text_segmentation: style.segmentation,
    average_sentence_length: style.average_sentence_length_words,
    vocabulary_variety: style.vocabulary_variety,
    sentence_count: style.sentence_count,
    word_count: totalWords,
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
    tamper_flags: tamper.soft,
  };

  const raw_sample = {
    manuscriptId,
    locale,
    sync_mode: "offline_sealed" as const,
    lease_id: leaseId,
    batch_ids: batchIds,
    hal_trust_tier: "sealed" as const,
    connectivity: "offline_sealed" as const,
    is_ime_session: false,
    rhythm_anomaly_threshold: rhythmAnomalyThreshold,
    hal_score: Math.round(halScoreFinal * 10000) / 10000,
    typing_score: Math.round(typingScore * 10000) / 10000,
    linguistic_match_factor: Math.round(linguisticMatchFactorEffective * 10000) / 10000,
    is_training_phase: isTrainingPhase,
    manual_keystrokes: latencyMs.length,
    rhythm_unit_count: latencyMs.length,
    total_words: totalWords,
    latency_variance: Math.round(latencyVariance * 100) / 100,
    latency_count: latencyMs.length,
    tamper_flags: tamper.soft,
    keystroke_dna: {
      manuscriptId,
      tenantId,
      source: "chrome-extension-offline-sealed",
      events: dna,
    },
    sealed_window: {
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
    },
  };

  const fp = contentFingerprintFromBatches(batches);

  const { data: inserted, error: insertErr } = await params.supabase
    .from(P4_HAL_LEDGER)
    .insert({
      tenant_id: tenantId,
      author_user_id: params.authorUserId,
      session_id: sessionId,
      keystroke_latency_ms: latencyMs,
      manual_word_count: totalWords,
      ai_assisted_word_count: 0,
      stylometric_snapshot,
      raw_sample,
      sync_mode: "offline_sealed",
      ...(fp ? { content_hash: fp } : {}),
      session_start: startedAt.toISOString(),
      session_end: endedAt.toISOString(),
    })
    .select("id, session_id, created_at")
    .single();

  if (insertErr || !inserted) {
    return {
      ok: false,
      status: 500,
      body: { error: "Failed to persist sealed HAL session", detail: insertErr?.message },
    };
  }

  const acceptRows = batches.map((b) => ({
    tenant_id: tenantId,
    manuscript_id: manuscriptId,
    lease_id: leaseId,
    batch_id: b.batch_id,
    batch_hash: b.batch_hash,
    hal_ledger_id: inserted.id,
    started_at: b.started_at,
    ended_at: b.ended_at,
  }));

  const { error: acceptErr } = await params.supabase
    .from(P4_HAL_OFFLINE_ACCEPTED_BATCHES)
    .insert(acceptRows);

  if (acceptErr) {
    console.error("[hal/offline-resync] accepted batch insert:", acceptErr.message);
  }

  return {
    ok: true,
    status: 201,
    body: {
      ok: true,
      sync_mode: "offline_sealed",
      id: inserted.id,
      sessionId: inserted.session_id,
      createdAt: inserted.created_at,
      typingScore: raw_sample.typing_score,
      linguisticMatchFactor: raw_sample.linguistic_match_factor,
      halScore: raw_sample.hal_score,
      is_training_phase: isTrainingPhase,
      tamper_flags: tamper.soft,
      batches_accepted: batchIds.length,
      message: "Sealed offline — verified",
    },
  };
}
