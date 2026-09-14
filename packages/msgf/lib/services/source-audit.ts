/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Pillar 7 — non-blocking source audit writer, reputation, prune/boost helpers.
 * Must not import PulseEngine or msgf-shadow (avoid cycles).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  REPUTATION_BOOST_THRESHOLD,
  REPUTATION_PRUNE_THRESHOLD,
  SourceAuditRecordSchema,
  blocksAutoGreen,
  computeReputationScore,
  hashSourceChunk,
  parseAttributionClass,
  resourceKeyForFile,
  resourceKeyForVaultHall,
  type AttributionClass,
  type SourceAuditRecord,
  type SourceHit,
} from "@/lib/schemas/source-audit";

const MAX_SOURCES = 12;
const BOOST_BIAS = 0.15;

export type ReputationMap = Map<string, number>;

function logP7Error(scope: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[p7-source-audit] ${scope}:`, message);
  try {
    // Optional Sentry — avoid hard dependency if capture unavailable at build time.
    const g = globalThis as { Sentry?: { captureException?: (e: unknown) => void } };
    g.Sentry?.captureException?.(err instanceof Error ? err : new Error(message));
  } catch {
    /* ignore */
  }
}

export function attachSourceAuditToBeatMetadata(
  meta: Record<string, unknown>,
  record: SourceAuditRecord
): Record<string, unknown> {
  const sources = (record.sources ?? []).slice(0, MAX_SOURCES);
  return {
    ...meta,
    source_audit: {
      trace_id: record.trace_id,
      decision_kind: record.decision_kind,
      routing: record.routing ?? null,
      logic_drift_score: record.logic_drift_score ?? null,
      defend_tier: record.defend_tier ?? null,
      defend_reason: record.defend_reason ?? null,
      outcome: record.outcome,
      sources,
      used_count: sources.filter((s) => !s.pruned).length,
      pruned_count: sources.filter((s) => s.pruned).length,
    },
  };
}

export async function loadReputationMap(
  admin: SupabaseClient,
  tenantId: string,
  resourceKeys: string[]
): Promise<ReputationMap> {
  const map: ReputationMap = new Map();
  const keys = [...new Set(resourceKeys.map((k) => k.trim()).filter(Boolean))];
  if (!tenantId.trim() || keys.length === 0) return map;

  try {
    const { data, error } = await admin
      .from("msgf_resource_reputation")
      .select("resource_key, reputation_score")
      .eq("tenant_id", tenantId.trim())
      .in("resource_key", keys);

    if (error) {
      logP7Error("loadReputationMap", error);
      return map;
    }
    for (const row of data ?? []) {
      const key = typeof row.resource_key === "string" ? row.resource_key : "";
      const score =
        typeof row.reputation_score === "number"
          ? row.reputation_score
          : Number(row.reputation_score);
      if (key && Number.isFinite(score)) map.set(key, score);
    }
  } catch (e) {
    logP7Error("loadReputationMap", e);
  }
  return map;
}

export type ApplyReputationResult = {
  /** Candidates safe for auto-GREEN context (boosted ordering). */
  contextHits: SourceHit[];
  /** Low-rep hits removed from context but kept for audit. */
  prunedHits: SourceHit[];
  /** True if any non-pruned hit blocks auto-GREEN (copyleft / untrusted). */
  forceEscalate: boolean;
  escalateReason: string | null;
};

/**
 * Apply reputation boost/prune and attribution gates to scored hits.
 * Fail-open: missing reputation → score 0.
 */
export function applyReputationToHits(
  hits: SourceHit[],
  reputation: ReputationMap
): ApplyReputationResult {
  const enriched: SourceHit[] = hits.map((hit) => {
    const rep = reputation.get(hit.resource_key) ?? 0;
    const scoreBoost =
      rep > REPUTATION_BOOST_THRESHOLD ? hit.score + BOOST_BIAS : hit.score;
    const pruned = rep < REPUTATION_PRUNE_THRESHOLD;
    return {
      ...hit,
      score: Math.min(1, scoreBoost),
      reputation_score: rep,
      pruned: pruned || Boolean(hit.pruned),
    };
  });

  enriched.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const prunedHits = enriched.filter((h) => h.pruned);
  const contextHits = enriched.filter((h) => !h.pruned);

  let forceEscalate = false;
  let escalateReason: string | null = null;
  for (const hit of contextHits) {
    if (blocksAutoGreen(hit)) {
      forceEscalate = true;
      escalateReason = `attribution_class:${hit.attribution_class ?? "unknown"}`;
      break;
    }
  }

  return { contextHits, prunedHits, forceEscalate, escalateReason };
}

export function hitFromLedgerRow(input: {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  ledger: "vault" | "hall";
  score: number;
}): SourceHit {
  const meta = input.metadata ?? {};
  const filePath =
    typeof meta.file_path === "string"
      ? meta.file_path
      : typeof meta.path === "string"
        ? meta.path
        : null;
  const bugIndex =
    typeof meta.bug_index === "string"
      ? meta.bug_index
      : typeof meta.instance === "string"
        ? meta.instance
        : null;
  const commitSha =
    typeof meta.commit_sha === "string"
      ? meta.commit_sha
      : typeof meta.git_sha === "string"
        ? meta.git_sha
        : null;
  const attribution = parseAttributionClass(
    meta.attribution_class ?? meta.license_class ?? meta.source_license
  );

  const chunk = (input.content || "").slice(0, 8_000);
  const contentHash = chunk.trim() ? hashSourceChunk(chunk) : null;

  return {
    kind: input.ledger,
    ledger: input.ledger,
    resource_id: input.id,
    resource_key: resourceKeyForVaultHall(input.id, input.ledger),
    score: input.score,
    content_hash: contentHash,
    content_hash_missing: !contentHash,
    bug_index: bugIndex,
    file_path: filePath,
    commit_sha: commitSha,
    label:
      typeof meta.label === "string"
        ? meta.label
        : chunk.slice(0, 80) || null,
    attribution_class: attribution,
  };
}

export function hitFromFilePath(
  filePath: string,
  content: string,
  score = 0,
  attribution: AttributionClass = "unknown"
): SourceHit {
  const chunk = (content || "").slice(0, 8_000);
  const contentHash = chunk.trim() ? hashSourceChunk(chunk) : null;
  return {
    kind: "file",
    ledger: "file",
    resource_key: resourceKeyForFile(filePath),
    score,
    content_hash: contentHash,
    content_hash_missing: !contentHash,
    file_path: filePath,
    attribution_class: attribution,
    label: filePath,
  };
}

/**
 * Fire-and-forget audit insert + impact expansion. Never throws to caller.
 */
export function recordSourceAudit(
  admin: SupabaseClient,
  raw: SourceAuditRecord
): void {
  void (async () => {
    try {
      const parsed = SourceAuditRecordSchema.safeParse(raw);
      if (!parsed.success) {
        logP7Error("recordSourceAudit validation", parsed.error);
        return;
      }
      const record = parsed.data;
      const sources = (record.sources ?? []).slice(0, MAX_SOURCES);

      const { data: inserted, error } = await admin
        .from("msgf_source_audit_events")
        .insert({
          tenant_id: record.tenant_id,
          entity_id: record.entity_id ?? null,
          trace_id: record.trace_id,
          pulse_beat_id: record.pulse_beat_id ?? null,
          decision_kind: record.decision_kind,
          routing: record.routing ?? null,
          logic_drift_score: record.logic_drift_score ?? null,
          defend_tier: record.defend_tier ?? null,
          defend_reason: record.defend_reason ?? null,
          sources,
          outcome: record.outcome,
        })
        .select("id")
        .maybeSingle();

      if (error) {
        logP7Error("recordSourceAudit insert", error);
        return;
      }

      const auditId = inserted?.id as string | undefined;
      if (!auditId) return;

      const impactRows = sources
        .map((s) => {
          const hash = s.content_hash?.trim();
          if (!hash && !s.resource_key) return null;
          return {
            tenant_id: record.tenant_id,
            audit_event_id: auditId,
            trace_id: record.trace_id,
            pulse_beat_id: record.pulse_beat_id ?? null,
            project_origin: record.project_origin ?? null,
            resource_key: s.resource_key,
            content_hash: hash || `missing:${s.resource_key}`,
            attribution_class: s.attribution_class ?? "unknown",
            file_path: s.file_path ?? null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r != null);

      if (impactRows.length === 0) return;

      const { error: impactError } = await admin
        .from("msgf_source_downstream_impact")
        .upsert(impactRows, {
          onConflict: "tenant_id,audit_event_id,resource_key,content_hash",
          ignoreDuplicates: true,
        });

      if (impactError) {
        // Fallback: allSettled per-row so one failure cannot abort the rest.
        await Promise.allSettled(
          impactRows.map((row) =>
            admin.from("msgf_source_downstream_impact").insert(row).then(({ error: e }) => {
              if (e && !/duplicate|unique/i.test(e.message)) {
                logP7Error("impact row insert", e);
              }
            })
          )
        );
      }
    } catch (e) {
      logP7Error("recordSourceAudit", e);
    }
  })();
}

export type ReputationOutcomeKind = "good" | "bad";

/**
 * Fire-and-forget reputation upsert for cited (non-pruned) sources.
 */
export function applyReputationOutcome(
  admin: SupabaseClient,
  tenantId: string,
  hits: SourceHit[],
  opts: {
    kind: ReputationOutcomeKind;
    driftScore?: number | null;
    highDrift?: boolean;
  }
): void {
  void (async () => {
    try {
      const tid = tenantId.trim();
      if (!tid) return;
      const cited = hits.filter((h) => !h.pruned && h.resource_key);
      if (cited.length === 0) return;

      const drift = opts.driftScore ?? null;
      const highDrift = Boolean(opts.highDrift);

      await Promise.allSettled(
        cited.map(async (hit) => {
          const key = hit.resource_key;
          const ledger =
            hit.ledger ??
            (hit.kind === "hall" ? "hall" : hit.kind === "file" ? "file" : "vault");

          const { data: existing } = await admin
            .from("msgf_resource_reputation")
            .select(
              "good_count, bad_count, high_drift_count, last_content_hash"
            )
            .eq("tenant_id", tid)
            .eq("resource_key", key)
            .maybeSingle();

          const good =
            Number(existing?.good_count ?? 0) + (opts.kind === "good" ? 1 : 0);
          const bad =
            Number(existing?.bad_count ?? 0) + (opts.kind === "bad" ? 1 : 0);
          const high =
            Number(existing?.high_drift_count ?? 0) + (highDrift ? 1 : 0);
          const score = computeReputationScore(good, bad, high);

          const { error } = await admin.from("msgf_resource_reputation").upsert(
            {
              tenant_id: tid,
              resource_key: key,
              ledger,
              resource_id: hit.resource_id ?? null,
              file_path: hit.file_path ?? null,
              good_count: good,
              bad_count: bad,
              high_drift_count: high,
              last_drift_score: drift,
              reputation_score: score,
              last_content_hash: hit.content_hash ?? existing?.last_content_hash ?? null,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,resource_key" }
          );
          if (error) logP7Error("reputation upsert", error);
        })
      );
    } catch (e) {
      logP7Error("applyReputationOutcome", e);
    }
  })();
}

export {
  hashSourceChunk,
  resourceKeyForFile,
  resourceKeyForVaultHall,
  computeReputationScore,
  blocksAutoGreen,
  REPUTATION_BOOST_THRESHOLD,
  REPUTATION_PRUNE_THRESHOLD,
};
