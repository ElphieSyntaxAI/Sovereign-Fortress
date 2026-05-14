/**
 * Dashboard view orchestration: mode-specific data subsets and revision-lock permissions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { P4_HAL_LEDGER } from "./database/canonicalIdentifiers.js";
import {
  calculateCraftGrowth,
  craftSessionFromStylometricSnapshot,
  type CraftGrowthResult,
  type CraftGrowthSession,
} from "./AuthorSovereigntyService.js";
import { BusinessManualService } from "./BusinessManualService.js";
import type { ManualMarketingRow, MarketingHalCorrelationRow } from "./BusinessManualService.js";
import {
  LiveEngagementOrchestrator,
  type AuthorSignalRow,
  type BusinessActivityDay,
  type LivePulseResult,
} from "./LiveEngagementOrchestrator.js";
import { AuthorTelemetryService } from "./AuthorTelemetryService.js";
import type { GrowthReportSessionDelta, ProjectMilestonesResult } from "./AuthorTelemetryService.js";
import { BadgeCertificationService } from "./BadgeCertificationService.js";
import type { HelperProofAuditSnapshot } from "./HelperProofService.js";
import { HelperProofService } from "./HelperProofService.js";
import type { InterestMetrics, MarketplaceHubVisibility } from "./MarketplaceOrchestrator.js";
import { MarketplaceOrchestrator } from "./MarketplaceOrchestrator.js";
import type { P4ManuscriptRow, RevisionStatus } from "./RevisionLockService.js";

export type DashboardMode = "PLANNING" | "DRAFTING" | "REVISION" | "BUSINESS" | "GROWTH";

export type DashboardChunkPreview = {
  id: string;
  chunk_type: string;
  source_document: string;
  chunk_index: number;
  word_count: number;
  excerpt: string;
  /** Plot/outline chunk metadata — used for arc ceiling in planning clients. */
  plot_point_order?: number | null;
};

export type PlanningDashboardData = {
  /** `p4_manuscripts.outline` — author beat sheet / high-level outline. */
  manuscript_outline: string | null;
  bible: DashboardChunkPreview[];
  outline: DashboardChunkPreview[];
  marketplace: MarketplaceHubVisibility;
  /** Anonymized marketplace signals (no actor identities). */
  marketplace_interest: InterestMetrics;
  /** Helper SEED / GROWTH / HARVEST proof + author verification state. */
  helper_proof: HelperProofAuditSnapshot;
};

export type DraftingHalSession = {
  ledger_id: string;
  created_at: string;
  manuscript_id_in_sample: string | null;
  hal_score: number | null;
  typing_score: number | null;
  is_ime_session: boolean | null;
  total_words: number | null;
};

export type DraftingDashboardData = {
  draftingEnabled: boolean;
  revision_lock: { active: boolean; lock_expires_at: string | null; lock_tier: string | null };
  current_chapter: {
    manuscript_title: string | null;
    word_count: number;
    live_excerpt: string;
  };
  hal_live: {
    recent_sessions: DraftingHalSession[];
  };
  /** Aggregate pulse from recent HAL rows (null when drafting disabled). */
  hal_pulse: { mean_hal_score: number | null; mean_typing_score: number | null; session_count: number };
  /** Words / hour from the two most recent comparable HAL samples (null if insufficient). */
  word_count_velocity_wph: number | null;
  marketplace: MarketplaceHubVisibility;
  marketplace_interest: InterestMetrics;
  helper_proof: HelperProofAuditSnapshot;
};

export type RevisionDashboardData = {
  revision_status: RevisionStatus;
  lock_tier: string | null;
  lock_expires_at: string | null;
  revision_lock_active: boolean;
  recent_revision_reports: Array<{
    id: string;
    finding_type: string;
    severity: string;
    created_at: string;
    cosine_similarity: number | null;
  }>;
  audit_queue: Array<{
    id: string;
    status: string;
    priority: number;
    created_at: string;
    has_comprehensive_report: boolean;
  }>;
  /**
   * Latest `p4_audit_queue.comprehensive_report` when `revision_status === 'AUDITING_COMPLETE'`.
   * Otherwise null.
   */
  latest_comprehensive_report: Record<string, unknown> | null;
  marketplace: MarketplaceHubVisibility;
  marketplace_interest: InterestMetrics;
  helper_proof: HelperProofAuditSnapshot;
};

export type AuthorSignalPreview = {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  manuscript_id: string | null;
};

export type BusinessDashboardData = {
  sales: {
    revenue_ytd_usd: number | null;
    units_sold: number | null;
    last_sync_at: string | null;
  };
  fan_interaction: {
    messages_30d: number | null;
    engagement_score: number | null;
    last_sync_at: string | null;
  };
  /** Fan-facing signals (Drawer, engagement, etc.) for overlay. */
  fan_signals: AuthorSignalPreview[];
  /** Manual KDP / social counters (`p4_manual_marketing_data`). */
  marketing_wins: ManualMarketingRow[];
  /** Daily HAL effort joined to same-day manual marketing (view `p4_v_marketing_hal_correlation` when present). */
  marketing_hal_correlation: MarketingHalCorrelationRow[];
  /** Rolling 24h fan signal tallies from `p4_author_signal`. */
  live_pulse: LivePulseResult;
  /** UTC calendar days: manual marketing wins + live signal counts (same timeline). */
  business_activity_timeline: BusinessActivityDay[];
  note: string;
  marketplace: MarketplaceHubVisibility;
  marketplace_interest: InterestMetrics;
  helper_proof: HelperProofAuditSnapshot;
};

export type CraftTrajectoryPoint = {
  ledger_id: string;
  created_at: string;
  craft: CraftGrowthSession;
};

export type GrowthDashboardData = {
  milestones: ProjectMilestonesResult;
  growth_delta: GrowthReportSessionDelta | null;
  telemetry_author_id: string | null;
  /** Up to 15 chronological craft snapshots for charting. */
  craft_trajectory: CraftTrajectoryPoint[];
  /** Pairwise `calculateCraftGrowth` between consecutive trajectory points. */
  craft_pairwise: CraftGrowthResult[];
  marketplace: MarketplaceHubVisibility;
  marketplace_interest: InterestMetrics;
  helper_proof: HelperProofAuditSnapshot;
};

/** GROWTH + REVISION slices for publisher verify pages (no manuscript body). */
export type PublisherPublicMetadata = {
  manuscript_title: string | null;
  word_count: number;
  growth: GrowthDashboardData;
  revision: RevisionDashboardData;
};

export type DashboardViewData =
  | { mode: "PLANNING"; manuscriptId: string; tenantId: string; revision_lock_active: boolean; data: PlanningDashboardData }
  | { mode: "DRAFTING"; manuscriptId: string; tenantId: string; revision_lock_active: boolean; data: DraftingDashboardData }
  | { mode: "REVISION"; manuscriptId: string; tenantId: string; revision_lock_active: boolean; data: RevisionDashboardData }
  | { mode: "BUSINESS"; manuscriptId: string; tenantId: string; revision_lock_active: boolean; data: BusinessDashboardData }
  | { mode: "GROWTH"; manuscriptId: string; tenantId: string; revision_lock_active: boolean; data: GrowthDashboardData };

const EXCERPT_LEN = 420;

function excerpt(text: string, max = EXCERPT_LEN): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function isRevisionLockActive(row: P4ManuscriptRow, now = Date.now()): boolean {
  if (row.revision_status !== "LOCKED") return false;
  if (!row.lock_expires_at) return false;
  return now < new Date(row.lock_expires_at).getTime();
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function isOutlinePlot(meta: Record<string, unknown>, manuscriptId: string): boolean {
  if (meta["outline"] === true || meta["is_outline"] === true) return true;
  if (String(meta["manuscript_id"] ?? "") === manuscriptId) return true;
  return false;
}

/** Aligns with RAG / HUD plot_point_order ladder (1–9+). */
const PLOT_POINT_ORDER_BY_NAME: Record<string, number> = {
  hook: 1,
  inciting_incident: 2,
  internal_pivot: 3,
  point_of_no_return: 4,
  midpoint: 5,
  deepdive_aha: 6,
  climax: 7,
  twist: 8,
  resolution: 9,
  parallel_arc: 10,
  not_applicable: 0,
};

function resolvedPlotPointOrderFromRow(r: Record<string, unknown>): number | null {
  const meta = asRecord(r["metadata"]);
  const direct = meta["plot_point_order"];
  if (direct != null && Number.isFinite(Number(direct))) {
    return Math.floor(Number(direct));
  }
  const pp = meta["plot_point"];
  if (pp != null && typeof pp === "string") {
    const mapped = PLOT_POINT_ORDER_BY_NAME[String(pp).toLowerCase()];
    if (mapped !== undefined) return mapped;
  }
  return null;
}

function mean(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function computeHalPulse(sessions: DraftingHalSession[]): DraftingDashboardData["hal_pulse"] {
  const halScores = sessions.map((s) => s.hal_score).filter((n): n is number => n != null && Number.isFinite(n));
  const typing = sessions.map((s) => s.typing_score).filter((n): n is number => n != null && Number.isFinite(n));
  return {
    mean_hal_score: mean(halScores),
    mean_typing_score: mean(typing),
    session_count: sessions.length,
  };
}

function computeWordCountVelocityWph(sessionsChrono: DraftingHalSession[]): number | null {
  const withWords = sessionsChrono.filter(
    (s) => s.total_words != null && Number.isFinite(s.total_words) && (s.total_words as number) >= 0
  ) as Array<DraftingHalSession & { total_words: number }>;
  if (withWords.length < 2) return null;
  const a = withWords[withWords.length - 2]!;
  const b = withWords[withWords.length - 1]!;
  const t0 = new Date(a.created_at).getTime();
  const t1 = new Date(b.created_at).getTime();
  const hours = (t1 - t0) / (1000 * 60 * 60);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const dw = b.total_words - a.total_words;
  return Math.round((dw / hours) * 10) / 10;
}

export class DashboardOrchestratorService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async loadManuscript(manuscriptId: string): Promise<P4ManuscriptRow> {
    const { data, error } = await this.supabase
      .from("p4_manuscripts")
      .select("*")
      .eq("id", manuscriptId)
      .maybeSingle();
    if (error) throw new Error(`DashboardOrchestratorService: ${error.message}`);
    if (!data) throw new Error(`Manuscript not found: ${manuscriptId}`);
    return data as P4ManuscriptRow;
  }

  /**
   * Linguistic DNA (GROWTH) + consistency audit (REVISION) for publisher-facing verify pages.
   * Does not expose `body_text`; callers attach prose separately when grant level allows.
   */
  async getPublisherPublicMetadata(manuscriptId: string): Promise<PublisherPublicMetadata> {
    const ms = await this.loadManuscript(manuscriptId);
    try {
      await new BadgeCertificationService(this.supabase).syncMintableBadges(manuscriptId, ms);
    } catch {
      /* p4_manuscript_badges may be absent until migration */
    }
    const revision_lock_active = isRevisionLockActive(ms);
    const body = String(ms.body_text ?? "");
    const mpOrch = new MarketplaceOrchestrator(this.supabase);
    const marketplace = MarketplaceOrchestrator.hubVisibilityFromManuscript(ms);
    let marketplace_interest: InterestMetrics = {
      manuscript_id: manuscriptId,
      total_interactions: 0,
      like_count: 0,
      track_count: 0,
      unique_interested_parties: 0,
    };
    try {
      marketplace_interest = await mpOrch.getInterestMetrics(manuscriptId);
    } catch {
      /* metrics optional until migration */
    }
    const mSlice = { marketplace, marketplace_interest };
    const hpOrch = new HelperProofService(this.supabase);
    let helper_proof: HelperProofAuditSnapshot = HelperProofService.emptyAuditSnapshot(
      manuscriptId,
      ms.verified_human_flow_at ?? null
    );
    try {
      helper_proof = await hpOrch.getAuditSnapshot(
        manuscriptId,
        ms.verified_human_flow_at ?? null,
        ms.tenant_id
      );
    } catch {
      /* tables may not exist until migration */
    }
    const proofSlice = { helper_proof };
    const [growthCore, revisionCore] = await Promise.all([
      this.fetchGrowthSubset(manuscriptId, ms.tenant_id),
      this.fetchRevisionSubset(ms, revision_lock_active),
    ]);
    return {
      manuscript_title: ms.title,
      word_count: countWords(body),
      growth: { ...growthCore, ...mSlice, ...proofSlice },
      revision: { ...revisionCore, ...mSlice, ...proofSlice },
    };
  }

  /**
   * Returns only the subset appropriate for `mode`. `DRAFTING` is withheld when a revision lock is active.
   */
  async getDashboardViewData(mode: DashboardMode, manuscriptId: string): Promise<DashboardViewData> {
    const ms = await this.loadManuscript(manuscriptId);
    try {
      await new BadgeCertificationService(this.supabase).syncMintableBadges(manuscriptId, ms);
    } catch {
      /* p4_manuscript_badges may be absent until migration */
    }
    const tenantId = ms.tenant_id;
    const revision_lock_active = isRevisionLockActive(ms);

    const marketplace = MarketplaceOrchestrator.hubVisibilityFromManuscript(ms);
    const mpOrch = new MarketplaceOrchestrator(this.supabase);
    let marketplace_interest: InterestMetrics = {
      manuscript_id: manuscriptId,
      total_interactions: 0,
      like_count: 0,
      track_count: 0,
      unique_interested_parties: 0,
    };
    try {
      marketplace_interest = await mpOrch.getInterestMetrics(manuscriptId);
    } catch {
      /* `get_marketplace_interest_metrics` / table may be absent until migration. */
    }
    const marketplaceSlices = { marketplace, marketplace_interest };

    const hpOrch = new HelperProofService(this.supabase);
    let helper_proof: HelperProofAuditSnapshot = HelperProofService.emptyAuditSnapshot(
      manuscriptId,
      ms.verified_human_flow_at ?? null
    );
    try {
      helper_proof = await hpOrch.getAuditSnapshot(
        manuscriptId,
        ms.verified_human_flow_at ?? null,
        ms.tenant_id
      );
    } catch {
      /* `p4_project_milestones` may be absent until migration */
    }
    const hubSlices = { ...marketplaceSlices, helper_proof };

    switch (mode) {
      case "PLANNING":
        return {
          mode,
          manuscriptId,
          tenantId,
          revision_lock_active,
          data: { ...(await this.fetchPlanningSubset(ms, manuscriptId)), ...hubSlices },
        };

      case "DRAFTING":
        return {
          mode,
          manuscriptId,
          tenantId,
          revision_lock_active,
          data: { ...(await this.fetchDraftingSubset(ms, revision_lock_active)), ...hubSlices },
        };

      case "REVISION":
        return {
          mode,
          manuscriptId,
          tenantId,
          revision_lock_active,
          data: { ...(await this.fetchRevisionSubset(ms, revision_lock_active)), ...hubSlices },
        };

      case "BUSINESS":
        return {
          mode,
          manuscriptId,
          tenantId,
          revision_lock_active,
          data: { ...(await this.fetchBusinessSubset(tenantId, manuscriptId)), ...hubSlices },
        };

      case "GROWTH":
        return {
          mode,
          manuscriptId,
          tenantId,
          revision_lock_active,
          data: { ...(await this.fetchGrowthSubset(manuscriptId, tenantId)), ...hubSlices },
        };

      default: {
        const _exhaustive: never = mode;
        return _exhaustive;
      }
    }
  }

  private async fetchPlanningSubset(
    ms: P4ManuscriptRow,
    manuscriptId: string
  ): Promise<Omit<PlanningDashboardData, "marketplace" | "marketplace_interest" | "helper_proof">> {
    const tenantId = ms.tenant_id;
    const { data: lore, error: e1 } = await this.supabase
      .from("p4_narrative_library_chunks")
      .select("id, chunk_type, source_document, chunk_index, word_count, content")
      .eq("tenant_id", tenantId)
      .eq("chunk_type", "lore")
      .order("source_document", { ascending: true })
      .order("chunk_index", { ascending: true })
      .limit(120);

    if (e1) throw new Error(`PLANNING lore: ${e1.message}`);

    const { data: plot, error: e2 } = await this.supabase
      .from("p4_narrative_library_chunks")
      .select("id, chunk_type, source_document, chunk_index, word_count, content, metadata")
      .eq("tenant_id", tenantId)
      .eq("chunk_type", "plot")
      .order("source_document", { ascending: true })
      .order("chunk_index", { ascending: true })
      .limit(120);

    if (e2) throw new Error(`PLANNING plot: ${e2.message}`);

    const toPreview = (r: Record<string, unknown>): DashboardChunkPreview => ({
      id: String(r["id"]),
      chunk_type: String(r["chunk_type"]),
      source_document: String(r["source_document"] ?? ""),
      chunk_index: Number(r["chunk_index"] ?? 0),
      word_count: Number(r["word_count"] ?? 0),
      excerpt: excerpt(String(r["content"] ?? "")),
    });

    const toPlotPreview = (r: Record<string, unknown>): DashboardChunkPreview => ({
      ...toPreview(r),
      plot_point_order: resolvedPlotPointOrderFromRow(r),
    });

    const outlineRows =
      (plot ?? []).filter((r) => {
        const meta = asRecord((r as Record<string, unknown>)["metadata"]);
        return isOutlinePlot(meta, manuscriptId);
      }) ?? [];

    const bible = (lore ?? []).map((r) => toPreview(r as Record<string, unknown>));
    const outline =
      outlineRows.length > 0
        ? outlineRows.map((r) => toPlotPreview(r as Record<string, unknown>))
        : (plot ?? []).map((r) => toPlotPreview(r as Record<string, unknown>));

    return {
      manuscript_outline: ms.outline?.trim() ? ms.outline : null,
      bible,
      outline,
    };
  }

  private async fetchDraftingSubset(
    ms: P4ManuscriptRow,
    revisionLockActive: boolean
  ): Promise<Omit<DraftingDashboardData, "marketplace" | "marketplace_interest" | "helper_proof">> {
    const body = String(ms.body_text ?? "");
    const word_count = countWords(body);
    const tailWords = 180;
    const words = body.trim().split(/\s+/).filter(Boolean);
    const live_excerpt =
      words.length <= tailWords ? body.trim() : words.slice(-tailWords).join(" ");

    const hal_live: DraftingDashboardData["hal_live"] = { recent_sessions: [] };

    if (!revisionLockActive) {
      const { data: halRows, error } = await this.supabase
        .from(P4_HAL_LEDGER)
        .select("id, created_at, raw_sample, stylometric_snapshot, tenant_id")
        .eq("tenant_id", ms.tenant_id)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw new Error(`DRAFTING hal: ${error.message}`);

      for (const row of halRows ?? []) {
        const rec = row as Record<string, unknown>;
        const raw = asRecord(rec["raw_sample"]);
        const snap = asRecord(rec["stylometric_snapshot"]);
        const mid = raw["manuscriptId"] != null ? String(raw["manuscriptId"]) : null;
        if (mid && mid !== ms.id) continue;
        const tw = raw["total_words"];
        hal_live.recent_sessions.push({
          ledger_id: String(rec["id"]),
          created_at: String(rec["created_at"] ?? ""),
          manuscript_id_in_sample: mid,
          hal_score:
            typeof raw["hal_score"] === "number"
              ? raw["hal_score"]
              : typeof snap["hal_score_final"] === "number"
                ? (snap["hal_score_final"] as number)
                : null,
          typing_score:
            typeof raw["typing_score"] === "number"
              ? raw["typing_score"]
              : typeof snap["typing_score"] === "number"
                ? (snap["typing_score"] as number)
                : null,
          is_ime_session:
            typeof snap["is_ime_session"] === "boolean"
              ? snap["is_ime_session"]
              : typeof raw["is_ime_session"] === "boolean"
                ? (raw["is_ime_session"] as boolean)
                : null,
          total_words: typeof tw === "number" && Number.isFinite(tw) ? tw : null,
        });
        if (hal_live.recent_sessions.length >= 5) break;
      }
    }

    const chrono = [...hal_live.recent_sessions].reverse();
    const hal_pulse = computeHalPulse(hal_live.recent_sessions);
    const word_count_velocity_wph = computeWordCountVelocityWph(chrono);

    return {
      draftingEnabled: !revisionLockActive,
      revision_lock: {
        active: revisionLockActive,
        lock_expires_at: ms.lock_expires_at,
        lock_tier: ms.lock_tier,
      },
      current_chapter: {
        manuscript_title: ms.title,
        word_count,
        live_excerpt: revisionLockActive ? "" : excerpt(live_excerpt, 2500),
      },
      hal_live,
      hal_pulse,
      word_count_velocity_wph,
    };
  }

  private async fetchRevisionSubset(
    ms: P4ManuscriptRow,
    revision_lock_active: boolean
  ): Promise<Omit<RevisionDashboardData, "marketplace" | "marketplace_interest" | "helper_proof">> {
    const manuscriptId = ms.id;

    const { data: reports, error: rErr } = await this.supabase
      .from("p4_revision_reports")
      .select("id, finding_type, severity, created_at, cosine_similarity")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (rErr) throw new Error(`REVISION reports: ${rErr.message}`);

    const { data: queue, error: qErr } = await this.supabase
      .from("p4_audit_queue")
      .select("id, status, priority, created_at, comprehensive_report")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false })
      .limit(15);

    if (qErr) throw new Error(`REVISION audit_queue: ${qErr.message}`);

    let latest_comprehensive_report: Record<string, unknown> | null = null;
    if (ms.revision_status === "AUDITING_COMPLETE") {
      const { data: rep, error: repErr } = await this.supabase
        .from("p4_audit_queue")
        .select("comprehensive_report, completed_at")
        .eq("manuscript_id", manuscriptId)
        .eq("status", "COMPLETE")
        .not("comprehensive_report", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!repErr && rep && rep.comprehensive_report && typeof rep.comprehensive_report === "object") {
        latest_comprehensive_report = rep.comprehensive_report as Record<string, unknown>;
      }
    }

    return {
      revision_status: ms.revision_status,
      lock_tier: ms.lock_tier,
      lock_expires_at: ms.lock_expires_at,
      revision_lock_active,
      recent_revision_reports: (reports ?? []).map((x) => {
        const o = x as Record<string, unknown>;
        return {
          id: String(o["id"]),
          finding_type: String(o["finding_type"] ?? ""),
          severity: String(o["severity"] ?? ""),
          created_at: String(o["created_at"] ?? ""),
          cosine_similarity:
            typeof o["cosine_similarity"] === "number" ? (o["cosine_similarity"] as number) : null,
        };
      }),
      audit_queue: (queue ?? []).map((x) => {
        const o = x as Record<string, unknown>;
        return {
          id: String(o["id"]),
          status: String(o["status"] ?? ""),
          priority: Number(o["priority"] ?? 0),
          created_at: String(o["created_at"] ?? ""),
          has_comprehensive_report: o["comprehensive_report"] != null,
        };
      }),
      latest_comprehensive_report,
    };
  }

  private async fetchBusinessSubset(
    tenantId: string,
    manuscriptId: string
  ): Promise<Omit<BusinessDashboardData, "marketplace" | "marketplace_interest" | "helper_proof">> {
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signalsWindow, error } = await this.supabase
      .from("p4_author_signal")
      .select("id, kind, title, body, created_at, manuscript_id, payload")
      .eq("tenant_id", tenantId)
      .or(`manuscript_id.eq.${manuscriptId},manuscript_id.is.null`)
      .gte("created_at", since14d)
      .order("created_at", { ascending: false })
      .limit(400);

    if (error) throw new Error(`BUSINESS signals: ${error.message}`);

    const signalRows: AuthorSignalRow[] = (signalsWindow ?? []).map((x) => {
      const o = x as Record<string, unknown>;
      const p = o["payload"];
      return {
        id: String(o["id"]),
        kind: String(o["kind"] ?? ""),
        title: String(o["title"] ?? ""),
        body: String(o["body"] ?? ""),
        created_at: String(o["created_at"] ?? ""),
        manuscript_id: o["manuscript_id"] != null ? String(o["manuscript_id"]) : null,
        payload: p && typeof p === "object" ? (p as Record<string, unknown>) : null,
      };
    });

    const fan_signals: AuthorSignalPreview[] = signalRows.slice(0, 50).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      created_at: r.created_at,
      manuscript_id: r.manuscript_id,
    }));

    const manual = new BusinessManualService(this.supabase);
    const [marketing_wins, marketing_hal_correlation] = await Promise.all([
      manual.listMarketingWins(tenantId, manuscriptId, 40),
      manual.fetchMarketingHalCorrelation(tenantId, manuscriptId, 60),
    ]);

    const live_pulse = LiveEngagementOrchestrator.computeLivePulse(signalRows, manuscriptId);
    const business_activity_timeline = LiveEngagementOrchestrator.mergeBusinessActivityTimeline(
      marketing_wins,
      signalRows,
      manuscriptId
    );

    return {
      sales: { revenue_ytd_usd: null, units_sold: null, last_sync_at: null },
      fan_interaction: { messages_30d: null, engagement_score: null, last_sync_at: null },
      fan_signals,
      marketing_wins,
      marketing_hal_correlation,
      live_pulse,
      business_activity_timeline,
      note:
        "Stripe / CRM metrics are mocked in the UI stream; fan signals load from p4_author_signal. Manual wins use p4_manual_marketing_data; correlation uses p4_v_marketing_hal_correlation when the HAL ledger is deployed. Live pulse + overlay merge via LiveEngagementOrchestrator; subscribe to Realtime on p4_author_signal for tenant.",
    };
  }

  private async fetchCraftTrajectory(
    authorId: string
  ): Promise<{ trajectory: CraftTrajectoryPoint[]; pairwise: CraftGrowthResult[] }> {
    const { data: rows, error } = await this.supabase
      .from(P4_HAL_LEDGER)
      .select("id, created_at, stylometric_snapshot")
      .eq("author_user_id", authorId)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) throw new Error(`craft trajectory: ${error.message}`);

    const chronological = [...(rows ?? [])].reverse();
    const trajectory: CraftTrajectoryPoint[] = [];
    for (const row of chronological) {
      const rec = row as Record<string, unknown>;
      const snap = asRecord(rec["stylometric_snapshot"]);
      const craft = craftSessionFromStylometricSnapshot(snap);
      if (!craft) continue;
      trajectory.push({
        ledger_id: String(rec["id"]),
        created_at: String(rec["created_at"] ?? ""),
        craft,
      });
    }

    const pairwise: CraftGrowthResult[] = [];
    for (let i = 1; i < trajectory.length; i += 1) {
      pairwise.push(calculateCraftGrowth(trajectory[i - 1]!.craft, trajectory[i]!.craft));
    }

    return { trajectory, pairwise };
  }

  private async fetchGrowthSubset(
    manuscriptId: string,
    tenantId: string
  ): Promise<Omit<GrowthDashboardData, "marketplace" | "marketplace_interest" | "helper_proof">> {
    const telemetry = new AuthorTelemetryService(this.supabase);
    const milestones = await telemetry.calculateProjectMilestones(manuscriptId);

    let telemetry_author_id: string | null = null;
    const { data: halAuthors, error } = await this.supabase
      .from(P4_HAL_LEDGER)
      .select("author_user_id, raw_sample")
      .eq("tenant_id", tenantId)
      .not("author_user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);

    if (!error && halAuthors) {
      for (const row of halAuthors) {
        const raw = asRecord((row as Record<string, unknown>)["raw_sample"]);
        if (String(raw["manuscriptId"] ?? "") === manuscriptId) {
          const aid = (row as Record<string, unknown>)["author_user_id"];
          if (aid) {
            telemetry_author_id = String(aid);
            break;
          }
        }
      }
      if (!telemetry_author_id && halAuthors[0]) {
        telemetry_author_id = String((halAuthors[0] as Record<string, unknown>)["author_user_id"] ?? "") || null;
      }
    }

    let growth_delta: GrowthReportSessionDelta | null = null;
    let craft_trajectory: CraftTrajectoryPoint[] = [];
    let craft_pairwise: CraftGrowthResult[] = [];

    if (telemetry_author_id) {
      const { delta } = await telemetry.buildGrowthReportDelta(telemetry_author_id, 15);
      growth_delta = delta;
      const craft = await this.fetchCraftTrajectory(telemetry_author_id);
      craft_trajectory = craft.trajectory;
      craft_pairwise = craft.pairwise;
    }

    return {
      milestones,
      growth_delta,
      telemetry_author_id,
      craft_trajectory,
      craft_pairwise,
    };
  }
}
