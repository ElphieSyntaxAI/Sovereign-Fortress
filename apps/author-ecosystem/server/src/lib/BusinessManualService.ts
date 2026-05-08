/**
 * Phase 1 → Phase 2 bridge: lore-grounded social drafting, manual storefront metrics,
 * and HAL-vs-marketing correlation by calendar date.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LibrarianChat,
  matchesCanonPrefix,
  remainderForLabel,
  type LibrarianLanguage,
} from "./narrative/LibrarianChat.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SocialPlatform =
  | "twitter"
  | "threads"
  | "bluesky"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "mastodon";

export type ManualMarketingRow = {
  id: string;
  tenant_id: string;
  manuscript_id: string;
  recorded_date: string;
  platform: string;
  interaction_count: number;
  comment_count: number;
  sales_revenue: number;
  notes: string | null;
  created_at: string;
};

export type MarketingHalCorrelationRow = {
  correlation_date: string;
  tenant_id: string;
  manuscript_id: string;
  writing_hal_sessions: number;
  writing_total_words_sampled: number;
  writing_mean_hal_score: number | null;
  marketing_row_id: string | null;
  marketing_platform: string | null;
  marketing_interaction_count: number | null;
  marketing_comment_count: number | null;
  marketing_sales_revenue: number | null;
  marketing_notes: string | null;
  marketing_logged_at: string | null;
};

export type DraftSocialPostResult = {
  platform: SocialPlatform;
  focus: string;
  lore_hook: string;
  formatted_post: string;
  librarian_answer: string;
  retrieved_chunk_ids: string[];
};

export type RecordMarketingWinInput = {
  tenantId: string;
  manuscriptId: string;
  recordedDate: string;
  platform: string;
  interactionCount: number;
  commentCount: number;
  salesRevenue: number;
  notes?: string | null;
};

/**
 * Canonical SQL for joining daily HAL writing effort with manual marketing rows (same UTC calendar date).
 * Mirrors `public.p4_v_marketing_hal_correlation` when that view is installed.
 */
export const MARKETING_HAL_CORRELATION_SQL = `
WITH hal_daily AS (
  SELECT
    h.tenant_id,
    (h.raw_sample->>'manuscriptId')::uuid AS manuscript_id,
    ((h.created_at AT TIME ZONE 'UTC')::date) AS correlation_date,
    COUNT(*)::bigint AS hal_session_count,
    COALESCE(
      SUM(
        CASE
          WHEN (h.raw_sample->>'total_words') ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN (h.raw_sample->>'total_words')::numeric
          ELSE 0::numeric
        END
      ),
      0::numeric
    ) AS total_words_logged,
    AVG(
      CASE
        WHEN (h.raw_sample->>'hal_score') ~ '^-?[0-9]+(\\.[0-9]+)?$'
        THEN (h.raw_sample->>'hal_score')::double precision
        ELSE NULL::double precision
      END
    ) AS mean_hal_score_raw,
    AVG(
      CASE
        WHEN (h.stylometric_snapshot->>'hal_score_final') ~ '^-?[0-9]+(\\.[0-9]+)?$'
        THEN (h.stylometric_snapshot->>'hal_score_final')::double precision
        ELSE NULL::double precision
      END
    ) AS mean_hal_score_snap
  FROM public.p4_hal_ledger h
  WHERE h.raw_sample ? 'manuscriptId'
    AND (h.raw_sample->>'manuscriptId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  GROUP BY h.tenant_id, (h.raw_sample->>'manuscriptId')::uuid, ((h.created_at AT TIME ZONE 'UTC')::date)
),
effort AS (
  SELECT
    tenant_id,
    manuscript_id,
    correlation_date,
    hal_session_count,
    total_words_logged,
    COALESCE(mean_hal_score_raw, mean_hal_score_snap) AS mean_hal_score
  FROM hal_daily
)
SELECT
  e.correlation_date,
  e.tenant_id,
  e.manuscript_id,
  e.hal_session_count AS writing_hal_sessions,
  e.total_words_logged AS writing_total_words_sampled,
  e.mean_hal_score AS writing_mean_hal_score,
  m.id AS marketing_row_id,
  m.platform AS marketing_platform,
  m.interaction_count AS marketing_interaction_count,
  m.comment_count AS marketing_comment_count,
  m.sales_revenue AS marketing_sales_revenue,
  m.notes AS marketing_notes,
  m.created_at AS marketing_logged_at
FROM effort e
LEFT JOIN public.p4_manual_marketing_data m
  ON m.tenant_id = e.tenant_id
 AND m.manuscript_id = e.manuscript_id
 AND m.recorded_date = e.correlation_date
ORDER BY e.correlation_date DESC, m.platform NULLS LAST;
`.trim();

// ---------------------------------------------------------------------------
// Lore hook extraction
// ---------------------------------------------------------------------------

function extractFirstCanonHook(answer: string, lang: LibrarianLanguage): string | null {
  const lines = String(answer || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const body = remainderForLabel(line);
    if (matchesCanonPrefix(body, lang)) {
      const cleaned = body
        .replace(/^Canon:\s*/i, "")
        .replace(/^Canónico:\s*/i, "")
        .replace(/^Canónica:\s*/i, "")
        .replace(/^カノン\s*(?:\(\s*Canon\s*\)|（\s*Canon\s*）)?\s*[:：]\s*/u, "")
        .trim();
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function formatForPlatform(
  platform: SocialPlatform,
  loreHook: string,
  focus: string,
  manuscriptTitle: string | null
): string {
  const title = manuscriptTitle?.trim() || "This story";
  const hook = loreHook.replace(/\s+/g, " ").trim();
  const focusLine = focus.trim() ? `Focus: ${focus.trim()}` : "";

  switch (platform) {
    case "twitter":
    case "threads":
    case "bluesky": {
      const max = platform === "twitter" ? 260 : 280;
      const base = `${hook}\n\n— ${title}${focusLine ? `\n(${focusLine})` : ""}`;
      if (base.length <= max) return base;
      return `${hook.slice(0, Math.max(40, max - 80))}…\n\n#amwriting`;
    }
    case "instagram":
    case "facebook":
      return [
        hook,
        "",
        focusLine,
        "",
        `Tap the link in bio — ${title}.`,
        "#writersofinstagram #bookstagram",
      ]
        .filter(Boolean)
        .join("\n");
    case "tiktok":
      return [
        "ON-SCREEN (first 2s):",
        hook.slice(0, 90) + (hook.length > 90 ? "…" : ""),
        "",
        "VO / CAPTION:",
        `${title}. ${focusLine || "World tease — no spoilers."}`,
        "",
        "Pinned comment CTA: Ask what they think is coming next.",
      ].join("\n");
    case "linkedin":
      return [
        `Author update (${title}):`,
        "",
        hook,
        "",
        focusLine,
        "",
        "What craft choices are you experimenting with this quarter?",
      ]
        .filter(Boolean)
        .join("\n");
    case "mastodon":
      return `${hook}\n\n${focusLine}\n\n#Writing #Books #MastodonBooks`.replace(/\n\n\n+/g, "\n\n");
    default:
      return hook;
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BusinessManualService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async loadManuscriptTenant(manuscriptId: string): Promise<{ tenant_id: string; title: string | null }> {
    const { data, error } = await this.supabase
      .from("p4_manuscripts")
      .select("tenant_id, title")
      .eq("id", manuscriptId)
      .maybeSingle();

    if (error) throw new Error(`BusinessManualService: manuscript ${error.message}`);
    if (!data) throw new Error(`BusinessManualService: manuscript not found (${manuscriptId})`);

    const tenant_id = String((data as { tenant_id: string }).tenant_id);
    const title = (data as { title?: string | null }).title ?? null;
    return { tenant_id, title };
  }

  /**
   * Uses the Lore Librarian on lore chunks to ground a teaser line, then shapes copy for the target network.
   */
  async draftSocialPost(
    manuscriptId: string,
    platform: SocialPlatform,
    focus: string,
    options?: { language?: LibrarianLanguage }
  ): Promise<DraftSocialPostResult> {
    const lang = options?.language ?? "en";

    const { tenant_id, title } = await this.loadManuscriptTenant(manuscriptId);
    const librarian = new LibrarianChat(this.supabase);

    const question = [
      `You are helping draft a ${platform} post for this manuscript.`,
      `Marketing focus: ${focus.trim() || "general audience tease"}.`,
      "",
      "Return 2–3 short bullets.",
      "The FIRST bullet must be Canon: and give ONE vivid lore hook (under 45 words of in-world detail) that is safe for social teasing — no major spoilers beyond what the lore chunks already support.",
      "Optional second bullet may be Scientific Inference: about reader psychology or pacing (not new story facts).",
    ].join("\n");

    const { answer, retrievedChunks } = await librarian.ask({
      tenantId: tenant_id,
      question,
      audience: "author",
      chunkTypes: ["lore"],
      enforceMode: "strip",
      language: lang,
      topK: 10,
    });

    const lore_hook =
      extractFirstCanonHook(answer, lang) ??
      remainderForLabel(answer.split(/\r?\n/).find((l) => l.trim()) ?? answer).slice(0, 400);

    const formatted_post = formatForPlatform(platform, lore_hook, focus, title);

    return {
      platform,
      focus: focus.trim(),
      lore_hook,
      formatted_post,
      librarian_answer: answer,
      retrieved_chunk_ids: retrievedChunks.map((c) => c.id),
    };
  }

  async recordMarketingWin(row: RecordMarketingWinInput): Promise<ManualMarketingRow> {
    const payload = {
      tenant_id: row.tenantId,
      manuscript_id: row.manuscriptId,
      recorded_date: row.recordedDate,
      platform: row.platform.trim(),
      interaction_count: Math.max(0, Math.floor(row.interactionCount)),
      comment_count: Math.max(0, Math.floor(row.commentCount)),
      sales_revenue: Math.max(0, Number(row.salesRevenue) || 0),
      notes: row.notes?.trim() || null,
    };

    const { data, error } = await this.supabase
      .from("p4_manual_marketing_data")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`recordMarketingWin: ${error.message}`);
    return mapMarketingRow(data as Record<string, unknown>);
  }

  async listMarketingWins(
    tenantId: string,
    manuscriptId: string,
    limit = 40
  ): Promise<ManualMarketingRow[]> {
    const { data, error } = await this.supabase
      .from("p4_manual_marketing_data")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("manuscript_id", manuscriptId)
      .order("recorded_date", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`listMarketingWins: ${error.message}`);
    return (data ?? []).map((r) => mapMarketingRow(r as Record<string, unknown>));
  }

  /**
   * Reads `p4_v_marketing_hal_correlation` when deployed; returns [] if the view is missing.
   */
  async fetchMarketingHalCorrelation(
    tenantId: string,
    manuscriptId: string,
    limit = 60
  ): Promise<MarketingHalCorrelationRow[]> {
    const { data, error } = await this.supabase
      .from("p4_v_marketing_hal_correlation")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("manuscript_id", manuscriptId)
      .order("correlation_date", { ascending: false })
      .limit(limit);

    if (error) {
      if (/p4_v_marketing_hal_correlation|does not exist|schema cache/i.test(error.message)) {
        return [];
      }
      throw new Error(`fetchMarketingHalCorrelation: ${error.message}`);
    }

    return (data ?? []).map((r) => mapCorrelationRow(r as Record<string, unknown>));
  }
}

function mapMarketingRow(o: Record<string, unknown>): ManualMarketingRow {
  return {
    id: String(o["id"]),
    tenant_id: String(o["tenant_id"]),
    manuscript_id: String(o["manuscript_id"]),
    recorded_date: String(o["recorded_date"] ?? "").slice(0, 10),
    platform: String(o["platform"] ?? ""),
    interaction_count: Number(o["interaction_count"] ?? 0),
    comment_count: Number(o["comment_count"] ?? 0),
    sales_revenue: Number(o["sales_revenue"] ?? 0),
    notes: o["notes"] != null ? String(o["notes"]) : null,
    created_at: String(o["created_at"] ?? ""),
  };
}

function mapCorrelationRow(o: Record<string, unknown>): MarketingHalCorrelationRow {
  const mhs = o["writing_mean_hal_score"];
  return {
    correlation_date: String(o["correlation_date"] ?? "").slice(0, 10),
    tenant_id: String(o["tenant_id"]),
    manuscript_id: String(o["manuscript_id"]),
    writing_hal_sessions: Number(o["writing_hal_sessions"] ?? 0),
    writing_total_words_sampled: Number(o["writing_total_words_sampled"] ?? 0),
    writing_mean_hal_score: typeof mhs === "number" && Number.isFinite(mhs) ? mhs : null,
    marketing_row_id: o["marketing_row_id"] != null ? String(o["marketing_row_id"]) : null,
    marketing_platform: o["marketing_platform"] != null ? String(o["marketing_platform"]) : null,
    marketing_interaction_count:
      o["marketing_interaction_count"] != null ? Number(o["marketing_interaction_count"]) : null,
    marketing_comment_count: o["marketing_comment_count"] != null ? Number(o["marketing_comment_count"]) : null,
    marketing_sales_revenue: o["marketing_sales_revenue"] != null ? Number(o["marketing_sales_revenue"]) : null,
    marketing_notes: o["marketing_notes"] != null ? String(o["marketing_notes"]) : null,
    marketing_logged_at: o["marketing_logged_at"] != null ? String(o["marketing_logged_at"]) : null,
  };
}
