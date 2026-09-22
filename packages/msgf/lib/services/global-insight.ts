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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * **Global Insight** — anonymized cross-tenant feed of successful Sentinel local self-heals,
 * with optional absorption of **logic patterns** (not raw code) into `global_vault` / vault_core.
 */

import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildGenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import { persistToVault } from "@/lib/services/constraint-ledger";
import { MSGF_VAULT_CORE_TENANT_ID } from "@/lib/services/global-approval-gate";
import { anonymizeInsightText } from "@/lib/services/logic-pattern-sanitize";
import { invalidateTenantLineageCache } from "@/lib/services/vault-lineage-p2-cache";

/** System actor for vault_core writes from GLOBAL_ADMIN absorb (configurable). */
export const MSGF_GLOBAL_INSIGHT_SYSTEM_ENTITY_ID =
  process.env.MSGF_GLOBAL_INSIGHT_SYSTEM_ENTITY_ID?.trim() || "00000000-0000-4000-8000-000000000001";

export const GLOBAL_INSIGHT_VAULT_BUG_INDEX = buildGenealogicalBugIndex({
  level_1_category: "1.0_PULSE",
  level_1_1_branch: "1.1_CROSSREF",
  level_1_1_1_instance: "1.1.1_GLOBAL_INSIGHT_ABSORB",
});

export type NarrativeLogHealRow = {
  id: string;
  created_at: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  tenant_id: string;
  actor_id: string | null;
};

export type GlobalInsightFeedItem = {
  narrative_log_id: string;
  created_at: string;
  /** Opaque silo fingerprint (no raw tenant id). */
  silo_ref: string;
  logic_pattern: string;
  pillar_hint: string | null;
  drift_score: number | null;
  strategy_id: string | null;
  already_absorbed: boolean;
};

/** Cross-tenant Big Brain absorb: hashes and scores only. Pattern text is hashed, not stored. */
export function toCrossTenantBrainMetadata(input: {
  sourceLogId: string;
  tenantId: string;
  strategyId: string | null;
  driftScore: number | null;
  patternText: string;
}): string {
  const content_hash = createHash("sha256")
    .update(input.patternText || "", "utf8")
    .digest("hex");
  return JSON.stringify({
    content_hash,
    strategy_id: input.strategyId,
    drift_score: input.driftScore,
    silo_ref: siloRefFromTenantId(input.tenantId),
    source_log_hash: createHash("sha256").update(input.sourceLogId, "utf8").digest("hex"),
  });
}

export function siloRefFromTenantId(tenantId: string): string {
  const t = tenantId.trim();
  if (!t) return "unknown";
  return createHash("sha256").update(t, "utf8").digest("hex").slice(0, 14);
}

function isSuccessfulLocalHealMetadata(meta: Record<string, unknown> | null): boolean {
  if (!meta) return false;
  return meta.self_heal_report === true && meta.local_delta_applied === true;
}

function parseDriftScore(meta: Record<string, unknown>): number | null {
  const ld = meta.logic_drift;
  if (!ld || typeof ld !== "object") return null;
  const score = (ld as Record<string, unknown>).score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function extractLogicPatternFromHealMetadata(meta: Record<string, unknown>): string {
  const strategies = meta.remediation_strategies;
  if (Array.isArray(strategies) && strategies.length > 0) {
    const first = strategies[0] as Record<string, unknown>;
    const ft = first.fixTemplate ?? first.fix_template;
    if (typeof ft === "string" && ft.trim()) return ft.trim();
    const label = first.label;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  const sid = meta.local_delta_strategy_id;
  if (typeof sid === "string" && sid.trim()) {
    return `Local heal strategy: ${sid.trim()}`;
  }
  return "";
}

export async function listAbsorbedSourceLogIds(
  admin: SupabaseClient,
  ids: string[]
): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await admin
    .from("msgf_global_insight_absorptions")
    .select("source_narrative_log_id")
    .in("source_narrative_log_id", ids);

  if (error) {
    throw new Error(`msgf_global_insight_absorptions: ${error.message}`);
  }
  return new Set((data ?? []).map((r) => r.source_narrative_log_id as string));
}

export async function fetchGlobalInsightHealCandidates(
  admin: SupabaseClient,
  options?: { scanLimit?: number; take?: number }
): Promise<NarrativeLogHealRow[]> {
  const scan = Math.min(Math.max(options?.scanLimit ?? 400, 1), 800);
  const take = Math.min(Math.max(options?.take ?? 60, 1), 100);

  const { data, error } = await admin
    .from("p4_narrative_logs")
    .select("id, created_at, message, metadata, tenant_id, actor_id")
    .eq("action_type", "DIAGNOSTIC_SNAPSHOT")
    .order("created_at", { ascending: false })
    .limit(scan);

  if (error) {
    throw new Error(`global insight p4_narrative_logs: ${error.message}`);
  }

  const rows = (data ?? []) as NarrativeLogHealRow[];
  const heals: NarrativeLogHealRow[] = [];
  for (const row of rows) {
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : null;
    if (!isSuccessfulLocalHealMetadata(meta as Record<string, unknown> | null)) continue;
    heals.push(row);
    if (heals.length >= take) break;
  }
  return heals;
}

export async function buildGlobalInsightFeed(
  admin: SupabaseClient,
  options?: { scanLimit?: number; take?: number }
): Promise<GlobalInsightFeedItem[]> {
  const heals = await fetchGlobalInsightHealCandidates(admin, options);
  const ids = heals.map((h) => h.id);
  const absorbed = await listAbsorbedSourceLogIds(admin, ids);

  return heals.map((row) => {
    const meta = row.metadata as Record<string, unknown>;
    const rawPattern = extractLogicPatternFromHealMetadata(meta);
    const fallback =
      typeof row.message === "string" && row.message.trim() ? row.message.trim() : "";
    const logic_pattern = anonymizeInsightText(rawPattern || fallback || "(no pattern)");

    let pillarHint: string | null = null;
    const strategies = meta.remediation_strategies;
    if (Array.isArray(strategies) && strategies.length > 0) {
      const p = (strategies[0] as Record<string, unknown>).pillar;
      if (typeof p === "string") pillarHint = p;
    }

    const sid = meta.local_delta_strategy_id;
    const strategy_id = typeof sid === "string" ? sid : null;

    return {
      narrative_log_id: row.id,
      created_at: row.created_at,
      silo_ref: siloRefFromTenantId(String(row.tenant_id ?? "")),
      logic_pattern: logic_pattern.slice(0, 4000),
      pillar_hint: pillarHint,
      drift_score: parseDriftScore(meta),
      strategy_id,
      already_absorbed: absorbed.has(row.id),
    };
  });
}

export type AbsorbGlobalInsightResult = {
  ok: true;
  vault_narrative_log_id: string | null;
  already_absorbed: boolean;
};

export async function absorbGlobalInsightIntoBrain(params: {
  admin: SupabaseClient;
  sourceNarrativeLogId: string;
  absorbedByActorId: string | null;
}): Promise<AbsorbGlobalInsightResult> {
  const sid = params.sourceNarrativeLogId.trim();
  if (!sid) {
    throw new Error("sourceNarrativeLogId is required.");
  }

  const { data: prior } = await params.admin
    .from("msgf_global_insight_absorptions")
    .select("id, vault_narrative_log_id")
    .eq("source_narrative_log_id", sid)
    .maybeSingle();

  if (prior?.id) {
    return {
      ok: true,
      vault_narrative_log_id: (prior.vault_narrative_log_id as string | null) ?? null,
      already_absorbed: true,
    };
  }

  const { data: logRow, error: loadErr } = await params.admin
    .from("p4_narrative_logs")
    .select("id, message, metadata, tenant_id")
    .eq("id", sid)
    .maybeSingle();

  if (loadErr) {
    throw new Error(`p4_narrative_logs read: ${loadErr.message}`);
  }
  if (!logRow) {
    throw new Error("Narrative log not found.");
  }

  const meta =
    logRow.metadata && typeof logRow.metadata === "object"
      ? (logRow.metadata as Record<string, unknown>)
      : null;
  if (!isSuccessfulLocalHealMetadata(meta)) {
    throw new Error("Row is not a successful local self-heal (cannot absorb).");
  }

  const rawPattern = extractLogicPatternFromHealMetadata(meta!);
  const msg = typeof logRow.message === "string" ? logRow.message.trim() : "";
  const strategyId =
    typeof meta?.local_delta_strategy_id === "string" ? meta.local_delta_strategy_id : null;
  const metadataOnly = toCrossTenantBrainMetadata({
    sourceLogId: sid,
    tenantId: String(logRow.tenant_id ?? ""),
    strategyId,
    driftScore: parseDriftScore(meta!),
    patternText: rawPattern || msg,
  });

  const vaultTenant = MSGF_VAULT_CORE_TENANT_ID.trim();
  if (!vaultTenant) {
    throw new Error("MSGF_VAULT_CORE_TENANT_ID is not configured.");
  }

  const summaryBeat = [
    "Global Insight absorb (logic pattern)",
    meta?.local_delta_strategy_id ? `strategy=${String(meta.local_delta_strategy_id)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 2000);

  const persist = await persistToVault({
    supabase: params.admin,
    entityId: MSGF_GLOBAL_INSIGHT_SYSTEM_ENTITY_ID,
    tenantId: vaultTenant,
    content: metadataOnly,
    bugIndex: GLOBAL_INSIGHT_VAULT_BUG_INDEX,
    summaryBeat,
    legalVersion: CURRENT_LEGAL_VERSION,
    halScore: 95,
    actionType: "GLOBAL_INSIGHT_ABSORB",
    narrativeExtra: {
      beat_kind: "global_insight_absorb",
      source_narrative_log_id: sid,
      anonymized: true,
      absorbed_by_actor_id: params.absorbedByActorId,
      silo_ref: siloRefFromTenantId(String(logRow.tenant_id ?? "")),
    },
  });

  await params.admin.from("msgf_global_insight_absorptions").insert({
    source_narrative_log_id: sid,
    vault_narrative_log_id: persist.narrativeLogId ?? null,
    absorbed_by_actor_id: params.absorbedByActorId,
  });

  await invalidateTenantLineageCache(vaultTenant, {});

  return {
    ok: true,
    vault_narrative_log_id: persist.narrativeLogId ?? null,
    already_absorbed: false,
  };
}
