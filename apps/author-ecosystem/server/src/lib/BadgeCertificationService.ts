/**
 * Badge registry + automatic mint when HAL / completion or helper milestone gates are satisfied.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { P4_HAL_LEDGER } from "./database/canonicalIdentifiers.js";
import { HelperProofService } from "./HelperProofService.js";
import type { P4ManuscriptRow } from "./RevisionLockService.js";

export type P4BadgeType = "HUMAN_AUTHORED" | "HUMAN_EDITED";

export type P4ManuscriptBadgeRow = {
  id: string;
  manuscript_id: string;
  badge_type: P4BadgeType;
  verification_payload: Record<string, unknown>;
  minted_at: string;
};

/** Public Fan Hub response — no raw storage URLs or body text. */
export type VerifyBadgePublicResponse = {
  badge_id: string;
  badge_type: P4BadgeType;
  minted_at: string;
  manuscript_id: string;
  forensic_summary: {
    hal_session_count: number | null;
    hal_mean_score_at_mint: number | null;
    first_draft_session_at: string | null;
    last_draft_session_at: string | null;
    project_completion: {
      project_completed_at: string | null;
      revision_status_at_mint: string | null;
    } | null;
    helper_milestones: Array<{
      milestone_type: string;
      uploaded_at: string | null;
    }> | null;
  };
};

const HAL_HUMAN_AUTHORED_MIN = 0.9;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function halScoreFromLedgerRow(row: Record<string, unknown>): number | null {
  const raw = asRecord(row["raw_sample"]);
  const snap = asRecord(row["stylometric_snapshot"]);
  const fromRaw = raw["hal_score"];
  if (typeof fromRaw === "number" && Number.isFinite(fromRaw)) return fromRaw;
  const fromSnap = snap["hal_score_final"];
  if (typeof fromSnap === "number" && Number.isFinite(fromSnap)) return fromSnap;
  return null;
}

function isManuscriptProjectComplete(ms: P4ManuscriptRow): boolean {
  const explicit = ms.project_completed_at != null && String(ms.project_completed_at).trim() !== "";
  const auditComplete = ms.revision_status === "AUDITING_COMPLETE";
  return explicit || auditComplete;
}

async function halStatsForManuscript(
  supabase: SupabaseClient,
  tenantId: string,
  manuscriptId: string,
  sampleLimit = 64
): Promise<{
  mean: number;
  session_count: number;
  first_at: string | null;
  last_at: string | null;
}> {
  const { data, error } = await supabase
    .from(P4_HAL_LEDGER)
    .select("raw_sample, stylometric_snapshot, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(sampleLimit);

  if (error) {
    return { mean: 0, session_count: 0, first_at: null, last_at: null };
  }

  const scores: number[] = [];
  const times: string[] = [];
  for (const row of data ?? []) {
    const raw = asRecord((row as Record<string, unknown>)["raw_sample"]);
    if (String(raw["manuscriptId"] ?? "") !== manuscriptId) continue;
    const ca = (row as Record<string, unknown>)["created_at"];
    if (typeof ca === "string" && ca) times.push(ca);
    const s = halScoreFromLedgerRow(row as Record<string, unknown>);
    if (s != null) scores.push(s);
  }

  const sortedTimes = [...times].sort();
  const first_at = sortedTimes.length ? sortedTimes[0]! : null;
  const last_at = sortedTimes.length ? sortedTimes[sortedTimes.length - 1]! : null;
  const session_count = times.length;

  if (scores.length === 0) {
    return { mean: 0, session_count, first_at, last_at };
  }

  const mean = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10_000) / 10_000;
  return {
    mean,
    session_count,
    first_at,
    last_at,
  };
}

export class BadgeCertificationService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Idempotent mint: inserts rows when gates first pass; ignores unique violations.
   */
  async syncMintableBadges(manuscriptId: string, ms: P4ManuscriptRow): Promise<{ minted: P4BadgeType[] }> {
    const minted: P4BadgeType[] = [];
    const tenantId = ms.tenant_id;
    const hal = await halStatsForManuscript(this.supabase, tenantId, manuscriptId);

    if (hal.mean > HAL_HUMAN_AUTHORED_MIN && isManuscriptProjectComplete(ms)) {
      const payload: Record<string, unknown> = {
        hal_mean_score_at_mint: hal.mean,
        hal_session_count: hal.session_count,
        first_draft_session_at: hal.first_at,
        last_draft_session_at: hal.last_at,
        project_completed_at: ms.project_completed_at ?? null,
        revision_status_at_mint: ms.revision_status,
      };
      const inserted = await this.tryInsertBadge(manuscriptId, "HUMAN_AUTHORED", payload);
      if (inserted) minted.push("HUMAN_AUTHORED");
    }

    const helper = new HelperProofService(this.supabase);
    let milestonesOk = false;
    let snap = HelperProofService.emptyAuditSnapshot(manuscriptId, ms.verified_human_flow_at ?? null);
    try {
      snap = await helper.getAuditSnapshot(manuscriptId, ms.verified_human_flow_at ?? null);
      milestonesOk = snap.all_milestones_uploaded;
    } catch {
      milestonesOk = false;
    }

    if (milestonesOk) {
      const helperSummary = snap.stages.map((s) => ({
        milestone_type: s.milestone_type,
        uploaded_at: s.uploaded_at,
      }));
      const payload: Record<string, unknown> = {
        helper_milestones: helperSummary,
        verified_human_flow_at: ms.verified_human_flow_at ?? null,
      };
      const inserted = await this.tryInsertBadge(manuscriptId, "HUMAN_EDITED", payload);
      if (inserted) minted.push("HUMAN_EDITED");
    }

    return { minted };
  }

  private async tryInsertBadge(
    manuscriptId: string,
    badgeType: P4BadgeType,
    verification_payload: Record<string, unknown>
  ): Promise<boolean> {
    const { error } = await this.supabase.from("p4_manuscript_badges").insert({
      manuscript_id: manuscriptId,
      badge_type: badgeType,
      verification_payload,
      minted_at: new Date().toISOString(),
    });
    if (!error) return true;
    if (String(error.code) === "23505" || /duplicate key|unique constraint/i.test(error.message)) {
      return false;
    }
    throw new Error(`tryInsertBadge(${badgeType}): ${error.message}`);
  }

  /**
   * Public metadata for Fan Hub — keyed by opaque `p4_manuscript_badges.id`.
   */
  async getPublicVerifyPayload(badgeId: string): Promise<VerifyBadgePublicResponse | null> {
    const id = badgeId.trim();
    if (!id) return null;

    const { data, error } = await this.supabase
      .from("p4_manuscript_badges")
      .select("id, manuscript_id, badge_type, verification_payload, minted_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`getPublicVerifyPayload: ${error.message}`);
    if (!data) return null;

    const row = data as Record<string, unknown>;
    const badge_type = String(row["badge_type"] ?? "") as P4BadgeType;
    if (badge_type !== "HUMAN_AUTHORED" && badge_type !== "HUMAN_EDITED") return null;

    const payload = asRecord(row["verification_payload"]);
    const hal_session_count =
      typeof payload["hal_session_count"] === "number" && Number.isFinite(payload["hal_session_count"])
        ? (payload["hal_session_count"] as number)
        : null;
    const hal_mean =
      typeof payload["hal_mean_score_at_mint"] === "number" && Number.isFinite(payload["hal_mean_score_at_mint"])
        ? (payload["hal_mean_score_at_mint"] as number)
        : null;
    const first_draft =
      typeof payload["first_draft_session_at"] === "string" ? (payload["first_draft_session_at"] as string) : null;
    const last_draft =
      typeof payload["last_draft_session_at"] === "string" ? (payload["last_draft_session_at"] as string) : null;

    const project_completion =
      badge_type === "HUMAN_AUTHORED"
        ? {
            project_completed_at:
              typeof payload["project_completed_at"] === "string" ? (payload["project_completed_at"] as string) : null,
            revision_status_at_mint:
              typeof payload["revision_status_at_mint"] === "string"
                ? (payload["revision_status_at_mint"] as string)
                : null,
          }
        : null;

    let helper_milestones: VerifyBadgePublicResponse["forensic_summary"]["helper_milestones"] = null;
    if (badge_type === "HUMAN_EDITED") {
      const raw = payload["helper_milestones"];
      if (Array.isArray(raw)) {
        helper_milestones = raw.map((x) => {
          const o = asRecord(x);
          return {
            milestone_type: String(o["milestone_type"] ?? ""),
            uploaded_at: typeof o["uploaded_at"] === "string" ? o["uploaded_at"] : null,
          };
        });
      }
    }

    return {
      badge_id: String(row["id"]),
      badge_type,
      minted_at: String(row["minted_at"] ?? ""),
      manuscript_id: String(row["manuscript_id"] ?? ""),
      forensic_summary: {
        hal_session_count,
        hal_mean_score_at_mint: hal_mean,
        first_draft_session_at: first_draft,
        last_draft_session_at: last_draft,
        project_completion,
        helper_milestones,
      },
    };
  }
}
