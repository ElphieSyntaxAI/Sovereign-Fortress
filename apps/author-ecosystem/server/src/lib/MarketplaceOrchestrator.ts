/**
 * Marketplace: publishing intent drives hub visibility; anonymized interest metrics for competition.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { P4ManuscriptRow, PublishingIntent } from "./RevisionLockService.js";

export type { PublishingIntent } from "./RevisionLockService.js";

export type MarketplaceInteractionType = "LIKE" | "TRACK";

export type MarketplaceHubVisibility = {
  publishing_intent: PublishingIntent;
  is_seeking_agent: boolean;
  /** Hidden when intent is TRADITIONAL (trade / agent-led path). */
  show_helper_hub: boolean;
  /** Hidden when intent is SELF (indie / direct path). */
  show_publisher_hub: boolean;
};

export type InterestMetrics = {
  manuscript_id: string;
  total_interactions: number;
  like_count: number;
  track_count: number;
  /** Distinct opaque actor_ids — count only, never identities. */
  unique_interested_parties: number;
};

export class MarketplaceOrchestrator {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * TRADITIONAL → hide Helper Hub. SELF → hide Publisher Hub. UNDECIDED → both visible.
   */
  static hubVisibilityFromManuscript(ms: P4ManuscriptRow): MarketplaceHubVisibility {
    const intent = (ms.publishing_intent ?? "UNDECIDED") as PublishingIntent;
    return {
      publishing_intent: intent,
      is_seeking_agent: Boolean(ms.is_seeking_agent),
      show_helper_hub: intent !== "TRADITIONAL",
      show_publisher_hub: intent !== "SELF",
    };
  }

  /**
   * Aggregate interest for a manuscript (counts only; no actor identifiers returned).
   */
  async getInterestMetrics(manuscriptId: string): Promise<InterestMetrics> {
    const { data, error } = await this.supabase.rpc("get_marketplace_interest_metrics", {
      p_manuscript_id: manuscriptId,
    });

    if (error) {
      throw new Error(`getInterestMetrics: ${error.message}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row) {
      return {
        manuscript_id: manuscriptId,
        total_interactions: 0,
        like_count: 0,
        track_count: 0,
        unique_interested_parties: 0,
      };
    }

    return {
      manuscript_id: manuscriptId,
      total_interactions: Number(row["total_interactions"] ?? 0),
      like_count: Number(row["like_count"] ?? 0),
      track_count: Number(row["track_count"] ?? 0),
      unique_interested_parties: Number(row["unique_interested_parties"] ?? 0),
    };
  }

  /**
   * Record a LIKE or TRACK from an agent/publisher (opaque `actor_id` string).
   */
  async recordInteraction(input: {
    actorId: string;
    manuscriptId: string;
    interactionType: MarketplaceInteractionType;
  }): Promise<void> {
    const actor_id = input.actorId.trim();
    if (!actor_id) throw new Error("actorId is required");

    const { error } = await this.supabase.from("p4_marketplace_interactions").upsert(
      {
        actor_id,
        manuscript_id: input.manuscriptId,
        interaction_type: input.interactionType,
      },
      { onConflict: "actor_id,manuscript_id,interaction_type" }
    );

    if (error) throw new Error(`recordInteraction: ${error.message}`);
  }

  async setPublishingIntent(
    manuscriptId: string,
    intent: PublishingIntent,
    is_seeking_agent?: boolean
  ): Promise<void> {
    const patch: Record<string, unknown> = { publishing_intent: intent };
    if (typeof is_seeking_agent === "boolean") {
      patch["is_seeking_agent"] = is_seeking_agent;
    }

    const { error } = await this.supabase.from("p4_manuscripts").update(patch).eq("id", manuscriptId);

    if (error) throw new Error(`setPublishingIntent: ${error.message}`);
  }
}
