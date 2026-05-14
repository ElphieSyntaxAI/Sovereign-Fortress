/**
 * Publisher-facing aggregates over `p4_editor_ledger` + HAL struggle tiers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { P4_EDITOR_LEDGER } from "./database/canonicalIdentifiers.js";
import { AnalyticsService } from "../services/AnalyticsService.js";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function countWords(slice: string): number {
  const s = slice.trim();
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}

function numField(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function anchorStartFromPayload(payload: Record<string, unknown>): number | null {
  const nested = asRecord(payload["suggestion"]);
  const fromNested = numField(nested["anchor_start"]);
  if (fromNested != null && fromNested >= 0) return Math.floor(fromNested);
  const direct = numField(payload["anchor_start"]);
  if (direct != null && direct >= 0) return Math.floor(direct);
  return null;
}

async function resolveEditorDisplayName(supabase: SupabaseClient, editorId: string): Promise<string> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(editorId);
    if (error || !data?.user) return editorId.slice(0, 8);
    const meta = data.user.user_metadata && typeof data.user.user_metadata === "object"
      ? (data.user.user_metadata as Record<string, unknown>)
      : {};
    const dn = typeof meta["display_name"] === "string" ? meta["display_name"].trim() : "";
    if (dn) return dn;
    const email = typeof data.user.email === "string" ? data.user.email.trim() : "";
    if (email) return email.split("@")[0] ?? editorId.slice(0, 8);
  } catch {
    /* fall through */
  }
  return editorId.slice(0, 8);
}

export type EditorLedgerPublisherLine = {
  editor_id: string;
  editor_name: string;
  hours_spent: number;
  suggestions_count: number;
  high_friction_chapters: number;
  /** e.g. Editor Jane spent 3.5 hours and made 42 suggestions across 5 high-friction chapters. */
  narrative: string;
};

export type EditorLedgerSummaryReport = {
  schema: "elphie.editor_ledger.publisher_summary.v1";
  manuscript_id: string;
  editors: EditorLedgerPublisherLine[];
};

export class EditorLedgerService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Per-editor rollup for publishers: wall-clock span on the manuscript, suggestion count,
   * and distinct HAL **STRUGGLE** bins (`bin:N`) touched by suggestion anchors (1k-word bins).
   */
  async summaryReport(manuscriptId: string): Promise<EditorLedgerSummaryReport> {
    const mid = manuscriptId.trim();
    const analytics = new AnalyticsService(this.supabase);
    const [msRes, ledgerRes] = await Promise.all([
      this.supabase.from("p4_manuscripts").select("tenant_id, body_text").eq("id", mid).maybeSingle(),
      this.supabase
        .from(P4_EDITOR_LEDGER)
        .select('editor_id, type, char_count, payload, "timestamp"')
        .eq("manuscript_id", mid),
    ]);

    if (msRes.error) {
      throw new Error(`summaryReport manuscript: ${msRes.error.message}`);
    }
    if (ledgerRes.error) {
      throw new Error(`summaryReport ledger: ${ledgerRes.error.message}`);
    }

    const ms = msRes.data as { tenant_id?: string; body_text?: string | null } | null;
    if (!ms) {
      throw new Error(`Manuscript not found: ${mid}`);
    }

    const tenantId = String(ms.tenant_id ?? "").trim();
    const struggle = await analytics.getManuscriptStruggleMap(mid, tenantId || undefined);

    const bodyText = String(ms.body_text ?? "");
    const struggleBins = new Set(
      struggle.segments.filter((s) => s.tier === "STRUGGLE" && s.word_bin_index != null).map((s) => s.segment_key)
    );

    type LedgerRow = {
      editor_id: string | null;
      type: string | null;
      char_count: number | null;
      /** DB column `"timestamp"` */
      timestamp?: string | null;
      payload: unknown;
    };

    const rows = (ledgerRes.data ?? []) as LedgerRow[];
    const byEditor = new Map<
      string,
      { timestamps: number[]; suggestionAnchors: number[]; charSum: number; types: string[] }
    >();

    for (const r of rows) {
      const eid = r.editor_id?.trim();
      if (!eid) continue;
      const slot =
        byEditor.get(eid) ??
        { timestamps: [], suggestionAnchors: [], charSum: 0, types: [] };
      const tsRaw = r.timestamp;
      if (tsRaw) {
        const t = Date.parse(String(tsRaw));
        if (Number.isFinite(t)) slot.timestamps.push(t);
      }
      slot.charSum += Math.max(0, Number(r.char_count) || 0);
      const typ = String(r.type ?? "").toUpperCase();
      slot.types.push(typ);
      if (typ === "SUGGESTION") {
        const anchor = anchorStartFromPayload(asRecord(r.payload));
        if (anchor != null && anchor >= 0 && anchor <= bodyText.length) {
          slot.suggestionAnchors.push(anchor);
        }
      }
      byEditor.set(eid, slot);
    }

    const editors: EditorLedgerPublisherLine[] = [];
    for (const [editor_id, agg] of byEditor) {
      const suggestions_count = agg.types.filter((t) => t === "SUGGESTION").length;
      const editor_name = await resolveEditorDisplayName(this.supabase, editor_id);

      let hours_spent = 0;
      if (agg.timestamps.length >= 2) {
        const lo = Math.min(...agg.timestamps);
        const hi = Math.max(...agg.timestamps);
        hours_spent = Math.max(0, (hi - lo) / 3_600_000);
      }
      if (hours_spent < 5 / 60 && agg.charSum > 0) {
        hours_spent = Math.max(hours_spent, Math.min(24, agg.charSum / 12_000));
      }
      if (hours_spent < 1 / 120 && suggestions_count > 0) {
        hours_spent = 5 / 60;
      }

      const touchedStruggleBins = new Set<string>();
      for (const anchor of agg.suggestionAnchors) {
        const wordsBefore = countWords(bodyText.slice(0, anchor));
        const bin = Math.floor(wordsBefore / 1000);
        const key = `bin:${bin}`;
        if (struggleBins.has(key)) touchedStruggleBins.add(key);
      }
      const high_friction_chapters = touchedStruggleBins.size;

      const h = Math.round(hours_spent * 10) / 10;
      const narrative = `Editor ${editor_name} spent ${h} hours and made ${suggestions_count} suggestions across ${high_friction_chapters} high-friction chapters.`;

      editors.push({
        editor_id,
        editor_name,
        hours_spent: h,
        suggestions_count,
        high_friction_chapters,
        narrative,
      });
    }

    editors.sort((a, b) => b.suggestions_count - a.suggestions_count);

    return {
      schema: "elphie.editor_ledger.publisher_summary.v1",
      manuscript_id: mid,
      editors,
    };
  }
}
