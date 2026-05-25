import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { P4_HAL_LEDGER } from "./database/canonicalIdentifiers.js";
import {
  computeHalScore,
  parseHalLocale,
  resolveHalImeRhythm,
  stylometricFromContentDelta,
  varianceSample,
} from "./halMetrics.js";
import { syncAuthorHalChunksToMsgf } from "./authorHalMsgfSync.js";
import { extractHalDnaEvents } from "./halDnaEvents.js";

export async function recordHalStartupSession(params: {
  supabase: SupabaseClient;
  tenantId: string;
  authorUserId: string;
  manuscriptId: string;
  content: string;
  keystrokeLatencies: number[];
  keystrokeDna?: Record<string, unknown> | null;
  locale?: string;
}): Promise<{ ledgerId: string; sessionId: string; wordCount: number }> {
  const content = params.content.trim();
  if (!content) throw new Error("Startup typing content is required");

  const locale = parseHalLocale(params.locale);
  const rhythm = resolveHalImeRhythm({
    keystrokeLatencies: params.keystrokeLatencies,
    isImeSession: false,
    compositionEvents: undefined,
    committedBlockLatenciesMs: undefined,
    compositionBlocks: undefined,
  });
  const style = stylometricFromContentDelta(content, locale);
  const typingScore = computeHalScore(
    rhythm.rhythmUnitCount,
    style.word_count,
    rhythm.latencyMsForRhythm,
    locale,
    { isImeSession: false }
  );
  const sessionId = randomUUID();
  const halScoreFinal = typingScore;

  const stylometric_snapshot = {
    locale,
    is_ime_session: false,
    identity_marker: "IDENTITY_ROOT" as const,
    onboarding_hal_startup: true,
    word_count: style.word_count,
    typing_score: Math.round(typingScore * 10000) / 10000,
    hal_score_final: Math.round(halScoreFinal * 10000) / 10000,
  };

  const raw_sample = {
    manuscriptId: params.manuscriptId,
    session_marker: "IDENTITY_ROOT" as const,
    onboarding_hal_startup: true,
    hal_score: Math.round(halScoreFinal * 10000) / 10000,
    total_words: style.word_count,
    latency_variance: Math.round(varianceSample(rhythm.latencyMsForRhythm) * 100) / 100,
    ...(params.keystrokeDna ? { keystroke_dna: params.keystrokeDna } : {}),
  };

  const { data, error } = await params.supabase
    .from(P4_HAL_LEDGER)
    .insert({
      tenant_id: params.tenantId,
      author_user_id: params.authorUserId,
      session_id: sessionId,
      keystroke_latency_ms: rhythm.latencyMsForRhythm,
      manual_word_count: style.word_count,
      ai_assisted_word_count: 0,
      stylometric_snapshot,
      raw_sample,
      recalibration_event: false,
      recalibration_reason: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`HAL startup ledger insert: ${error.message}`);

  const dnaEvents = extractHalDnaEvents(params.keystrokeDna ?? null, rhythm.rawKeystrokeLatencyMs);
  if (process.env.MSGF_AUTHOR_HAL_PULSE_ENABLED?.trim().toLowerCase() !== "0") {
    try {
      await syncAuthorHalChunksToMsgf({
        userId: params.authorUserId,
        tenantId: params.tenantId,
        manuscriptId: params.manuscriptId,
        contentDelta: content,
        events: dnaEvents,
        halScore: halScoreFinal,
        typingScore,
        locale,
        isImeSession: false,
        rhythmUnitCount: rhythm.rhythmUnitCount,
        wordCount: style.word_count,
        isTrainingPhase: true,
        sessionId,
      });
    } catch (e) {
      console.warn("[halStartup] MSGF sync", e);
    }
  }

  return {
    ledgerId: String(data.id),
    sessionId,
    wordCount: style.word_count,
  };
}
