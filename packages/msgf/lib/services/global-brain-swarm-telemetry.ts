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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Build zero-text Global Brain swarm telemetry from a cheap swarm trip.
 */

import { createHash } from "node:crypto";

import {
  GLOBAL_BRAIN_STRIPPED_KEYS,
  GLOBAL_BRAIN_SWARM_SCHEMA_VERSION,
  GlobalBrainSwarmTelemetrySchema,
  type GlobalBrainSwarmTelemetry,
} from "@/lib/schemas/global-brain-swarm-telemetry";
import { siloRefFromTenantId } from "@/lib/services/global-insight";
import type { LogicDriftAssessment } from "@/lib/services/logic-drift";
import {
  suggestFixesForCauses,
  type SwarmCauseCode,
} from "@/lib/services/swarm-fix-catalog";
import type { SwarmEvaluateTrip, SwarmGraphSnapshot } from "@/lib/services/swarm-guard";

export const DEFAULT_SWARM_DP_K = 5;

export function hashOpaqueId(value: string): string {
  return createHash("sha256").update(value.trim(), "utf8").digest("hex");
}

export function hashOpaqueIdPrefix(value: string, len = 16): string {
  return hashOpaqueId(value).slice(0, len);
}

export function composeSwarmCauseCode(causes: SwarmCauseCode[]): string {
  const unique = [...new Set(causes)];
  return unique.map((c) => c.toUpperCase()).join("+") || "GRAPH_ANOMALY";
}

export function swarmSpawnDepth(
  parentOf: Record<string, string>,
  agentId: string,
  maxHops = 8
): number {
  let hops = 0;
  let cur = parentOf[agentId];
  const seen = new Set<string>();
  while (cur && !seen.has(cur) && hops <= maxHops) {
    seen.add(cur);
    hops += 1;
    cur = parentOf[cur];
  }
  return hops;
}

function countEdges(graph: SwarmGraphSnapshot): {
  spawn: number;
  tool: number;
  peer: number;
} {
  const counts = { spawn: 0, tool: 0, peer: 0 };
  for (const edge of graph.edges) {
    if (edge.kind === "spawn") counts.spawn += 1;
    else if (edge.kind === "tool") counts.tool += 1;
    else if (edge.kind === "peer") counts.peer += 1;
  }
  return counts;
}

function mandateSha256(raw: string | null | undefined): string | null {
  const t = raw?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{64}$/.test(t) ? t : null;
}

export type BuildGlobalBrainSwarmTelemetryInput = {
  trip: SwarmEvaluateTrip;
  kind?: "bot_swarm_detected" | "bot_swarm_observed";
  tokensIn?: number;
  tokensOut?: number;
  logicDrift?: Pick<
    LogicDriftAssessment,
    "score" | "escalateToGlobalBrain" | "factors"
  > | null;
};

export function buildGlobalBrainSwarmTelemetry(
  input: BuildGlobalBrainSwarmTelemetryInput
): GlobalBrainSwarmTelemetry {
  const { trip } = input;
  const { identity, graph, cause_codes } = trip;
  const parent = identity.parentAgentId;
  const parentOf = parent
    ? { ...graph.parentOf, [identity.agentId]: parent }
    : { ...graph.parentOf };

  const children = new Set(graph.children);
  children.add(identity.agentId);
  const entities = new Set(graph.entities);
  if (identity.entityId) entities.add(identity.entityId);

  const siblingIds = Object.entries(parentOf)
    .filter(([id, p]) => Boolean(parent) && p === parent && id !== identity.agentId)
    .map(([id]) => id);

  const tokensIn = Math.max(0, Number(input.tokensIn ?? 0) || 0);
  const tokensOut = Math.max(0, Number(input.tokensOut ?? 0) || 0);
  const fixes = suggestFixesForCauses(cause_codes);
  const drift = input.logicDrift ?? null;
  const kind = input.kind ?? "bot_swarm_detected";

  const envelope: GlobalBrainSwarmTelemetry = {
    schema_version: GLOBAL_BRAIN_SWARM_SCHEMA_VERSION,
    kind,
    enforced: kind === "bot_swarm_detected",
    cause_codes: [...new Set(cause_codes)],
    cause_composite: composeSwarmCauseCode(cause_codes),
    spawn_depth: swarmSpawnDepth(parentOf, identity.agentId),
    parent_child_edge: Boolean(parent),
    sibling_edge:
      graph.edges.some((e) => e.kind === "peer") || siblingIds.length > 0,
    child_count: children.size,
    entity_count: entities.size,
    inflight: Math.max(0, graph.inflight),
    edge_kind_counts: countEdges(graph),
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    token_burn: tokensIn + tokensOut,
    mandate_sha256: mandateSha256(identity.mandateHash),
    silo_ref: siloRefFromTenantId(identity.tenantId),
    drift: {
      score: drift ? drift.score : null,
      escalate_to_global_brain: drift ? drift.escalateToGlobalBrain : null,
      factors: drift ? { ...drift.factors } : null,
    },
    primary_fix_id: fixes[0]!.id,
    suggested_fixes: fixes.map((fix, i) => ({
      id: fix.id,
      rank: i + 1,
      title: fix.title,
      fix_summary: fix.fix_summary,
      rationale: fix.rationale,
    })),
  };

  return GlobalBrainSwarmTelemetrySchema.parse(envelope);
}

export function collectJsonKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return into;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonKeys(item, into);
    return into;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    into.add(k);
    collectJsonKeys(v, into);
  }
  return into;
}

export function globalBrainTelemetryHasStrippedKeys(
  telemetry: GlobalBrainSwarmTelemetry
): string[] {
  const keys = collectJsonKeys(telemetry);
  return GLOBAL_BRAIN_STRIPPED_KEYS.filter((k) => keys.has(k));
}

export type SwarmCompositeCountEvent = {
  silo_ref: string;
  cause_composite: string;
};

export type SwarmDpCountRow = {
  cause_composite: string;
  count: number;
  noisy_count?: number;
  k: number;
};

function laplaceNoise(scale: number): number {
  const u = Math.random() - 0.5;
  const abs = Math.min(0.499999, Math.abs(u));
  return -scale * Math.sign(u || 1) * Math.log(1 - 2 * abs);
}

/**
 * k-anonymity histogram of cause composites. Optional Laplace noise when
 * MSGF_SWARM_DP_EPSILON (or epsilon arg) is a positive number — count DP, not DP text.
 */
export function dpCountSwarmComposites(
  events: SwarmCompositeCountEvent[],
  options?: { k?: number; epsilon?: number | null }
): SwarmDpCountRow[] {
  const k = Math.max(1, Math.floor(options?.k ?? DEFAULT_SWARM_DP_K));
  const envEps = Number(process.env.MSGF_SWARM_DP_EPSILON?.trim());
  const epsilon =
    options?.epsilon === null
      ? null
      : typeof options?.epsilon === "number" && options.epsilon > 0
        ? options.epsilon
        : Number.isFinite(envEps) && envEps > 0
          ? envEps
          : null;

  const counts = new Map<string, number>();
  for (const ev of events) {
    const composite = ev.cause_composite.trim();
    if (!composite) continue;
    counts.set(composite, (counts.get(composite) ?? 0) + 1);
  }

  const rows: SwarmDpCountRow[] = [];
  for (const [cause_composite, count] of counts) {
    if (count < k) continue;
    const row: SwarmDpCountRow = { cause_composite, count, k };
    if (epsilon && epsilon > 0) {
      row.noisy_count = Math.max(0, Math.round(count + laplaceNoise(1 / epsilon)));
    }
    rows.push(row);
  }
  return rows.sort((a, b) => b.count - a.count || a.cause_composite.localeCompare(b.cause_composite));
}
