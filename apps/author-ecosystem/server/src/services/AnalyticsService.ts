/**
 * Manuscript analytics derived from `p4_hal_ledger` HAL rows (see `packages/msgf` migrations).
 * Friction scores approximate “time per word × edit churn” for editor-facing X-ray views.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { P4_HAL_LEDGER } from "../lib/database/canonicalIdentifiers.js";

export type StruggleTier = "FLOW" | "STANDARD" | "STRUGGLE";

export type ManuscriptStruggleSegment = {
  /** Stable grouping key, e.g. `chapter:2` or `bin:4` (4th 1k-word bucket). */
  segment_key: string;
  chapter_index: number | null;
  /** 0-based index of the ~1000-word bin when not using chapter grouping. */
  word_bin_index: number | null;
  hal_event_count: number;
  /** Sum of inter-keystroke latencies (ms), or wall-clock session span when latencies are empty. */
  active_typing_duration_ms: number;
  /** Net words attributed to this segment (`manual_word_count` / `raw_sample.total_words`). */
  net_word_gain: number;
  backspace_count: number;
  /** `backspace_count / max(1, net_word_gain)` — feeds friction formula. */
  deletion_ratio: number;
  /** S = (TimeSpent / WordsProduced) × (1 + DeletionRatio); TimeSpent in seconds for scale. */
  friction_score: number;
  tier: StruggleTier;
};

export type ManuscriptStruggleMapResult = {
  schema: "elphie.manuscript_struggle_map.v1";
  manuscript_id: string;
  segments: ManuscriptStruggleSegment[];
  /** When no qualifying HAL rows exist for this manuscript. */
  empty_reason?: string;
};

const WORDS_PER_BIN = 1000;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function manuscriptIdFromHalRow(rawSample: unknown): string | null {
  const r = asRecord(rawSample);
  const camel = r["manuscriptId"];
  const snake = r["manuscript_id"];
  const s =
    typeof camel === "string"
      ? camel.trim()
      : typeof snake === "string"
        ? snake.trim()
        : "";
  return s || null;
}

function isRevisionGateTelemetry(rawSample: unknown): boolean {
  const r = asRecord(rawSample);
  return r["p3_revision_gate"] === true;
}

function numField(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function chapterIndexFromRaw(rawSample: unknown): number | null {
  const r = asRecord(rawSample);
  const keys = ["chapter_index", "chapterIndex", "chapterIdx"] as const;
  for (const k of keys) {
    const n = numField(r[k]);
    if (n != null && n >= 0 && Number.isInteger(n)) return n;
  }
  return null;
}

function latencyMsFromRow(row: Record<string, unknown>): number[] {
  const primary = Array.isArray(row["keystroke_latency_ms"])
    ? (row["keystroke_latency_ms"] as unknown[]).map((n) => Number(n))
    : [];
  const rawSample = asRecord(row["raw_sample"]);
  const rawArr =
    Array.isArray(rawSample["raw_keystroke_latency_ms"])
      ? (rawSample["raw_keystroke_latency_ms"] as unknown[]).map((n) => Number(n))
      : [];
  const merged = primary.length > 0 ? primary : rawArr;
  return merged.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0);
}

function activeTypingDurationMs(row: Record<string, unknown>, latencies: number[]): number {
  const sumLat = latencies.reduce((a, b) => a + b, 0);
  if (sumLat > 0) return Math.round(sumLat);
  const start = row["session_start"];
  const end = row["session_end"];
  if (start && end) {
    const t0 = Date.parse(String(start));
    const t1 = Date.parse(String(end));
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0) return t1 - t0;
  }
  return 0;
}

function backspaceCountFromRow(row: Record<string, unknown>): number {
  const raw = asRecord(row["raw_sample"]);
  const direct =
    numField(raw["backspace_count"]) ??
    numField(raw["backspaces"]) ??
    numField(raw["backspaceCount"]);
  if (direct != null && direct >= 0) return Math.round(direct);

  const dna = asRecord(raw["keystroke_dna"]);
  const fromDna =
    numField(dna["backspace_count"]) ??
    numField(dna["backspaces"]) ??
    numField(dna["backspaceCount"]);
  if (fromDna != null && fromDna >= 0) return Math.round(fromDna);

  const legacy = row["keystroke_data_legacy"];
  if (legacy && typeof legacy === "object") {
    const L = legacy as Record<string, unknown>;
    const stats = asRecord(L["typing_stats"]);
    const b = numField(stats["backspaces"]);
    if (b != null && b >= 0) return Math.round(b);
  }
  return 0;
}

function netWordsFromRow(row: Record<string, unknown>): number {
  const manual = numField(row["manual_word_count"]);
  if (manual != null && manual > 0) return Math.round(manual);
  const raw = asRecord(row["raw_sample"]);
  const tw = numField(raw["total_words"]);
  if (tw != null && tw > 0) return Math.round(tw);
  return 0;
}

/**
 * Friction score S = (TimeSpent / WordsProduced) × (1 + DeletionRatio)
 * with TimeSpent in **seconds**, DeletionRatio = backspace_count / max(1, net_word_gain).
 */
function frictionScore(activeTypingMs: number, netWords: number, backspaces: number): number {
  const words = Math.max(1, netWords);
  const timeSec = Math.max(0, activeTypingMs) / 1000;
  const deletionRatio = backspaces / words;
  return (timeSec / words) * (1 + deletionRatio);
}

type Agg = {
  segment_key: string;
  chapter_index: number | null;
  word_bin_index: number | null;
  hal_event_count: number;
  active_typing_duration_ms: number;
  net_word_gain: number;
  backspace_count: number;
};

function assignTiers(aggs: Agg[]): StruggleTier[] {
  if (aggs.length === 0) return [];
  const scores = aggs.map((a) => frictionScore(a.active_typing_duration_ms, a.net_word_gain, a.backspace_count));
  const order = scores.map((s, i) => ({ i, s })).sort((a, b) => a.s - b.s);
  const n = order.length;
  const tiers: StruggleTier[] = new Array(n);
  for (let rank = 0; rank < n; rank++) {
    const frac = n === 1 ? 0.5 : rank / (n - 1);
    const t: StruggleTier = frac < 1 / 3 ? "FLOW" : frac < 2 / 3 ? "STANDARD" : "STRUGGLE";
    tiers[order[rank]!.i] = t;
  }
  return tiers;
}

export class AnalyticsService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Chapter-by-chapter (or 1000-word bin) friction map from `p4_hal_ledger` for one manuscript.
   * Rows without `chapter_index` are rolled into sequential 1k-word bins using cumulative `net_word_gain`.
   * Rows tagged `p3_revision_gate` or with no typing signal and zero words are skipped.
   */
  async getManuscriptStruggleMap(manuscriptId: string, tenantId?: string): Promise<ManuscriptStruggleMapResult> {
    const mid = manuscriptId.trim();
    const tid = tenantId?.trim();
    let q = this.supabase
      .from(P4_HAL_LEDGER)
      .select(
        "id, created_at, tenant_id, manual_word_count, keystroke_latency_ms, keystroke_data_legacy, raw_sample, session_start, session_end"
      )
      .order("created_at", { ascending: true })
      .limit(4000);
    if (tid) q = q.eq("tenant_id", tid);
    const { data: rows, error } = await q;

    if (error) {
      throw new Error(`getManuscriptStruggleMap: ${error.message}`);
    }

    let cumulativeWords = 0;
    const buckets = new Map<string, Agg>();

    for (const rawRow of rows ?? []) {
      const row = rawRow as Record<string, unknown>;
      const rs = row["raw_sample"];
      if (manuscriptIdFromHalRow(rs) !== mid) continue;
      if (isRevisionGateTelemetry(rs)) continue;

      const latencies = latencyMsFromRow(row);
      const activeMs = activeTypingDurationMs(row, latencies);
      const words = netWordsFromRow(row);
      const backs = backspaceCountFromRow(row);

      if (words <= 0 && activeMs <= 0 && backs <= 0) continue;

      const ch = chapterIndexFromRaw(rs);
      let segment_key: string;
      let chapter_index: number | null;
      let word_bin_index: number | null;

      if (ch != null) {
        chapter_index = ch;
        word_bin_index = null;
        segment_key = `chapter:${ch}`;
      } else {
        chapter_index = null;
        const bin = Math.floor(cumulativeWords / WORDS_PER_BIN);
        word_bin_index = bin;
        segment_key = `bin:${bin}`;
      }

      cumulativeWords += Math.max(0, words);

      const prev = buckets.get(segment_key);
      if (!prev) {
        buckets.set(segment_key, {
          segment_key,
          chapter_index,
          word_bin_index,
          hal_event_count: 1,
          active_typing_duration_ms: activeMs,
          net_word_gain: Math.max(0, words),
          backspace_count: Math.max(0, backs),
        });
      } else {
        prev.hal_event_count += 1;
        prev.active_typing_duration_ms += activeMs;
        prev.net_word_gain += Math.max(0, words);
        prev.backspace_count += Math.max(0, backs);
      }
    }

    const aggs = [...buckets.values()].sort((a, b) => {
      if (a.chapter_index != null && b.chapter_index != null) return a.chapter_index - b.chapter_index;
      if (a.word_bin_index != null && b.word_bin_index != null) return a.word_bin_index - b.word_bin_index;
      return a.segment_key.localeCompare(b.segment_key);
    });

    if (aggs.length === 0) {
      return {
        schema: "elphie.manuscript_struggle_map.v1",
        manuscript_id: mid,
        segments: [],
        empty_reason: "No HAL typing sessions found for this manuscript (check raw_sample.manuscriptId / manuscript_id).",
      };
    }

    const tiers = assignTiers(aggs);
    const segments: ManuscriptStruggleSegment[] = aggs.map((a, i) => {
      const w = Math.max(1, a.net_word_gain);
      const dr = a.backspace_count / w;
      const s = frictionScore(a.active_typing_duration_ms, a.net_word_gain, a.backspace_count);
      return {
        segment_key: a.segment_key,
        chapter_index: a.chapter_index,
        word_bin_index: a.word_bin_index,
        hal_event_count: a.hal_event_count,
        active_typing_duration_ms: a.active_typing_duration_ms,
        net_word_gain: a.net_word_gain,
        backspace_count: a.backspace_count,
        deletion_ratio: dr,
        friction_score: Math.round(s * 10_000) / 10_000,
        tier: tiers[i]!,
      };
    });

    return {
      schema: "elphie.manuscript_struggle_map.v1",
      manuscript_id: mid,
      segments,
    };
  }
}
