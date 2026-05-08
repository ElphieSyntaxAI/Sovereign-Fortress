/**
 * DB-backed manuscript revision locks (tiered cool-down) and semantic revision audits.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createOpenAIEmbedder, type EmbedBatchFn } from "./narrative/IngestionService.js";

export type RevisionStatus =
  | "DRAFTING"
  | "LOCKED"
  | "AUDITING"
  | "READY_FOR_EDITOR"
  | "AUDITING_COMPLETE";
export type LockTier = "4w" | "6w" | "8w";

export type PublishingIntent = "TRADITIONAL" | "SELF" | "UNDECIDED";

export type P4ManuscriptRow = {
  id: string;
  tenant_id: string;
  title: string | null;
  body_text: string | null;
  /** Planning: high-level outline / beat text (see migration `p4_manuscripts.outline`). */
  outline?: string | null;
  /** Trade vs self-publishing intent — drives marketplace hub visibility (see `MarketplaceOrchestrator`). */
  publishing_intent?: PublishingIntent | null;
  is_seeking_agent?: boolean | null;
  /** Author confirmed helper three-stage milestones; guild `project_count` bumps once (DB trigger). */
  verified_human_flow_at?: string | null;
  /** Explicit “project complete” timestamp for badges / Fan Hub (optional; see `BadgeCertificationService`). */
  project_completed_at?: string | null;
  /** Count of completed revision-lock cycles (LOCKED → released); see `RevisionLockService.releaseRevisionLock`. */
  revision_lock_cycles_completed?: number;
  /** Primary genre for apprentice / marketplace alignment (e.g. Epic Fantasy). */
  genre_primary?: string | null;
  revision_status: RevisionStatus;
  lock_tier: LockTier | null;
  lock_expires_at: string | null;
  revision_count: number;
  audit_score: number;
  last_audit_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NarrativeMatchRow = {
  id: string;
  content: string;
  source_document: string;
  chunk_type: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
  cosine_similarity: number;
};

export type RevisionFindingType = "CANON_MANUSCRIPT_GAP" | "HIGH_DYNAMIC_TENSION" | "AUDIT_SUMMARY";

const LOCK_TIER_MS: Record<LockTier, number> = {
  "4w": 4 * 7 * 24 * 60 * 60 * 1000,
  "6w": 6 * 7 * 24 * 60 * 60 * 1000,
  "8w": 8 * 7 * 24 * 60 * 60 * 1000,
};

const GAP_SIM_THRESHOLD = 0.42;
const LORE_ALIGNMENT_FLOOR = 0.52;
const DYNAMIC_HIGH_SIM = 0.78;
const JACCARD_TENSION_MAX = 0.14;
const MS_EMBED_CAP = 12_000;

function jaccardContentSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ""))
        .filter((t) => t.length > 2)
    );
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) {
    if (B.has(t)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

function mapRpcRow(r: Record<string, unknown>): NarrativeMatchRow {
  return {
    id: String(r.id),
    content: String(r.content ?? ""),
    source_document: String(r.source_document ?? ""),
    chunk_type: String(r.chunk_type ?? ""),
    chunk_index: Number(r.chunk_index ?? 0),
    metadata: (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as Record<string, unknown>,
    cosine_similarity: Number(r.cosine_similarity ?? 0),
  };
}

async function rpcMatch(
  supabase: SupabaseClient,
  tenantId: string,
  embedding: number[],
  matchCount: number,
  chunkTypes: string[] | null
): Promise<NarrativeMatchRow[]> {
  const { data, error } = await supabase.rpc("match_p4_narrative_library_chunks", {
    p_tenant_id: tenantId,
    p_query_embedding: embedding,
    p_match_count: matchCount,
    p_chunk_types: chunkTypes && chunkTypes.length > 0 ? chunkTypes : null,
  });
  if (error) throw new Error(`match_p4_narrative_library_chunks: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => mapRpcRow(row));
}

export type RevisionAuditResult = {
  manuscriptId: string;
  tenantId: string;
  auditScore: number;
  gapFindings: number;
  tensionFindings: number;
  loreChunksExamined: number;
};

/**
 * Auditor hook: load manuscript, embed full text, compare tenant **lore** (canon) chunks and
 * **plot/character** chunks via pgvector RPC, persist structured rows to `p4_revision_reports`,
 * and refresh `p4_manuscripts.audit_score`.
 */
export async function triggerRevisionAudit(
  supabase: SupabaseClient,
  manuscriptId: string,
  options?: { embedBatch?: EmbedBatchFn }
): Promise<RevisionAuditResult> {
  const embedBatch = options?.embedBatch ?? createOpenAIEmbedder();

  const { data: ms, error: msErr } = await supabase
    .from("p4_manuscripts")
    .select("*")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (msErr) throw new Error(`p4_manuscripts read: ${msErr.message}`);
  if (!ms) throw new Error(`Manuscript not found: ${manuscriptId}`);

  const row = ms as P4ManuscriptRow;
  const tenantId = row.tenant_id;
  const body = (row.body_text ?? "").trim();
  if (!body) {
    throw new Error("Manuscript body_text is empty; populate body_text before running revision audit.");
  }

  const { error: statusErr } = await supabase
    .from("p4_manuscripts")
    .update({ revision_status: "AUDITING", updated_at: new Date().toISOString() })
    .eq("id", manuscriptId);
  if (statusErr) throw new Error(`Failed to enter AUDITING: ${statusErr.message}`);

  try {
    const [mVec] = await embedBatch([body.slice(0, MS_EMBED_CAP)]);
    if (!mVec?.length) throw new Error("Embedding pipeline returned empty vector for manuscript.");

    const loreHits = await rpcMatch(supabase, tenantId, mVec, 28, ["lore"]);
    const dynamicHits = await rpcMatch(supabase, tenantId, mVec, 20, ["plot", "character"]);

    await supabase.from("p4_revision_reports").delete().eq("manuscript_id", manuscriptId);

    const inserts: Array<{
      tenant_id: string;
      manuscript_id: string;
      finding_type: RevisionFindingType;
      severity: "info" | "warn" | "critical";
      details: Record<string, unknown>;
      chunk_ids: string[];
      cosine_similarity: number | null;
    }> = [];

    for (const hit of loreHits) {
      if (hit.cosine_similarity < GAP_SIM_THRESHOLD) {
        inserts.push({
          tenant_id: tenantId,
          manuscript_id: manuscriptId,
          finding_type: "CANON_MANUSCRIPT_GAP",
          severity: hit.cosine_similarity < 0.25 ? "critical" : "warn",
          details: {
            summary: "Canon (lore) chunk is weakly aligned with the manuscript embedding.",
            chunk_type: hit.chunk_type,
            source_document: hit.source_document,
            chunk_index: hit.chunk_index,
            excerpt: hit.content.slice(0, 800),
          },
          chunk_ids: [hit.id],
          cosine_similarity: hit.cosine_similarity,
        });
      }
    }

    const topDynamic = dynamicHits.find((h) => h.chunk_type === "plot" || h.chunk_type === "character");
    if (topDynamic && topDynamic.cosine_similarity >= DYNAMIC_HIGH_SIM) {
      for (const lore of loreHits) {
        if (lore.cosine_similarity < LORE_ALIGNMENT_FLOOR) continue;
        const jac = jaccardContentSimilarity(lore.content, topDynamic.content);
        if (jac <= JACCARD_TENSION_MAX) {
          inserts.push({
            tenant_id: tenantId,
            manuscript_id: manuscriptId,
            finding_type: "HIGH_DYNAMIC_TENSION",
            severity: "warn",
            details: {
              summary:
                "High-similarity plot/character material sits close to the manuscript while a canon chunk " +
                "with different lexical overlap also aligns — verify for continuity before editing.",
              lore_excerpt: lore.content.slice(0, 600),
              dynamic_excerpt: topDynamic.content.slice(0, 600),
              jaccard: Math.round(jac * 1000) / 1000,
            },
            chunk_ids: [lore.id, topDynamic.id],
            cosine_similarity: Math.min(lore.cosine_similarity, topDynamic.cosine_similarity),
          });
          break;
        }
      }
    }

    const topLore = loreHits.slice(0, 5).filter((h) => h.cosine_similarity > 0);
    const auditScore =
      topLore.length > 0
        ? Math.min(
            1,
            Math.round(
              (topLore.reduce((s, h) => s + h.cosine_similarity, 0) / topLore.length) * 10_000
            ) / 10_000
          )
        : 0;

    const gapFindings = inserts.filter((i) => i.finding_type === "CANON_MANUSCRIPT_GAP").length;
    const tensionFindings = inserts.filter((i) => i.finding_type === "HIGH_DYNAMIC_TENSION").length;

    inserts.push({
      tenant_id: tenantId,
      manuscript_id: manuscriptId,
      finding_type: "AUDIT_SUMMARY",
      severity: "info",
      details: {
        auditScore,
        loreChunksExamined: loreHits.length,
        dynamicChunksExamined: dynamicHits.length,
        gapFindings,
        tensionFindings,
      },
      chunk_ids: [],
      cosine_similarity: auditScore,
    });

    const { error: insErr } = await supabase.from("p4_revision_reports").insert(inserts);
    if (insErr) throw new Error(`p4_revision_reports insert: ${insErr.message}`);

    const { error: upErr } = await supabase
      .from("p4_manuscripts")
      .update({
        revision_status: "READY_FOR_EDITOR",
        audit_score: auditScore,
        last_audit_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", manuscriptId);
    if (upErr) throw new Error(`p4_manuscripts audit finalize: ${upErr.message}`);

    return {
      manuscriptId,
      tenantId,
      auditScore,
      gapFindings,
      tensionFindings,
      loreChunksExamined: loreHits.length,
    };
  } catch (e) {
    await supabase
      .from("p4_manuscripts")
      .update({ revision_status: "DRAFTING", updated_at: new Date().toISOString() })
      .eq("id", manuscriptId);
    throw e;
  }
}

export class RevisionLockService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getManuscript(manuscriptId: string): Promise<P4ManuscriptRow | null> {
    const { data, error } = await this.supabase
      .from("p4_manuscripts")
      .select("*")
      .eq("id", manuscriptId)
      .maybeSingle();
    if (error) throw new Error(`getManuscript: ${error.message}`);
    return (data as P4ManuscriptRow) ?? null;
  }

  /**
   * Apply a tiered revision lock (wall-clock) and move manuscript into `LOCKED`.
   */
  async applyRevisionLock(manuscriptId: string, tier: LockTier): Promise<P4ManuscriptRow> {
    const ms = LOCK_TIER_MS[tier];
    const lockExpiresAt = new Date(Date.now() + ms).toISOString();
    const { data, error } = await this.supabase
      .from("p4_manuscripts")
      .update({
        revision_status: "LOCKED",
        lock_tier: tier,
        lock_expires_at: lockExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", manuscriptId)
      .select("*")
      .single();
    if (error) throw new Error(`applyRevisionLock: ${error.message}`);
    return data as P4ManuscriptRow;
  }

  /** Clear lock metadata when the author is allowed to draft again (does not delete audit reports). */
  async releaseRevisionLock(manuscriptId: string, nextStatus: Extract<RevisionStatus, "DRAFTING" | "READY_FOR_EDITOR"> = "DRAFTING"): Promise<void> {
    const row = await this.getManuscript(manuscriptId);
    if (!row) throw new Error(`releaseRevisionLock: manuscript not found (${manuscriptId})`);

    const completedCycle = row.revision_status === "LOCKED";
    const prevCycles = Number(row.revision_lock_cycles_completed ?? 0);
    const revision_lock_cycles_completed = completedCycle ? prevCycles + 1 : prevCycles;

    const { error } = await this.supabase
      .from("p4_manuscripts")
      .update({
        revision_status: nextStatus,
        lock_tier: null,
        lock_expires_at: null,
        revision_lock_cycles_completed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", manuscriptId);
    if (error) throw new Error(`releaseRevisionLock: ${error.message}`);
  }

  assertNotLocked(row: P4ManuscriptRow): void {
    if (row.revision_status !== "LOCKED") return;
    if (!row.lock_expires_at) return;
    const exp = new Date(row.lock_expires_at).getTime();
    if (Date.now() < exp) {
      throw new Error(
        `Manuscript is LOCKED until ${row.lock_expires_at} (tier ${row.lock_tier ?? "unknown"}).`
      );
    }
  }

  /** Run `triggerRevisionAudit` for the given manuscript (sets AUDITING → READY_FOR_EDITOR on success). */
  runRevisionAudit(manuscriptId: string, options?: { embedBatch?: EmbedBatchFn }): Promise<RevisionAuditResult> {
    return triggerRevisionAudit(this.supabase, manuscriptId, options);
  }
}
