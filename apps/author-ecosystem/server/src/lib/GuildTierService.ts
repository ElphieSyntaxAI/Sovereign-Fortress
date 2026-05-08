/**
 * Guild tier progression: `project_count` reflects author-verified human-flow completions
 * (see `p4_guild_tier_counters` and triggers on `p4_manuscripts.verified_human_flow_at`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export class GuildTierService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Current verified-project tally for a tenant (guild). Increments are applied in the database
   * when `verified_human_flow_at` is first set on a manuscript (see migration trigger).
   */
  /**
   * Guild tier for apprentice / progression gates: **Tier 1** = no verified completions; **Tier 2** = 1–2; **Tier 3+** = 3+.
   * “Tier 2+” in product copy means `getGuildTierLevel(tenantId) >= 2`.
   */
  async getGuildTierLevel(tenantId: string): Promise<number> {
    const n = await this.getVerifiedProjectCount(tenantId);
    if (n <= 0) return 1;
    if (n <= 2) return 2;
    return 3;
  }

  async getVerifiedProjectCount(tenantId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("p4_guild_tier_counters")
      .select("project_count")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw new Error(`getVerifiedProjectCount: ${error.message}`);
    if (!data) return 0;
    const n = (data as { project_count?: number }).project_count;
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  }

  /**
   * Idempotent upsert of the counter row (admin / backfill). Normal increments happen via DB trigger.
   */
  async setVerifiedProjectCount(tenantId: string, projectCount: number): Promise<void> {
    const { error } = await this.supabase.from("p4_guild_tier_counters").upsert(
      {
        tenant_id: tenantId,
        project_count: Math.max(0, Math.floor(projectCount)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

    if (error) throw new Error(`setVerifiedProjectCount: ${error.message}`);
  }
}
