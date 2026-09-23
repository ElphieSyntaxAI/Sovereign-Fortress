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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Shadow Proof ledger — duplicate calls, retry loops, and policy-risk flags.
 * Projected governance value, not proven eco and not a hallucination counter.
 */

import type { ShadowRecommendedAction } from "@/lib/gateway/types";

export const SHADOW_RETRY_LOOP_ACTION = "FLAG_RETRY_LOOP" as const;
export const SHADOW_POLICY_DRIFT_ACTION = "FLAG_POLICY_DRIFT" as const;
export const SHADOW_BOT_SWARM_ACTION = "FLAG_BOT_SWARM" as const;

/** Shown on trial reports and live proof panels — scope, not a capability catalog. */
export const SHADOW_PROOF_SCOPE_DISCLAIMER =
  "This estimate is for Shadow Proxy traffic on this project only. It is not the full MSGF capability set — Pulse, Vault/Hall memory, ingest shards, Active Governance, and proven eco are not included unless those paths actually ran.";

const RETRY_LOOP_RE =
  /\b(try again|that (didn'?t|did not) work|still (failing|broken|wrong)|same error|once more|again please|you hallucinat|you'?re (wrong|making that up)|doesn'?t compile|still broken)\b/i;

const POLICY_DRIFT_RE =
  /\b(contradict|override|ignore previous|jailbreak|bypass (the )?(rules|filter|guard|safety))\b/i;

export type ShadowPromptSignals = {
  retry_loop: boolean;
  policy_drift: boolean;
  fat_context: boolean;
};

export type ShadowProofRow = {
  prompt_hash?: string | null;
  actual_cost_usd?: number | null;
  recommended_action?: string | null;
  actual_tokens?: number | null;
  observed_at?: string | null;
  p7_promote_count?: number | null;
  p7_block_count?: number | null;
  p7_deferred?: Array<{ resource_key?: string; outcome?: string }> | null;
};

export type ShadowProofLedger = {
  evaluation_count: number;
  unique_prompts: number;
  duplicate_calls: number;
  duplicate_cost_usd: number;
  retry_loop_prompts: number;
  policy_flags: number;
  fat_context_calls: number;
  bot_swarm_waves: number;
  cache_recommended: number;
  p7_promoted_resources: number;
  p7_blocked_resources: number;
  headline: string;
};

export function classifyShadowPromptSignals(promptText: string): ShadowPromptSignals {
  const text = promptText || "";
  return {
    retry_loop: RETRY_LOOP_RE.test(text),
    policy_drift: POLICY_DRIFT_RE.test(text),
    fat_context: text.length >= 32_000,
  };
}

export function pickShadowRecommendedAction(input: {
  cacheHit: boolean;
  signals: ShadowPromptSignals;
  fallback: ShadowRecommendedAction;
  swarmTrip?: boolean;
}): ShadowRecommendedAction {
  if (input.swarmTrip) return SHADOW_BOT_SWARM_ACTION;
  if (input.cacheHit) return "ENABLE_SEMANTIC_CACHE";
  if (input.signals.retry_loop) return SHADOW_RETRY_LOOP_ACTION;
  if (input.signals.policy_drift) return SHADOW_POLICY_DRIFT_ACTION;
  return input.fallback;
}

function roundUsd(value: number): number {
  return Math.round(Math.max(0, value) * 1_000_000) / 1_000_000;
}

function formatProofUsd(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  if (value > 0) return `$${value.toFixed(4)}`;
  return "$0";
}

export function buildShadowProofHeadline(proof: Omit<ShadowProofLedger, "headline">): string {
  if (proof.evaluation_count <= 0) {
    return "No traffic yet — we count duplicate calls, retry loops, policy-risk prompts, and runaway secondary-agent waves as soon as the SDK is pointed here.";
  }

  const parts: string[] = [];
  if (proof.bot_swarm_waves > 0) {
    parts.push(
      `aborted ${proof.bot_swarm_waves.toLocaleString()} runaway secondary-agent wave${
        proof.bot_swarm_waves === 1 ? "" : "s"
      }`
    );
  }
  if (proof.duplicate_calls > 0) {
    parts.push(
      `skipped ${proof.duplicate_calls.toLocaleString()} duplicate call${
        proof.duplicate_calls === 1 ? "" : "s"
      } (${formatProofUsd(proof.duplicate_cost_usd)})`
    );
  }
  if (proof.retry_loop_prompts > 0) {
    parts.push(
      `caught ${proof.retry_loop_prompts.toLocaleString()} retry-loop prompt${
        proof.retry_loop_prompts === 1 ? "" : "s"
      }`
    );
  }
  if (proof.policy_flags > 0) {
    parts.push(
      `flagged ${proof.policy_flags.toLocaleString()} policy-risk prompt${
        proof.policy_flags === 1 ? "" : "s"
      }`
    );
  }
  if (proof.p7_promoted_resources > 0 || proof.p7_blocked_resources > 0) {
    parts.push(
      `promoted ${proof.p7_promoted_resources.toLocaleString()} resource${
        proof.p7_promoted_resources === 1 ? "" : "s"
      } and blocked ${proof.p7_blocked_resources.toLocaleString()}`
    );
  }
  if (proof.fat_context_calls > 0 && parts.length < 2) {
    parts.push(
      `sharded ${proof.fat_context_calls.toLocaleString()} oversized context dump${
        proof.fat_context_calls === 1 ? "" : "s"
      }`
    );
  }

  if (parts.length === 0) {
    return `${proof.evaluation_count.toLocaleString()} call${
      proof.evaluation_count === 1 ? "" : "s"
    } observed. Duplicates, retry loops, Hall/policy flags, and runaway agent waves appear as soon as traffic repeats.`;
  }

  const joined =
    parts.length === 1
      ? parts[0]!
      : parts.length === 2
        ? `${parts[0]} and ${parts[1]}`
        : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return `Active Governance would have ${joined}.`;
}

export function computeShadowProof(rows: ShadowProofRow[]): ShadowProofLedger {
  const byHash = new Map<
    string,
    Array<{ cost: number; at: number; action: string; tokens: number }>
  >();

  for (const row of rows) {
    const hash = String(row.prompt_hash ?? "").trim() || "__empty__";
    const cost = Number(row.actual_cost_usd ?? 0) || 0;
    const at = row.observed_at ? Date.parse(row.observed_at) || 0 : 0;
    const action = String(row.recommended_action ?? "KEEP_AS_IS");
    const tokens = Number(row.actual_tokens ?? 0) || 0;
    const list = byHash.get(hash) ?? [];
    list.push({ cost, at, action, tokens });
    byHash.set(hash, list);
  }

  let duplicate_calls = 0;
  let duplicate_cost_usd = 0;
  let retry_loop_prompts = 0;
  let policy_flags = 0;
  let fat_context_calls = 0;
  let bot_swarm_waves = 0;
  let cache_recommended = 0;
  const promotedKeys = new Set<string>();
  const blockedKeys = new Set<string>();

  for (const row of rows) {
    const deferred = Array.isArray(row.p7_deferred) ? row.p7_deferred : [];
    if (deferred.length) {
      for (const d of deferred) {
        const key = String(d?.resource_key ?? "").trim();
        if (!key) continue;
        if (d.outcome === "good") promotedKeys.add(key);
        else blockedKeys.add(key);
      }
    }
  }

  for (const list of byHash.values()) {
    list.sort((a, b) => a.at - b.at);
    if (list.length > 1) {
      duplicate_calls += list.length - 1;
      for (const extra of list.slice(1)) {
        duplicate_cost_usd += extra.cost;
      }
    }
    for (const item of list) {
      if (item.action === SHADOW_RETRY_LOOP_ACTION) retry_loop_prompts += 1;
      if (item.action === SHADOW_POLICY_DRIFT_ACTION) policy_flags += 1;
      if (item.action === SHADOW_BOT_SWARM_ACTION) bot_swarm_waves += 1;
      if (item.action === "ENABLE_SEMANTIC_CACHE") cache_recommended += 1;
      if (item.action === "ENABLE_STATE_GATING" || item.tokens >= 8_000) {
        fat_context_calls += 1;
      }
    }
  }

  const evaluation_count = rows.length;
  const unique_prompts = [...byHash.keys()].filter((k) => k !== "__empty__").length;
  const unique =
    unique_prompts > 0 ? unique_prompts : evaluation_count > 0 ? 1 : 0;

  const base = {
    evaluation_count,
    unique_prompts: unique,
    duplicate_calls,
    duplicate_cost_usd: roundUsd(duplicate_cost_usd),
    retry_loop_prompts,
    policy_flags,
    fat_context_calls,
    bot_swarm_waves,
    cache_recommended,
    p7_promoted_resources: promotedKeys.size,
    p7_blocked_resources: blockedKeys.size,
  };

  return {
    ...base,
    headline: buildShadowProofHeadline(base),
  };
}

export const EMPTY_SHADOW_PROOF: ShadowProofLedger = {
  evaluation_count: 0,
  unique_prompts: 0,
  duplicate_calls: 0,
  duplicate_cost_usd: 0,
  retry_loop_prompts: 0,
  policy_flags: 0,
  fat_context_calls: 0,
  bot_swarm_waves: 0,
  cache_recommended: 0,
  p7_promoted_resources: 0,
  p7_blocked_resources: 0,
  headline: buildShadowProofHeadline({
    evaluation_count: 0,
    unique_prompts: 0,
    duplicate_calls: 0,
    duplicate_cost_usd: 0,
    retry_loop_prompts: 0,
    policy_flags: 0,
    fat_context_calls: 0,
    bot_swarm_waves: 0,
    cache_recommended: 0,
    p7_promoted_resources: 0,
    p7_blocked_resources: 0,
  }),
};
