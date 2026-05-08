/**
 * Live fan engagement: 24h pulse tallies, business-day overlay with manual marketing,
 * and Supabase Realtime wiring for `p4_author_signal` (tenant-scoped).
 */

import { randomUUID } from "node:crypto";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { ManualMarketingRow } from "./BusinessManualService.js";

const MS_DAY = 86_400_000;
const MS_24H = 24 * MS_DAY;

/** Canonical kinds for Lore-facing bots (extend as products emit new labels). */
export const LORE_LIVE_KIND_PREFIXES = ["LORE_BOT", "LORE_QUERY", "LOREBOT", "FAN_LORE"] as const;

export type AuthorSignalRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  manuscript_id: string | null;
  payload: Record<string, unknown> | null;
};

export type LivePulseResult = {
  window_started_at: string;
  window_ended_at: string;
  total_signals: number;
  /** Count per `kind` (exact string). */
  by_kind: Record<string, number>;
  lore_bot_question_like: number;
  drawer_progress: number;
  other_fan_touchpoints: number;
};

export type BusinessActivityDay = {
  /** UTC calendar date `YYYY-MM-DD` from `recorded_date` / signal `created_at`. */
  date: string;
  manual_marketing: ManualMarketingRow[];
  live_signal_count: number;
  live_by_kind: Record<string, number>;
  /** Sum of manual `sales_revenue` that day. */
  manual_sales_usd: number;
  /** Sum of manual `interaction_count` that day. */
  manual_interactions: number;
};

function utcDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function isLoreBotLikeKind(kind: string): boolean {
  const k = kind.toUpperCase();
  if (k.includes("LORE") && (k.includes("BOT") || k.includes("QUERY") || k.includes("ASK"))) return true;
  for (const p of LORE_LIVE_KIND_PREFIXES) {
    if (k.startsWith(p) || k.includes(p)) return true;
  }
  return false;
}

function signalMatchesManuscript(row: AuthorSignalRow, manuscriptId: string): boolean {
  if (row.manuscript_id == null || row.manuscript_id === "") return true;
  return row.manuscript_id === manuscriptId;
}

export class LiveEngagementOrchestrator {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Tally `p4_author_signal` rows in the rolling last 24 hours for this tenant,
   * optionally scoped to `manuscriptId` when `manuscript_id` is set on the row (global tenant rows still included).
   */
  async getLivePulse(tenantId: string, manuscriptId: string): Promise<LivePulseResult> {
    const since = new Date(Date.now() - MS_24H).toISOString();
    const { data, error } = await this.supabase
      .from("p4_author_signal")
      .select("id, kind, title, body, created_at, manuscript_id, payload")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) throw new Error(`getLivePulse: ${error.message}`);
    const rows = (data ?? []).map((r) => mapAuthorSignalRow(r as Record<string, unknown>));
    return LiveEngagementOrchestrator.computeLivePulse(rows, manuscriptId);
  }

  static computeLivePulse(rows: AuthorSignalRow[], manuscriptId: string): LivePulseResult {
    const now = Date.now();
    const windowStart = new Date(now - MS_24H).toISOString();
    const windowEnd = new Date(now).toISOString();

    const scoped = rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      if (!Number.isFinite(t) || t < now - MS_24H) return false;
      return signalMatchesManuscript(r, manuscriptId);
    });

    const by_kind: Record<string, number> = {};
    let lore_bot_question_like = 0;
    let drawer_progress = 0;
    let other_fan_touchpoints = 0;

    for (const r of scoped) {
      const k = r.kind || "UNKNOWN";
      by_kind[k] = (by_kind[k] ?? 0) + 1;
      if (k === "DRAWER_PROGRESS") drawer_progress += 1;
      else if (isLoreBotLikeKind(k)) lore_bot_question_like += 1;
      else other_fan_touchpoints += 1;
    }

    return {
      window_started_at: windowStart,
      window_ended_at: windowEnd,
      total_signals: scoped.length,
      by_kind,
      lore_bot_question_like,
      drawer_progress,
      other_fan_touchpoints,
    };
  }

  /**
   * Aligns live `p4_author_signal` counts with manual `p4_manual_marketing_data` on the same UTC calendar day.
   */
  static mergeBusinessActivityTimeline(
    manual: ManualMarketingRow[],
    signals: AuthorSignalRow[],
    manuscriptId: string
  ): BusinessActivityDay[] {
    const dates = new Set<string>();
    for (const m of manual) {
      if (m.manuscript_id === manuscriptId) dates.add(m.recorded_date.slice(0, 10));
    }
    for (const s of signals) {
      if (!signalMatchesManuscript(s, manuscriptId)) continue;
      dates.add(utcDateKey(s.created_at));
    }

    const sorted = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

    return sorted.map((date) => {
      const manual_marketing = manual.filter((m) => m.manuscript_id === manuscriptId && m.recorded_date.slice(0, 10) === date);
      const daySignals = signals.filter((s) => signalMatchesManuscript(s, manuscriptId) && utcDateKey(s.created_at) === date);
      const live_by_kind: Record<string, number> = {};
      for (const s of daySignals) {
        const k = s.kind || "UNKNOWN";
        live_by_kind[k] = (live_by_kind[k] ?? 0) + 1;
      }
      const manual_sales_usd = manual_marketing.reduce((a, m) => a + (Number(m.sales_revenue) || 0), 0);
      const manual_interactions = manual_marketing.reduce((a, m) => a + (Number(m.interaction_count) || 0), 0);
      return {
        date,
        manual_marketing,
        live_signal_count: daySignals.length,
        live_by_kind,
        manual_sales_usd: Math.round(manual_sales_usd * 100) / 100,
        manual_interactions,
      };
    });
  }

  /**
   * Supabase Realtime: INSERTs on `p4_author_signal` for `tenant_id`.
   * Unsubscribe with `supabase.removeChannel(channel)` when disposing.
   */
  subscribeTenantAuthorSignals(
    tenantId: string,
    onInsert: (row: AuthorSignalRow) => void,
    channelSuffix?: string
  ): RealtimeChannel {
    const suffix = channelSuffix ?? randomUUID();
    return this.supabase
      .channel(`live_engagement:${tenantId}:${suffix}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "p4_author_signal",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const raw = payload.new;
          if (!raw || typeof raw !== "object") return;
          onInsert(mapAuthorSignalRow(raw as Record<string, unknown>));
        }
      )
      .subscribe();
  }
}

function mapAuthorSignalRow(o: Record<string, unknown>): AuthorSignalRow {
  const p = o["payload"];
  return {
    id: String(o["id"] ?? ""),
    kind: String(o["kind"] ?? ""),
    title: String(o["title"] ?? ""),
    body: String(o["body"] ?? ""),
    created_at: String(o["created_at"] ?? ""),
    manuscript_id: o["manuscript_id"] != null ? String(o["manuscript_id"]) : null,
    payload: p && typeof p === "object" ? (p as Record<string, unknown>) : null,
  };
}
