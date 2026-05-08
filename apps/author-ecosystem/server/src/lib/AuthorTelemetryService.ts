/**
 * Author-facing telemetry: recent HAL linguistic snapshots, growth deltas, and outline-based milestones.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { craftSessionFromStylometricSnapshot } from "./AuthorSovereigntyService.js";

/** One HAL session row reduced to Growth Report metrics. */
export type LinguisticSessionSnapshot = {
  ledgerId: string;
  sessionId: string;
  createdAt: string;
  /** Unique tokens / total words in the session text sample (0–1). */
  vocabulary_density: number;
  /** Mean words per sentence for the session content delta. */
  average_sentence_length: number;
  /** Composite rhythm / stability score in [0, 1] from typing + match factor + latency variance. */
  hal_rhythm_consistency: number;
  /**
   * Composite sentence complexity (length × variability) from `linguistic_profile`,
   * aligned with `craftSessionFromStylometricSnapshot`.
   */
  sentence_complexity: number;
};

/** Delta of mean(last 5) − mean(first 5) for chronological session windows. */
export type GrowthReportSessionDelta = {
  windowFirstN: number;
  windowLastN: number;
  vocabulary_density_delta: number;
  average_sentence_length_delta: number;
  hal_rhythm_consistency_delta: number;
  /** Mean(complexity_last5) − mean(complexity_first5). */
  sentence_complexity_delta: number;
};

export type TrajectoryTag = "EVOLVING" | "STABILIZED_FLOW";

export type TrajectoryAnalysis = {
  tags: TrajectoryTag[];
  /** Coach-style copy derived from window deltas (and optional act context). */
  linguistic_insight: string;
};

export type TrajectoryAnalyzerContext = {
  /** When milestones show most progress, narrative hints reference this act. */
  dominant_act?: 1 | 2 | 3;
};

const EVOLVING_VOCAB_MIN = 0.05;
const EVOLVING_COMPLEXITY_MIN = 2;
const STABILIZED_HAL_BAND = 0.05;

/**
 * Tags + controlling linguistic feedback from first-vs-last session window deltas.
 */
export class TrajectoryAnalyzer {
  static analyze(
    delta: GrowthReportSessionDelta | null,
    context?: TrajectoryAnalyzerContext
  ): TrajectoryAnalysis {
    if (!delta) {
      return {
        tags: [],
        linguistic_insight:
          "We need at least ten recent HAL sessions to compare your opening cadence with your latest work. Keep drafting — the trajectory view will unlock soon.",
      };
    }

    const tags: TrajectoryTag[] = [];
    const vd = delta.vocabulary_density_delta;
    const sc = delta.sentence_complexity_delta;
    const hal = delta.hal_rhythm_consistency_delta;
    const asl = delta.average_sentence_length_delta;

    if (vd > EVOLVING_VOCAB_MIN && sc > EVOLVING_COMPLEXITY_MIN) {
      tags.push("EVOLVING");
    }
    if (Math.abs(hal) <= STABILIZED_HAL_BAND) {
      tags.push("STABILIZED_FLOW");
    }

    const act = context?.dominant_act;
    const actPhrase =
      act === 1
        ? "early-structure"
        : act === 2
          ? "mid-novel"
          : act === 3
            ? "climax-and-resolution"
            : "this stretch of the manuscript";

    const parts: string[] = [];

    if (tags.includes("EVOLVING")) {
      parts.push(
        `Your linguistic footprint is widening: vocabulary density rose by about ${(vd * 100).toFixed(1)} percentage points while compositional complexity climbed ~${sc.toFixed(
          2
        )} points — that pairing usually means you are layering richer diction without flattening syntax.`
      );
    }

    if (asl < -0.35) {
      parts.push(
        `Average sentence length is tightening (${asl.toFixed(2)} words/sentence vs your earlier window), which often tracks with higher-action ${actPhrase} beats where clauses stay short on purpose — similar to tightening pacing as you move into heavier plot movement.`
      );
    } else if (asl > 0.35) {
      parts.push(
        `Sentence length is opening up (+${asl.toFixed(
          2
        )} words/sentence), hinting at more reflective or expository passages; if complexity is simultaneously falling, that can signal higher-action sequences trading length for propulsion.`
      );
    }

    if (tags.includes("STABILIZED_FLOW")) {
      parts.push(
        `HAL rhythm consistency barely moved (${hal >= 0 ? "+" : ""}${hal.toFixed(
          3
        )}) — that reads as STABILIZED_FLOW: you have likely found a repeatable professional tempo between forensic check-ins.`
      );
    } else if (hal > STABILIZED_HAL_BAND) {
      parts.push(
        `Rhythm consistency strengthened (${hal.toFixed(3)}); keystroke-to-language coupling looks steadier in recent sessions.`
      );
    } else if (hal < -STABILIZED_HAL_BAND) {
      parts.push(
        `Rhythm consistency softened (${hal.toFixed(
          3
        )}); if that was intentional (for example dialogue-heavy days), no action needed — otherwise consider a short calibration session.`
      );
    }

    if (parts.length === 0) {
      parts.push(
        `Deltas are within a neutral band for this window: vocabulary ${vd >= 0 ? "up" : "down"} ${Math.abs(
          vd
        ).toFixed(3)}, complexity ${sc >= 0 ? "up" : "down"} ${Math.abs(sc).toFixed(2)}, HAL rhythm ${
          hal >= 0 ? "up" : "down"
        } ${Math.abs(hal).toFixed(3)}. Keep logging sessions so we can narrate the next inflection point.`
      );
    }

    return {
      tags,
      linguistic_insight: parts.join(" "),
    };
  }
}

export type ActMilestone = {
  act: 1 | 2 | 3;
  /** Outline word budget for this act (from plot/outline chunks). */
  outline_target_words: number;
  /** Manuscript words counted toward this act (sequential fill model). */
  manuscript_words_applied: number;
  /** 0–100 completion for this act. */
  percent_complete: number;
};

export type ProjectMilestonesResult = {
  manuscriptId: string;
  tenantId: string;
  manuscript_word_count: number;
  outline_total_words: number;
  acts: ActMilestone[];
  /** How outline acts were resolved (metadata vs fallback tertiles). */
  source: "outline_metadata" | "plot_tertiles" | "no_outline";
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function num(x: unknown, fallback = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Pull recent HAL rows for an author and map `stylometric_snapshot` / `raw_sample` into metrics.
 */
export function mapHalRowToLinguisticSessionSnapshot(row: Record<string, unknown>): LinguisticSessionSnapshot | null {
  const snap = asRecord(row["stylometric_snapshot"]);
  const raw = asRecord(row["raw_sample"]);
  const wc = num(snap["word_count"]);
  const uwc = num(snap["unique_word_count"]);
  const vocabVariety = num(snap["vocabulary_variety"]);
  const vocabulary_density =
    wc > 0 ? Math.min(1, Math.max(0, uwc / wc)) : vocabVariety > 0 ? Math.min(1, vocabVariety) : 0;

  const average_sentence_length = num(snap["average_sentence_length"]);

  const typing = num(raw["typing_score"], num(snap["typing_score"]));
  const lm = num(raw["linguistic_match_factor"], num(snap["linguistic_match_factor"], 1));
  const lv = num(raw["latency_variance"]);
  const damp = 1 / (1 + lv / 80);
  const hal_rhythm_consistency = Math.min(1, Math.max(0, typing * lm * damp));

  const craft = craftSessionFromStylometricSnapshot(snap);
  const sentence_complexity = craft?.sentenceComplexity ?? 0;

  const id = String(row["id"] ?? "");
  const sessionId = String(row["session_id"] ?? "");
  const createdAt = String(row["created_at"] ?? "");
  if (!id || !createdAt) return null;

  return {
    ledgerId: id,
    sessionId,
    createdAt,
    vocabulary_density: Math.round(vocabulary_density * 10_000) / 10_000,
    average_sentence_length: Math.round(average_sentence_length * 1000) / 1000,
    hal_rhythm_consistency: Math.round(hal_rhythm_consistency * 10_000) / 10_000,
    sentence_complexity: Math.round(sentence_complexity * 1000) / 1000,
  };
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Compare the **first 5** vs **last 5** sessions (chronological order, oldest → newest).
 * Requires at least 10 snapshots; otherwise returns `null`.
 */
export function computeSessionWindowDelta(
  sessionsChronological: LinguisticSessionSnapshot[],
  firstN = 5,
  lastN = 5
): GrowthReportSessionDelta | null {
  if (sessionsChronological.length < firstN + lastN) return null;

  const first = sessionsChronological.slice(0, firstN);
  const last = sessionsChronological.slice(-lastN);

  const v0 = mean(first.map((s) => s.vocabulary_density));
  const v1 = mean(last.map((s) => s.vocabulary_density));
  const a0 = mean(first.map((s) => s.average_sentence_length));
  const a1 = mean(last.map((s) => s.average_sentence_length));
  const h0 = mean(first.map((s) => s.hal_rhythm_consistency));
  const h1 = mean(last.map((s) => s.hal_rhythm_consistency));
  const sc0 = mean(first.map((s) => s.sentence_complexity));
  const sc1 = mean(last.map((s) => s.sentence_complexity));

  return {
    windowFirstN: firstN,
    windowLastN: lastN,
    vocabulary_density_delta: Math.round((v1 - v0) * 10_000) / 10_000,
    average_sentence_length_delta: Math.round((a1 - a0) * 1000) / 1000,
    hal_rhythm_consistency_delta: Math.round((h1 - h0) * 10_000) / 10_000,
    sentence_complexity_delta: Math.round((sc1 - sc0) * 1000) / 1000,
  };
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

type PlotChunkRow = {
  word_count: number;
  chunk_index: number;
  source_document: string;
  metadata: Record<string, unknown>;
};

function actFromMetadata(meta: Record<string, unknown>): 1 | 2 | 3 | null {
  const raw = meta["act"] ?? meta["outline_act"] ?? meta["act_number"];
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/\D/g, "") || NaN);
  if (n === 1 || n === 2 || n === 3) return n as 1 | 2 | 3;
  if (String(raw).toLowerCase().includes("one") || String(raw).toLowerCase().includes("1")) return 1;
  if (String(raw).toLowerCase().includes("two") || String(raw).toLowerCase().includes("2")) return 2;
  if (String(raw).toLowerCase().includes("three") || String(raw).toLowerCase().includes("3")) return 3;
  return null;
}

function isOutlineChunk(meta: Record<string, unknown>, manuscriptId: string): boolean {
  if (meta["outline"] === true || meta["is_outline"] === true) return true;
  const mid = meta["manuscript_id"];
  if (mid != null && String(mid) === manuscriptId) return true;
  const sd = String(meta["outline_source"] ?? "");
  if (sd && sd.includes("outline")) return true;
  return false;
}

/**
 * Sequential-fill model: manuscript words consume Act 1 outline budget, then Act 2, then Act 3.
 */
function milestonesFromTargets(
  manuscriptWords: number,
  t1: number,
  t2: number,
  t3: number
): ActMilestone[] {
  const targets: Array<[1 | 2 | 3, number]> = [
    [1, Math.max(0, t1)],
    [2, Math.max(0, t2)],
    [3, Math.max(0, t3)],
  ];

  let remaining = Math.max(0, manuscriptWords);
  const acts: ActMilestone[] = [];

  for (const [act, budget] of targets) {
    if (budget <= 0) {
      acts.push({ act, outline_target_words: 0, manuscript_words_applied: 0, percent_complete: 0 });
      continue;
    }
    const applied = Math.min(remaining, budget);
    const pct = Math.min(100, Math.round(((applied / budget) * 100) * 10) / 10);
    acts.push({
      act,
      outline_target_words: budget,
      manuscript_words_applied: applied,
      percent_complete: pct,
    });
    remaining -= applied;
  }

  return acts;
}

export class AuthorTelemetryService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Last `sessionCount` HAL sessions for the author (newest first in the query; returned oldest → newest).
   */
  async getRecentSessionData(
    authorId: string,
    sessionCount = 15
  ): Promise<LinguisticSessionSnapshot[]> {
    const limit = Math.min(Math.max(sessionCount, 1), 100);
    const { data, error } = await this.supabase
      .from("p4_hal_ledger")
      .select("id, session_id, created_at, stylometric_snapshot, raw_sample")
      .eq("author_user_id", authorId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`getRecentSessionData: ${error.message}`);

    const mapped = (data ?? [])
      .map((row) => mapHalRowToLinguisticSessionSnapshot(row as Record<string, unknown>))
      .filter((x): x is LinguisticSessionSnapshot => x != null);

    return mapped.reverse();
  }

  /**
   * Convenience: load recent sessions and compute first-5 vs last-5 deltas (needs ≥10 rows).
   */
  async buildGrowthReportDelta(
    authorId: string,
    sessionCount = 15
  ): Promise<{ sessions: LinguisticSessionSnapshot[]; delta: GrowthReportSessionDelta | null }> {
    const sessions = await this.getRecentSessionData(authorId, sessionCount);
    return { sessions, delta: computeSessionWindowDelta(sessions) };
  }

  /**
   * Window deltas plus `TrajectoryAnalyzer` tags / insight (optional act hint from milestones).
   */
  async analyzeAuthorTrajectory(
    authorId: string,
    options?: { sessionCount?: number; milestoneDominantAct?: 1 | 2 | 3 }
  ): Promise<{
    sessions: LinguisticSessionSnapshot[];
    delta: GrowthReportSessionDelta | null;
    analysis: TrajectoryAnalysis;
  }> {
    const { sessions, delta } = await this.buildGrowthReportDelta(authorId, options?.sessionCount ?? 15);
    const analysis = TrajectoryAnalyzer.analyze(delta, {
      dominant_act: options?.milestoneDominantAct,
    });
    return { sessions, delta, analysis };
  }

  /**
   * Compare current manuscript word count to outline **plot** chunks tagged with `metadata.act` / `outline`,
   * or fall back to splitting plot chunks into three tertiles by `chunk_index`.
   */
  async calculateProjectMilestones(manuscriptId: string): Promise<ProjectMilestonesResult> {
    const { data: ms, error: msErr } = await this.supabase
      .from("p4_manuscripts")
      .select("id, tenant_id, body_text")
      .eq("id", manuscriptId)
      .maybeSingle();

    if (msErr) throw new Error(`calculateProjectMilestones: ${msErr.message}`);
    if (!ms) throw new Error(`Manuscript not found: ${manuscriptId}`);

    const tenantId = String((ms as { tenant_id: string }).tenant_id);
    const body = String((ms as { body_text?: string | null }).body_text ?? "");
    const manuscript_word_count = countWords(body);

    const { data: plotRows, error: plotErr } = await this.supabase
      .from("p4_narrative_library_chunks")
      .select("word_count, chunk_index, source_document, metadata")
      .eq("tenant_id", tenantId)
      .eq("chunk_type", "plot")
      .order("source_document", { ascending: true })
      .order("chunk_index", { ascending: true });

    if (plotErr) throw new Error(`calculateProjectMilestones plot: ${plotErr.message}`);

    const plots = (plotRows ?? []) as PlotChunkRow[];

    const outlineCandidates = plots.filter((p) => {
      const meta = p.metadata && typeof p.metadata === "object" ? (p.metadata as Record<string, unknown>) : {};
      return isOutlineChunk(meta, manuscriptId);
    });

    const useRows = outlineCandidates.length > 0 ? outlineCandidates : plots;

    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    let source: ProjectMilestonesResult["source"] = "no_outline";

    const withActs = useRows.filter((p) => {
      const meta = p.metadata && typeof p.metadata === "object" ? (p.metadata as Record<string, unknown>) : {};
      return actFromMetadata(meta) != null;
    });

    if (withActs.length > 0) {
      source = "outline_metadata";
      for (const p of withActs) {
        const meta = p.metadata as Record<string, unknown>;
        const act = actFromMetadata(meta);
        const w = Math.max(0, Number(p.word_count) || 0);
        if (act === 1) t1 += w;
        else if (act === 2) t2 += w;
        else if (act === 3) t3 += w;
      }
    }

    if (t1 + t2 + t3 === 0 && useRows.length > 0) {
      source = "plot_tertiles";
      const sorted = [...useRows].sort((a, b) => a.chunk_index - b.chunk_index);
      const n = sorted.length;
      const third = Math.ceil(n / 3);
      const w = (from: number, to: number) =>
        sorted.slice(from, to).reduce((s, r) => s + Math.max(0, Number(r.word_count) || 0), 0);
      t1 = w(0, third);
      t2 = w(third, third * 2);
      t3 = w(third * 2, n);
    }

    if (t1 + t2 + t3 === 0) {
      source = "no_outline";
    }

    const outline_total_words = t1 + t2 + t3;
    const acts =
      outline_total_words > 0
        ? milestonesFromTargets(manuscript_word_count, t1, t2, t3)
        : [
            { act: 1 as const, outline_target_words: 0, manuscript_words_applied: 0, percent_complete: 0 },
            { act: 2 as const, outline_target_words: 0, manuscript_words_applied: 0, percent_complete: 0 },
            { act: 3 as const, outline_target_words: 0, manuscript_words_applied: 0, percent_complete: 0 },
          ];

    return {
      manuscriptId,
      tenantId,
      manuscript_word_count,
      outline_total_words,
      acts,
      source,
    };
  }
}

/** Alias: Growth Report delta (first N vs last N sessions). */
export const computeGrowthReportDeltas = computeSessionWindowDelta;
