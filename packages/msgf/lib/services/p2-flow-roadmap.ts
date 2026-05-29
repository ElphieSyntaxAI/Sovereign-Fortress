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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * P2: Flow Sequence — canonical MSGF 1.0 roadmap (V3.2-ULTRA master directive).
 * Used by PulseEngine.crossRef() to prioritize Vault lineage aligned with current architecture.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { RULE_SCOPE_GLOBAL } from "@/lib/services/msgf-global-rules";
import {
  applyMsgfRulesTenantFilter,
  resolveTenantIdForQuery,
} from "@/lib/services/tenant-query-scope";

/** V3.2-ULTRA master directive steps (MSGF 1.0 SSoT). */
export const P2_FLOW_SEQUENCE_STEPS = [
  "SWEEP",
  "SHARD",
  "DEFEND",
  "CROSS-REF",
  "CONVERGE",
  "ARBITRATE",
  "PERSIST",
] as const;

export type P2FlowStep = (typeof P2_FLOW_SEQUENCE_STEPS)[number];

export type P2RoadmapConfig = {
  releaseTarget: string;
  version: string;
  steps: readonly P2FlowStep[];
  alignmentKeywords: readonly string[];
  deprecatedKeywords: readonly string[];
};

export const DEFAULT_P2_ROADMAP: P2RoadmapConfig = {
  releaseTarget: "MSGF 1.0",
  version: "2026.05-MSGF-1.0-P2",
  steps: P2_FLOW_SEQUENCE_STEPS,
  alignmentKeywords: [
    "msgf 1.0",
    "v3.2",
    "v3.2-ultra",
    "pulseengine",
    "runfullpipeline",
    "modular",
    "shard",
    "defend",
    "cross-ref",
    "crossref",
    "converge",
    "arbitrate",
    "persist",
    "constraint-ledger",
    "vault-hall",
    "msgf-hot-layer",
    "redis hot",
    "entitlement",
    "reportingengine",
    "msgf_incidents",
    "genealogical",
    "1.1.1",
    "swep",
    "arbitration_beat",
    "arbitration beat",
    "human_reasoning",
    "final_fix_applied",
    "human-corrected",
    "admin_arbitration",
    "remediation_strategy_label",
    "global_mitigation",
    "p2_roadmap_education",
    "p2_education_vault",
    "apply_to_future_sessions",
  ],
  deprecatedKeywords: [
    "monolithic route",
    "orchestration-heavy",
    "merged handler",
    "legacy express",
    "dual rag stack",
    "author-ecosystem import",
    "pre-converge",
    "flat logs",
    "old architecture",
    "rollback architecture",
    "revert to v2",
    "v2.0 stack",
    "express-only",
    "loop back",
    "pre-refactor pulse",
  ],
};

export type VaultLineageRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
};

export type VaultP2Classification = {
  row: VaultLineageRow;
  alignmentScore: number;
  alignedWithRoadmap: boolean;
  contradictsRoadmap: boolean;
  matchedAlignment: string[];
  matchedDeprecated: string[];
};

export type PrioritizedVaultLineage = {
  roadmap: P2RoadmapConfig;
  aligned: VaultP2Classification[];
  neutral: VaultP2Classification[];
  contradicts: VaultP2Classification[];
  /** Aligned-first ordering for downstream prompts (contradictions trailing, capped). */
  prioritized: VaultLineageRow[];
};

function normalizeHaystack(row: VaultLineageRow): string {
  const meta = row.metadata ? JSON.stringify(row.metadata) : "";
  return `${row.content}\n${meta}`.toLowerCase();
}

function matchKeywords(haystack: string, keywords: readonly string[]): string[] {
  const hits: string[] = [];
  for (const kw of keywords) {
    if (haystack.includes(kw.toLowerCase())) hits.push(kw);
  }
  return hits;
}

export function classifyVaultRowAgainstP2(
  row: VaultLineageRow,
  roadmap: P2RoadmapConfig = DEFAULT_P2_ROADMAP
): VaultP2Classification {
  const haystack = normalizeHaystack(row);
  const matchedAlignment = matchKeywords(haystack, roadmap.alignmentKeywords);
  const matchedDeprecated = matchKeywords(haystack, roadmap.deprecatedKeywords);

  let alignmentScore = matchedAlignment.length * 2 - matchedDeprecated.length * 3;

  const isHumanArbitrationBeat =
    haystack.includes("arbitration_beat") ||
    haystack.includes("human_reasoning") ||
    haystack.includes("final_fix_applied") ||
    haystack.includes("p2_roadmap_education") ||
    haystack.includes("global_mitigation");
  if (isHumanArbitrationBeat) {
    alignmentScore += 8;
  }

  const contradictsRoadmap = matchedDeprecated.length > 0 && alignmentScore < 1;
  const alignedWithRoadmap =
    (matchedAlignment.length > 0 || isHumanArbitrationBeat) &&
    alignmentScore > 0 &&
    !contradictsRoadmap;

  return {
    row,
    alignmentScore,
    alignedWithRoadmap,
    contradictsRoadmap,
    matchedAlignment,
    matchedDeprecated,
  };
}

/**
 * Pure P2 prioritization (no I/O). For Redis + Postgres pipeline use
 * {@link resolvePrioritizedVaultLineageForP2} from `./vault-lineage-p2-cache`.
 */
export function prioritizeVaultLineageForP2(
  rows: VaultLineageRow[],
  roadmap: P2RoadmapConfig = DEFAULT_P2_ROADMAP,
  options?: { maxAligned?: number; maxContradicts?: number; maxTotal?: number }
): PrioritizedVaultLineage {
  const maxAligned = options?.maxAligned ?? 12;
  const maxContradicts = options?.maxContradicts ?? 3;
  const maxTotal = options?.maxTotal ?? 15;

  const classified = rows.map((row) => classifyVaultRowAgainstP2(row, roadmap));

  const aligned = classified
    .filter((c) => c.alignedWithRoadmap)
    .sort((a, b) => b.alignmentScore - a.alignmentScore);
  const contradicts = classified
    .filter((c) => c.contradictsRoadmap)
    .sort((a, b) => a.alignmentScore - b.alignmentScore);
  const neutral = classified
    .filter((c) => !c.alignedWithRoadmap && !c.contradictsRoadmap)
    .sort((a, b) => b.alignmentScore - a.alignmentScore);

  const prioritizedRows = [
    ...aligned.slice(0, maxAligned).map((c) => c.row),
    ...neutral.slice(0, Math.max(0, maxTotal - maxAligned - maxContradicts)).map((c) => c.row),
    ...contradicts.slice(0, maxContradicts).map((c) => c.row),
  ].slice(0, maxTotal);

  return {
    roadmap,
    aligned,
    neutral,
    contradicts,
    prioritized: prioritizedRows,
  };
}

/** Built-in loader: tenant-scoped `msgf_rules` (`p2` / `flow_sequence_1_0`), else {@link DEFAULT_P2_ROADMAP}. */
export async function loadP2RoadmapFromRules(
  supabase: SupabaseClient | undefined,
  tenantId: string
): Promise<P2RoadmapConfig> {
  if (!supabase) return DEFAULT_P2_ROADMAP;

  const tid = resolveTenantIdForQuery(tenantId);

  type FilterEq = { eq: (column: string, value: string) => FilterEq };

  let query: FilterEq = supabase
    .from("msgf_rules")
    .select("payload")
    .eq("rule_namespace", "p2")
    .eq("rule_key", "flow_sequence_1_0")
    .eq("rule_scope", RULE_SCOPE_GLOBAL)
    .eq("rules_silo_key", "G") as unknown as FilterEq;
  query = applyMsgfRulesTenantFilter(query, tid);
  const { data, error } = await (
    query as unknown as {
      maybeSingle: () => Promise<{
        data: { payload?: unknown } | null;
        error: { message: string } | null;
      }>;
    }
  ).maybeSingle();

  if (error || !data?.payload || typeof data.payload !== "object") {
    return DEFAULT_P2_ROADMAP;
  }

  const payload = data.payload as Record<string, unknown>;
  const steps = Array.isArray(payload.steps)
    ? payload.steps.filter((s): s is P2FlowStep =>
        typeof s === "string" && (P2_FLOW_SEQUENCE_STEPS as readonly string[]).includes(s)
      )
    : DEFAULT_P2_ROADMAP.steps;

  return {
    releaseTarget:
      typeof payload.release_target === "string"
        ? payload.release_target
        : DEFAULT_P2_ROADMAP.releaseTarget,
    version:
      typeof payload.version === "string" ? payload.version : DEFAULT_P2_ROADMAP.version,
    steps: steps.length ? steps : DEFAULT_P2_ROADMAP.steps,
    alignmentKeywords: Array.isArray(payload.alignment_keywords)
      ? payload.alignment_keywords.map(String)
      : DEFAULT_P2_ROADMAP.alignmentKeywords,
    deprecatedKeywords: Array.isArray(payload.deprecated_keywords)
      ? payload.deprecated_keywords.map(String)
      : DEFAULT_P2_ROADMAP.deprecatedKeywords,
  };
}

/**
 * Load P2 roadmap — {@link Msgf.init} plug-in when registered, else {@link loadP2RoadmapFromRules}.
 */
export async function loadP2Roadmap(
  supabase?: SupabaseClient,
  tenantId?: string
): Promise<P2RoadmapConfig> {
  const { Msgf, getMsgfRuntime } = await import("@/lib/msgf");
  const tid =
    tenantId?.trim() ||
    getMsgfRuntime().defaultTenantId ||
    undefined;

  if (Msgf.isInitialized()) {
    return Msgf.getRuntime().loadP2Roadmap(supabase, tid);
  }
  if (!tid || !supabase) {
    return DEFAULT_P2_ROADMAP;
  }
  return loadP2RoadmapFromRules(supabase, tid);
}

export function buildP2RoadmapDirective(roadmap: P2RoadmapConfig): string {
  const steps = roadmap.steps.join(" → ");
  return [
    "",
    "P2 FLOW SEQUENCE (Roadmap — supreme over stale Vault patterns):",
    `- Release target: ${roadmap.releaseTarget} (${roadmap.version})`,
    `- Canonical pipeline: ${steps}`,
    "- If any Vault historical fix contradicts this Roadmap, FAVOR THE ROADMAP.",
    "- Do not loop back to pre-1.0 monolithic or deprecated architectures.",
    "- Move toward modular PulseEngine gates (SHARD/DEFEND/CONVERGE/PERSIST), not expanded legacy orchestration.",
  ].join("\n");
}

function normalizeActiveFilePath(activeFilePath: string | undefined): string | null {
  const p = activeFilePath?.trim().replace(/\\/g, "/");
  if (!p) return null;
  return p.toLowerCase().slice(0, 512);
}

function vaultRowMatchesActiveFile(row: VaultLineageRow, activeNorm: string | null): boolean {
  if (!activeNorm) return false;
  const hay = normalizeHaystack(row);
  const base = activeNorm.split("/").pop() ?? activeNorm;
  return hay.includes(activeNorm) || (base.length > 2 && hay.includes(base));
}

function reorderClassificationsForActiveFile<T extends VaultP2Classification>(
  rows: T[],
  activeNorm: string | null
): T[] {
  if (!activeNorm || rows.length < 2) return rows;
  const matched: T[] = [];
  const rest: T[] = [];
  for (const c of rows) {
    if (vaultRowMatchesActiveFile(c.row, activeNorm)) matched.push(c);
    else rest.push(c);
  }
  return [...matched, ...rest];
}

export type BuildVaultCrossRefOptions = {
  /** IDE workspace-relative path — matching vault rows are listed first. */
  activeFilePath?: string | null;
};

export function buildVaultCrossRefContext(
  prioritized: PrioritizedVaultLineage,
  options?: BuildVaultCrossRefOptions
): string {
  const activeNorm = normalizeActiveFilePath(options?.activeFilePath ?? undefined);
  const lines: string[] = ["", "VAULT CROSS-REF (1.1.1 lineage, P2-prioritized):"];
  if (activeNorm) {
    lines.push(`- P5 shard boost: active file \`${activeNorm}\``);
  }

  if (!prioritized.prioritized.length) {
    lines.push("- (no matching Vault rows for this pulse seed)");
    return lines.join("\n");
  }

  const isHumanCorrectedRow = (c: VaultP2Classification) => {
    const hay = normalizeHaystack(c.row);
    return (
      hay.includes("arbitration_beat") ||
      hay.includes("p2_roadmap_education") ||
      hay.includes("p2_education_vault")
    );
  };

  const humanBeats = reorderClassificationsForActiveFile(
    prioritized.aligned.filter(isHumanCorrectedRow),
    activeNorm
  );
  const otherAligned = reorderClassificationsForActiveFile(
    prioritized.aligned.filter((c) => !isHumanCorrectedRow(c)),
    activeNorm
  );

  for (const c of humanBeats.slice(0, 4)) {
    lines.push(
      `- [HUMAN-CORRECTED — prioritize] ${c.row.content.slice(0, 260).replace(/\s+/g, " ")}`
    );
  }

  for (const c of otherAligned.slice(0, 8)) {
    lines.push(
      `- [ROADMAP-ALIGNED score=${c.alignmentScore}] ${c.row.content.slice(0, 220).replace(/\s+/g, " ")}`
    );
  }

  for (const c of prioritized.contradicts.slice(0, 3)) {
    lines.push(
      `- [DEPRECATED — do not follow; favor P2 Roadmap] ${c.row.content.slice(0, 180).replace(/\s+/g, " ")}`
    );
    if (c.matchedDeprecated.length) {
      lines.push(`  flags: ${c.matchedDeprecated.join(", ")}`);
    }
  }

  return lines.join("\n");
}
