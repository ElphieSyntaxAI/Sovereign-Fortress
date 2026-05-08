/**
 * Helper labor proof: SEED / GROWTH / HARVEST milestones gate completion and author payout verification.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { GuildTierService } from "./GuildTierService.js";

export type HelperMilestoneType = "SEED" | "GROWTH" | "HARVEST";

export const HELPER_MILESTONE_ORDER: HelperMilestoneType[] = ["SEED", "GROWTH", "HARVEST"];

export type HelperMilestoneRow = {
  id: string;
  project_id: string;
  milestone_type: HelperMilestoneType;
  file_url: string;
  uploaded_at: string;
};

export type HelperMilestoneAuditStage = {
  milestone_type: HelperMilestoneType;
  file_url: string | null;
  uploaded_at: string | null;
};

export type HelperProofAuditSnapshot = {
  project_id: string;
  /** Always three rows in SEED → GROWTH → HARVEST order for audit UI. */
  stages: HelperMilestoneAuditStage[];
  all_milestones_uploaded: boolean;
  missing_milestone_types: HelperMilestoneType[];
  verified_human_flow_at: string | null;
  /** Guild tally of author-verified human-flow projects for this tenant (when `tenantId` was supplied). */
  guild_verified_project_count?: number;
};

export type HelperCompletionGate = {
  allowed: boolean;
  missing_milestone_types: HelperMilestoneType[];
  message: string;
};

export class HelperProofService {
  constructor(private readonly supabase: SupabaseClient) {}

  static emptyAuditSnapshot(
    projectId: string,
    verifiedAt: string | null,
    guildVerifiedCount?: number
  ): HelperProofAuditSnapshot {
    return {
      project_id: projectId,
      stages: HELPER_MILESTONE_ORDER.map((milestone_type) => ({
        milestone_type,
        file_url: null,
        uploaded_at: null,
      })),
      all_milestones_uploaded: false,
      missing_milestone_types: [...HELPER_MILESTONE_ORDER],
      verified_human_flow_at: verifiedAt,
      guild_verified_project_count: guildVerifiedCount,
    };
  }

  /**
   * Three-stage evolution for the author audit view (URLs redacted server-side if you proxy storage; here full URLs).
   */
  async getAuditSnapshot(
    projectId: string,
    verifiedHumanFlowAt: string | null,
    tenantId?: string | null
  ): Promise<HelperProofAuditSnapshot> {
    let guild_verified_project_count: number | undefined;
    if (tenantId?.trim()) {
      try {
        guild_verified_project_count = await new GuildTierService(this.supabase).getVerifiedProjectCount(
          tenantId.trim()
        );
      } catch {
        guild_verified_project_count = undefined;
      }
    }

    const { data, error } = await this.supabase
      .from("p4_project_milestones")
      .select("id, project_id, milestone_type, file_url, uploaded_at")
      .eq("project_id", projectId);

    if (error) {
      return HelperProofService.emptyAuditSnapshot(projectId, verifiedHumanFlowAt, guild_verified_project_count);
    }

    const byType = new Map<HelperMilestoneType, HelperMilestoneRow>();
    for (const raw of data ?? []) {
      const o = raw as Record<string, unknown>;
      const t = String(o["milestone_type"] ?? "") as HelperMilestoneType;
      if (!HELPER_MILESTONE_ORDER.includes(t)) continue;
      byType.set(t, {
        id: String(o["id"]),
        project_id: String(o["project_id"]),
        milestone_type: t,
        file_url: String(o["file_url"] ?? ""),
        uploaded_at: String(o["uploaded_at"] ?? ""),
      });
    }

    const stages: HelperMilestoneAuditStage[] = HELPER_MILESTONE_ORDER.map((milestone_type) => {
      const row = byType.get(milestone_type);
      if (!row || !row.file_url.trim()) {
        return { milestone_type, file_url: null, uploaded_at: null };
      }
      return {
        milestone_type,
        file_url: row.file_url,
        uploaded_at: row.uploaded_at,
      };
    });

    const missing = stages.filter((s) => !s.file_url).map((s) => s.milestone_type);

    return {
      project_id: projectId,
      stages,
      all_milestones_uploaded: missing.length === 0,
      missing_milestone_types: missing,
      verified_human_flow_at: verifiedHumanFlowAt,
      guild_verified_project_count,
    };
  }

  async assertAllMilestonesUploaded(projectId: string): Promise<boolean> {
    const snap = await this.getAuditSnapshot(projectId, null);
    return snap.all_milestones_uploaded;
  }

  /**
   * Blocks Helper "Complete project" until SEED, GROWTH, and HARVEST rows exist with non-empty `file_url`.
   */
  async validateHelperCanCompleteProject(projectId: string): Promise<HelperCompletionGate> {
    const snap = await this.getAuditSnapshot(projectId, null);
    if (snap.all_milestones_uploaded) {
      return { allowed: true, missing_milestone_types: [], message: "All milestones present." };
    }
    return {
      allowed: false,
      missing_milestone_types: snap.missing_milestone_types,
      message: `Upload missing milestones before completing: ${snap.missing_milestone_types.join(", ")}`,
    };
  }

  async recordMilestone(input: {
    projectId: string;
    milestoneType: HelperMilestoneType;
    fileUrl: string;
  }): Promise<HelperMilestoneRow> {
    const file_url = input.fileUrl.trim();
    if (!file_url) throw new Error("fileUrl is required");

    const { data, error } = await this.supabase
      .from("p4_project_milestones")
      .upsert(
        {
          project_id: input.projectId,
          milestone_type: input.milestoneType,
          file_url,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "project_id,milestone_type" }
      )
      .select("id, project_id, milestone_type, file_url, uploaded_at")
      .single();

    if (error) throw new Error(`recordMilestone: ${error.message}`);

    const o = data as Record<string, unknown>;
    return {
      id: String(o["id"]),
      project_id: String(o["project_id"]),
      milestone_type: String(o["milestone_type"]) as HelperMilestoneType,
      file_url: String(o["file_url"]),
      uploaded_at: String(o["uploaded_at"]),
    };
  }
}
