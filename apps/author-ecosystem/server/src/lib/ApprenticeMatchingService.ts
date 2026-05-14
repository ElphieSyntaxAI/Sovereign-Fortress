/**
 * Apprentice pool matching: guild tier + growth eligibility, genre-ranked helper queue, subsidized billing lock on `p4_projects`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { P4_HAL_LEDGER } from "./database/canonicalIdentifiers.js";
import { AuthorTelemetryService } from "./AuthorTelemetryService.js";
import type { GrowthReportSessionDelta } from "./AuthorTelemetryService.js";
import { GuildTierService } from "./GuildTierService.js";
import type { P4ManuscriptRow } from "./RevisionLockService.js";

export type P4HelperStatus = "AVAILABLE" | "MATCHED" | "PAUSED";

export type P4HelperRow = {
  id: string;
  display_name: string;
  role: string;
  genre_tags: string[];
  project_count: number;
  status: P4HelperStatus;
  created_at: string;
  updated_at: string;
};

export type P4ProjectBillingState = "STANDARD" | "SUBSIDIZED_APPRENTICE";

export type P4ProjectRow = {
  id: string;
  tenant_id: string;
  manuscript_id: string;
  billing_state: P4ProjectBillingState;
  matched_apprentice_helper_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ApprenticeClaimEligibility = {
  allowed: boolean;
  reasons: string[];
  guild_tier_level: number | null;
  growth_delta_positive: boolean;
  revision_lock_cycles_completed: number;
  author_linked_to_manuscript: boolean;
};

export type RankedHelper = P4HelperRow & { genre_alignment_score: number };

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Higher = stronger genre fit (substring / token overlap between author genre and helper tags). */
export function genreAlignmentScore(authorGenre: string | null | undefined, helperTags: string[]): number {
  const g = String(authorGenre ?? "")
    .trim()
    .toLowerCase();
  if (!g) return 0;

  const authorTokens = new Set(
    g
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ""))
      .filter((w) => w.length > 2)
  );

  let best = 0;
  for (const raw of helperTags) {
    const tag = String(raw ?? "")
      .trim()
      .toLowerCase();
    if (!tag) continue;

    if (g.includes(tag)) best = Math.max(best, 2 + tag.length / Math.max(g.length, 1));
    if (tag.includes(g)) best = Math.max(best, 1.5);

    const tagTokens = tag.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]+/gu, "")).filter((w) => w.length > 2);
    for (const tt of tagTokens) {
      if (authorTokens.has(tt)) best = Math.max(best, 3);
      for (const at of authorTokens) {
        if (at.includes(tt) || tt.includes(at)) best = Math.max(best, 2);
      }
    }
  }
  return best;
}

function aggregateGrowthDelta(delta: GrowthReportSessionDelta | null): number | null {
  if (!delta) return null;
  return (
    delta.vocabulary_density_delta +
    delta.sentence_complexity_delta +
    delta.hal_rhythm_consistency_delta +
    delta.average_sentence_length_delta
  );
}

export class ApprenticeMatchingService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Author must be guild **Tier 2+** (`GuildTierService.getGuildTierLevel` ≥ 2).
   * Growth trajectory aggregate (first vs last HAL window) must be **> 0**.
   * Manuscript must have **≥ 1** completed revision-lock cycle (`revision_lock_cycles_completed`).
   * `authorId` must appear on this manuscript in `p4_hal_ledger` (`raw_sample.manuscriptId`).
   */
  async canClaimApprentice(authorId: string, manuscriptId: string): Promise<ApprenticeClaimEligibility> {
    const reasons: string[] = [];
    const trimmedAuthor = authorId.trim();
    const trimmedMs = manuscriptId.trim();

    if (!trimmedAuthor || !trimmedMs) {
      return {
        allowed: false,
        reasons: ["authorId and manuscriptId are required."],
        guild_tier_level: null,
        growth_delta_positive: false,
        revision_lock_cycles_completed: 0,
        author_linked_to_manuscript: false,
      };
    }

    const { data: msRow, error: msErr } = await this.supabase
      .from("p4_manuscripts")
      .select("id, tenant_id, genre_primary, revision_lock_cycles_completed")
      .eq("id", trimmedMs)
      .maybeSingle();

    if (msErr) throw new Error(`canClaimApprentice: ${msErr.message}`);
    if (!msRow) {
      return {
        allowed: false,
        reasons: ["Manuscript not found."],
        guild_tier_level: null,
        growth_delta_positive: false,
        revision_lock_cycles_completed: 0,
        author_linked_to_manuscript: false,
      };
    }

    const ms = msRow as Record<string, unknown>;
    const tenantId = String(ms["tenant_id"] ?? "");
    const genre_primary = ms["genre_primary"] != null ? String(ms["genre_primary"]) : null;
    const revision_lock_cycles_completed = Number(ms["revision_lock_cycles_completed"] ?? 0);

    const guild = new GuildTierService(this.supabase);
    let guild_tier_level: number | null = null;
    try {
      guild_tier_level = await guild.getGuildTierLevel(tenantId);
    } catch {
      guild_tier_level = null;
    }

    if (guild_tier_level == null || guild_tier_level < 2) {
      reasons.push("Guild tier must be Tier 2 or higher (at least one verified human-flow project on this tenant).");
    }

    const telemetry = new AuthorTelemetryService(this.supabase);
    let growth_delta_positive = false;
    try {
      const { delta } = await telemetry.buildGrowthReportDelta(trimmedAuthor, 15);
      const agg = aggregateGrowthDelta(delta);
      growth_delta_positive = agg != null && agg > 0;
      if (!growth_delta_positive) {
        reasons.push(
          agg == null
            ? "Growth delta unavailable (need enough HAL sessions) or aggregate delta is not positive."
            : "Aggregate growth delta must be greater than zero."
        );
      }
    } catch {
      reasons.push("Could not evaluate growth delta from HAL ledger.");
    }

    if (!Number.isFinite(revision_lock_cycles_completed) || revision_lock_cycles_completed < 1) {
      reasons.push("At least one revision lock cycle must be completed on this manuscript.");
    }

    const author_linked_to_manuscript = await this.authorHasHalSampleOnManuscript(
      trimmedAuthor,
      trimmedMs,
      tenantId
    );
    if (!author_linked_to_manuscript) {
      reasons.push("Author is not linked to this manuscript in HAL ledger (raw_sample.manuscriptId).");
    }

    const allowed =
      (guild_tier_level ?? 0) >= 2 &&
      growth_delta_positive &&
      revision_lock_cycles_completed >= 1 &&
      author_linked_to_manuscript;

    return {
      allowed,
      reasons: allowed ? [] : reasons,
      guild_tier_level,
      growth_delta_positive,
      revision_lock_cycles_completed,
      author_linked_to_manuscript,
    };
  }

  private async authorHasHalSampleOnManuscript(
    authorUserId: string,
    manuscriptId: string,
    tenantId: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(P4_HAL_LEDGER)
      .select("id, raw_sample")
      .eq("author_user_id", authorUserId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) return false;
    for (const row of data ?? []) {
      const raw = asRecord((row as Record<string, unknown>)["raw_sample"]);
      if (String(raw["manuscriptId"] ?? "") === manuscriptId) return true;
    }
    return false;
  }

  /**
   * Helpers with `project_count < 15` and `status === 'AVAILABLE'`.
   */
  async fetchApprenticeQueue(): Promise<P4HelperRow[]> {
    const { data, error } = await this.supabase
      .from("p4_helpers")
      .select("id, display_name, role, genre_tags, project_count, status, created_at, updated_at")
      .eq("status", "AVAILABLE")
      .lt("project_count", 15)
      .order("project_count", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw new Error(`fetchApprenticeQueue: ${error.message}`);
    return (data ?? []).map((r) => this.mapHelperRow(r as Record<string, unknown>));
  }

  /**
   * Genre alignment: helpers whose tags overlap the manuscript `genre_primary` sort first (e.g. Fantasy vs Epic Fantasy).
   */
  rankHelpersByGenre(authorGenre: string | null | undefined, helpers: P4HelperRow[]): RankedHelper[] {
    const scored = helpers.map((h) => ({
      ...h,
      genre_alignment_score: genreAlignmentScore(authorGenre, h.genre_tags ?? []),
    }));
    scored.sort((a, b) => {
      if (b.genre_alignment_score !== a.genre_alignment_score) {
        return b.genre_alignment_score - a.genre_alignment_score;
      }
      return a.project_count - b.project_count;
    });
    return scored;
  }

  /**
   * Pairs top ranked helper, marks `p4_projects.billing_state = SUBSIDIZED_APPRENTICE`, bumps helper workload.
   * Prefer **service-role** Supabase client so helper rows can be updated across tenants.
   */
  async matchApprenticeToManuscript(
    authorId: string,
    manuscriptId: string,
    options?: { helperId?: string }
  ): Promise<{ project: P4ProjectRow; helper: P4HelperRow }> {
    const gate = await this.canClaimApprentice(authorId, manuscriptId);
    if (!gate.allowed) {
      throw new Error(`matchApprenticeToManuscript: ineligible — ${gate.reasons.join(" ")}`);
    }

    const { data: ms, error: msErr } = await this.supabase
      .from("p4_manuscripts")
      .select("*")
      .eq("id", manuscriptId.trim())
      .maybeSingle();
    if (msErr) throw new Error(`matchApprenticeToManuscript: ${msErr.message}`);
    if (!ms) throw new Error("matchApprenticeToManuscript: manuscript not found");

    const manuscript = ms as P4ManuscriptRow;
    const tenantId = manuscript.tenant_id;

    const { data: existing, error: exErr } = await this.supabase
      .from("p4_projects")
      .select("id, billing_state, matched_apprentice_helper_id")
      .eq("manuscript_id", manuscript.id)
      .maybeSingle();

    if (exErr && !/does not exist|schema cache/i.test(exErr.message)) {
      throw new Error(`matchApprenticeToManuscript: ${exErr.message}`);
    }

    if (existing && String((existing as Record<string, unknown>)["billing_state"] ?? "") === "SUBSIDIZED_APPRENTICE") {
      const hid = (existing as Record<string, unknown>)["matched_apprentice_helper_id"];
      if (hid) {
        const { data: h } = await this.supabase.from("p4_helpers").select("*").eq("id", String(hid)).maybeSingle();
        if (h) {
          const er = existing as Record<string, unknown>;
          return {
            project: this.mapProjectRow(
              { ...er, tenant_id: er["tenant_id"] ?? tenantId, manuscript_id: er["manuscript_id"] ?? manuscript.id },
              tenantId,
              manuscript.id
            ),
            helper: this.mapHelperRow(h as Record<string, unknown>),
          };
        }
      }
    }

    const queue = await this.fetchApprenticeQueue();
    const ranked = this.rankHelpersByGenre(manuscript.genre_primary ?? null, queue);

    let chosen: P4HelperRow | null = null;
    if (options?.helperId?.trim()) {
      const want = options.helperId.trim();
      chosen = ranked.find((h) => h.id === want) ?? null;
      if (!chosen) throw new Error("matchApprenticeToManuscript: requested helperId not in eligible queue.");
    } else {
      chosen = ranked[0] ?? null;
    }

    if (!chosen) throw new Error("matchApprenticeToManuscript: no available apprentices in queue.");

    const now = new Date().toISOString();

    const { data: updHelper, error: hErr } = await this.supabase
      .from("p4_helpers")
      .update({
        status: "MATCHED",
        project_count: chosen.project_count + 1,
        updated_at: now,
      })
      .eq("id", chosen.id)
      .eq("status", "AVAILABLE")
      .lt("project_count", 15)
      .select("*")
      .maybeSingle();

    if (hErr) throw new Error(`matchApprenticeToManuscript: helper update — ${hErr.message}`);
    if (!updHelper) {
      throw new Error("matchApprenticeToManuscript: helper no longer available (race or capacity).");
    }

    const helper = this.mapHelperRow(updHelper as Record<string, unknown>);

    const { data: proj, error: pErr } = await this.supabase
      .from("p4_projects")
      .upsert(
        {
          tenant_id: tenantId,
          manuscript_id: manuscript.id,
          billing_state: "SUBSIDIZED_APPRENTICE",
          matched_apprentice_helper_id: helper.id,
          updated_at: now,
        },
        { onConflict: "manuscript_id" }
      )
      .select("*")
      .single();

    if (pErr) throw new Error(`matchApprenticeToManuscript: p4_projects upsert — ${pErr.message}`);

    return {
      project: this.mapProjectRow(proj as Record<string, unknown>, tenantId, manuscript.id),
      helper,
    };
  }

  private mapHelperRow(o: Record<string, unknown>): P4HelperRow {
    const tags = o["genre_tags"];
    const genre_tags = Array.isArray(tags) ? tags.map((t) => String(t)) : [];
    return {
      id: String(o["id"] ?? ""),
      display_name: String(o["display_name"] ?? ""),
      role: String(o["role"] ?? ""),
      genre_tags,
      project_count: Number(o["project_count"] ?? 0),
      status: String(o["status"] ?? "AVAILABLE") as P4HelperStatus,
      created_at: String(o["created_at"] ?? ""),
      updated_at: String(o["updated_at"] ?? ""),
    };
  }

  private mapProjectRow(o: Record<string, unknown>, tenantId: string, manuscriptId: string): P4ProjectRow {
    return {
      id: String(o["id"] ?? ""),
      tenant_id: String(o["tenant_id"] ?? tenantId),
      manuscript_id: String(o["manuscript_id"] ?? manuscriptId),
      billing_state: String(o["billing_state"] ?? "STANDARD") as P4ProjectBillingState,
      matched_apprentice_helper_id:
        o["matched_apprentice_helper_id"] != null ? String(o["matched_apprentice_helper_id"]) : null,
      created_at: String(o["created_at"] ?? ""),
      updated_at: String(o["updated_at"] ?? ""),
    };
  }
}
