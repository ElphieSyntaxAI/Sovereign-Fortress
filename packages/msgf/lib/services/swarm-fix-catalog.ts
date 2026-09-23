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
 * Deterministic HITL suggested-fix catalog for bot-swarm detections (no LLM).
 */

import type { HitlIncidentStrategies } from "@/lib/schemas/hitl-strategies";

export const SWARM_CAUSE_CODES = [
  "mandate_missing",
  "mandate_mismatch",
  "mandate_unbound",
  "redis_unavailable",
  "fanout_exceeded",
  "entity_swarm",
  "inflight_exceeded",
  "graph_anomaly",
  "spawn_depth",
  "session_lock",
  "non_human_secondary",
  "resource_spike",
  "reputation_prune",
] as const;

export type SwarmCauseCode = (typeof SWARM_CAUSE_CODES)[number];

export const SWARM_FIX_IDS = [
  "narrow_mandate",
  "revoke_child_byok",
  "cap_inflight",
  "require_parent_edge",
  "freeze_this_entity",
] as const;

export type SwarmFixId = (typeof SWARM_FIX_IDS)[number];

export type SwarmSuggestedFix = {
  id: SwarmFixId;
  title: string;
  fix_summary: string;
  rationale: string;
};

const FIXES: Record<SwarmFixId, SwarmSuggestedFix> = {
  narrow_mandate: {
    id: "narrow_mandate",
    title: "Rebind child to the parent mandate",
    fix_summary:
      "Abort the drifting child, require x-msgf-mandate-hash to match the parent prompt hash, and restart only agents that echo that hash.",
    rationale: "Secondary ran without (or against) the parent prompt binding.",
  },
  revoke_child_byok: {
    id: "revoke_child_byok",
    title: "Revoke child BYOK until HITL clears",
    fix_summary:
      "Drop tenant vault keys used by the child agent id and keep Pulse on Small Brain until an operator approves.",
    rationale: "Fan-out or NON_HUMAN child can spend BYOK without a human in the loop.",
  },
  cap_inflight: {
    id: "cap_inflight",
    title: "Lower tenant secondary in-flight cap",
    fix_summary:
      "Keep additional agents allowed but cut MSGF_SWARM_MAX_INFLIGHT (default 4) and unique entity fan-out for this tenant.",
    rationale: "Too many concurrent secondary agents or entity ids for one tenant.",
  },
  require_parent_edge: {
    id: "require_parent_edge",
    title: "Require parent-spawned edges only",
    fix_summary:
      "Reject child-to-child spawns and depth > 2. Children may talk only through the parent agent id.",
    rationale: "Sibling edge or deep spawn looks like an unsupervised swarm.",
  },
  freeze_this_entity: {
    id: "freeze_this_entity",
    title: "Freeze this entity session",
    fix_summary:
      "Keep the tenant open, but hold this entity_id in PENDING_HUMAN_ARBITRATION until APPROVE_BYPASS or DENY_PURGE.",
    rationale: "Hard session lock or resource spike on one actor — do not tenant-freeze.",
  },
};

const CAUSE_PRIMARY: Record<SwarmCauseCode, SwarmFixId> = {
  mandate_missing: "narrow_mandate",
  mandate_mismatch: "narrow_mandate",
  mandate_unbound: "narrow_mandate",
  redis_unavailable: "cap_inflight",
  fanout_exceeded: "cap_inflight",
  entity_swarm: "cap_inflight",
  inflight_exceeded: "cap_inflight",
  graph_anomaly: "require_parent_edge",
  spawn_depth: "require_parent_edge",
  session_lock: "freeze_this_entity",
  non_human_secondary: "revoke_child_byok",
  resource_spike: "freeze_this_entity",
  reputation_prune: "cap_inflight",
};

const ALT_ORDER: SwarmFixId[] = [
  "narrow_mandate",
  "revoke_child_byok",
  "cap_inflight",
  "require_parent_edge",
  "freeze_this_entity",
];

export function primaryFixForCauses(causes: SwarmCauseCode[]): SwarmSuggestedFix {
  const first = causes[0] ?? "graph_anomaly";
  return FIXES[CAUSE_PRIMARY[first]];
}

export function suggestFixesForCauses(causes: SwarmCauseCode[]): SwarmSuggestedFix[] {
  const primary = primaryFixForCauses(causes);
  const rest = ALT_ORDER.filter((id) => id !== primary.id).slice(0, 2);
  return [primary, ...rest.map((id) => FIXES[id])];
}

export function swarmFixesToHitlStrategies(causes: SwarmCauseCode[]): HitlIncidentStrategies {
  const fixes = suggestFixesForCauses(causes);
  const ids = ["A", "B", "C"] as const;
  return {
    generated_at: new Date().toISOString(),
    roadmap_version: "MSGF_V32_SWARM",
    p2_pipeline: ["DEFEND", "CONVERGE", "ARBITRATE", "PERSIST", "SWEEP", "SHARD", "CROSS-REF"],
    strategies: fixes.map((fix, i) => ({
      id: ids[i]!,
      title: fix.title,
      fix_summary: fix.fix_summary,
      p2_step: i === 0 ? "DEFEND" : i === 1 ? "ARBITRATE" : "CONVERGE",
      consequence_score: 20 + i * 10,
      consequence_factors: {
        roadmap_alignment: 20,
        modular_compliance: 20,
        risk_penalty: 20,
        ai_assessment: 10,
      },
      rationale: fix.rationale,
    })),
  };
}
