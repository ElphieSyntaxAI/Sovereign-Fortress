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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
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
  decayReputationCounts,
  hashSourceChunk,
  parseAttributionClass,
  resourceKeyForFile,
  resourceKeyForMandateHash,
  resourceKeyForPack,
  resourceKeyForPromptHash,
  resourceKeyForVaultHall,
  type AttributionClass,
  type SourceAuditRecord,
  type SourceHit,
} from "@/lib/schemas/source-audit";
import { emitPlatformAudit } from "@/lib/services/emit-platform-audit";
import { emitResourceUsage } from "@/lib/services/emit-resource-usage";

const MAX_SOURCES = 12;
const BOOST_BIAS = 0.15;
export const P7_KEY_LIST_CAP = 24;

export type ReputationMap = Map<string, number>;
export type ReputationOutcomeKind = "good" | "bad";

export function ledgerForHit(hit: Pick<SourceHit, "kind" | "ledger">): string {
  if (hit.ledger) return hit.ledger;
  if (
    hit.kind === "hall" ||
    hit.kind === "file" ||
    hit.kind === "tool" ||
    hit.kind === "search" ||
    hit.kind === "mcp" ||
    hit.kind === "agent" ||
    hit.kind === "citation" ||
    hit.kind === "pack" ||
    hit.kind === "prompt"
  ) {
    return hit.kind;
  }
  return "vault";
}

export function usageKindForHit(
  hit: Pick<SourceHit, "kind">
): "vault" | "hall" | "file" | "tool" | "search" | "mcp" | "agent" | "citation" | "pack" {
  if (hit.kind === "hall") return "hall";
  if (hit.kind === "file") return "file";
  if (hit.kind === "pack") return "pack";
  if (hit.kind === "tool") return "tool";
  if (hit.kind === "search") return "search";
  if (hit.kind === "mcp") return "mcp";
  if (hit.kind === "agent") return "agent";
  if (hit.kind === "citation") return "citation";
  return "vault";
}

export function hitsForReputationOutcome(
  hits: SourceHit[],
  kind: ReputationOutcomeKind
): SourceHit[] {
  return kind === "bad"
    ? hits.filter((h) => Boolean(h.resource_key))
    : hits.filter((h) => !h.pruned && Boolean(h.resource_key));
}

export function uniqueResourceKeys(hits: SourceHit[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const k = h.resource_key?.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function p7AuditKeyLists(
  promoted: SourceHit[],
  blocked: SourceHit[]
): {
  promoted_keys: string[];
  blocked_keys: string[];
  promoted_count: number;
  blocked_count: number;
} {
  const promotedAll = uniqueResourceKeys(promoted);
  const blockedAll = uniqueResourceKeys(blocked);
  return {
    promoted_keys: promotedAll.slice(0, P7_KEY_LIST_CAP),
    blocked_keys: blockedAll.slice(0, P7_KEY_LIST_CAP),
    promoted_count: promotedAll.length,
    blocked_count: blockedAll.length,
  };
}

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
      .select("resource_key, reputation_score, good_count, bad_count, high_drift_count, last_seen_at")
      .eq("tenant_id", tenantId.trim())
      .in("resource_key", keys);

    if (error) {
      logP7Error("loadReputationMap", error);
      return map;
    }
    for (const row of data ?? []) {
      const key = typeof row.resource_key === "string" ? row.resource_key : "";
      if (!key) continue;
      const decayed = decayReputationCounts({
        good: Number(row.good_count ?? 0),
        bad: Number(row.bad_count ?? 0),
        highDrift: Number(row.high_drift_count ?? 0),
        lastSeenAt: typeof row.last_seen_at === "string" ? row.last_seen_at : null,
      });
      const raw = computeReputationScore(decayed.good, decayed.bad, decayed.highDrift);
      const score = raw * decayed.factor;
      if (Number.isFinite(score)) map.set(key, Math.max(-1, Math.min(1, score)));
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

      if (impactRows.length > 0) {
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
      }

      for (const s of sources) {
        if (!s.resource_key) continue;
        emitResourceUsage(admin, {
          tenant_id: record.tenant_id,
          product: "msgf",
          kind: usageKindForHit(s),
          resource_key: s.resource_key,
          content_hash: s.content_hash ?? null,
          project_origin: record.project_origin ?? null,
          trace_id: record.trace_id,
        });
      }

      const promoted = sources.filter((s) => !s.pruned);
      const blocked = sources.filter((s) => s.pruned || record.outcome === "block");
      emitPlatformAudit(admin, {
        product: "msgf",
        tenant_id: record.tenant_id,
        entity_id: record.entity_id ?? null,
        kind: "p7_source_audit",
        severity: record.outcome === "block" ? "warn" : "info",
        trace_id: record.trace_id,
        ref_table: "msgf_source_audit_events",
        ref_id: auditId,
        summary: `P7 ${record.decision_kind}/${record.outcome} (${sources.length} sources)`,
        metadata: {
          decision_kind: record.decision_kind,
          outcome: record.outcome,
          project_origin: record.project_origin ?? null,
          ...p7AuditKeyLists(promoted, blocked),
        },
      });
    } catch (e) {
      logP7Error("recordSourceAudit", e);
    }
  })();
}

/**
 * Fire-and-forget reputation upsert.
 * `good` skips pruned hits; `bad` includes pruned / blocked hits.
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
      const cited = hitsForReputationOutcome(hits, opts.kind);
      if (cited.length === 0) return;

      const drift = opts.driftScore ?? null;
      const highDrift = Boolean(opts.highDrift);

      await Promise.allSettled(
        cited.map(async (hit) => {
          const key = hit.resource_key;
          const ledger = ledgerForHit(hit);

          const { data: existing } = await admin
            .from("msgf_resource_reputation")
            .select(
              "good_count, bad_count, high_drift_count, last_content_hash, last_seen_at"
            )
            .eq("tenant_id", tid)
            .eq("resource_key", key)
            .maybeSingle();

          const decayed = decayReputationCounts({
            good: Number(existing?.good_count ?? 0),
            bad: Number(existing?.bad_count ?? 0),
            highDrift: Number(existing?.high_drift_count ?? 0),
            lastSeenAt: typeof existing?.last_seen_at === "string" ? existing.last_seen_at : null,
          });
          const good = Math.max(0, Math.round(decayed.good)) + (opts.kind === "good" ? 1 : 0);
          const bad = Math.max(0, Math.round(decayed.bad)) + (opts.kind === "bad" ? 1 : 0);
          const high = Math.max(0, Math.round(decayed.highDrift)) + (highDrift ? 1 : 0);
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
  resourceKeyForPack,
  resourceKeyForPromptHash,
  resourceKeyForMandateHash,
  computeReputationScore,
  decayReputationCounts,
  blocksAutoGreen,
  REPUTATION_BOOST_THRESHOLD,
  REPUTATION_PRUNE_THRESHOLD,
};
