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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * Small Brain vs Big Brain — MSGF routing SSoT.
 *
 * **Small Brain (local):** Tenant-scoped logic, state_beats, tenant Vault/Hall,
 * Redis hot layer, and inexpensive heals. Users keep authority over routine work.
 *
 * **Big Brain (global):** Dual-model CONVERGE, platform credentials, and writes to
 * global DNA (`msgf_rules`, `vault_core`) — gated by {@link assertGlobalWriteAllowed}
 * and operator approval (rule submissions, human arbitration `scope: global`).
 */

import type { PulseRoutingKind } from "@/lib/services/token-usage-estimate";
import {
  GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
  type GlobalPromotionStatus,
  type LogicDeltaSource,
} from "@/lib/services/global-approval-gate";

export const MSGF_BRAIN_SMALL = "small_brain" as const;
export const MSGF_BRAIN_BIG = "big_brain" as const;

export type MsgfBrainTier = typeof MSGF_BRAIN_SMALL | typeof MSGF_BRAIN_BIG;

export type BrainFeatureId =
  | "pulse_local_gateway"
  | "pulse_converge_bypass"
  | "pulse_converge_degraded"
  | "pulse_global_converge"
  | "converge_result_cache"
  | "dev_event_heal_cheap"
  | "dev_session"
  | "pulse_idempotency"
  | "ingest_hash_skip"
  | "credit_reservation"
  | "usage_monitor"
  | "converge_context_budget"
  | "agent_context_pack"
  | "verify_result_loop"
  | "run_script_rerun"
  | "human_arbitration_global"
  | "rule_submission_promotion";

export type BrainAudience = "user" | "admin";

export type BrainFeatureDescriptor = {
  id: BrainFeatureId;
  label: string;
  tier: MsgfBrainTier;
  /** Dashboard / API surface that owns actionable issues for this feature. */
  audience: BrainAudience;
  /** When true, promoting beyond tenant silo requires GLOBAL/COMPANY admin approval. */
  requires_admin_for_global: boolean;
  description: string;
};

/** Operator-only surfaces for Big Brain escalations and global DNA promotion. */
export const BIG_BRAIN_ADMIN_SURFACES = [
  { label: "Ops dashboard", href: "/admin/dashboard#big-brain-issues" },
  { label: "ARBITRATE ops console", href: "/admin/ops" },
  { label: "Rule submissions", href: "/api/msgf/admin/rule-submissions" },
  { label: "Global rules", href: "/api/msgf/admin/global-rules" },
] as const;

export function audienceForBrainTier(tier: MsgfBrainTier): BrainAudience {
  return tier === MSGF_BRAIN_BIG ? "admin" : "user";
}

export function isBigBrainFeatureId(id: BrainFeatureId): boolean {
  return getBrainFeatureDescriptor(id).tier === MSGF_BRAIN_BIG;
}

export function filterCatalogEntriesForAudience<
  T extends { brain_tier: MsgfBrainTier; id?: string }
>(entries: T[], audience: BrainAudience): T[] {
  if (audience === "admin") return entries;
  return entries.filter((e) => e.brain_tier === MSGF_BRAIN_SMALL);
}

/** Canonical feature map for dashboard catalog + docs. */
export const BRAIN_FEATURE_CATALOG: readonly BrainFeatureDescriptor[] = [
  {
    id: "pulse_local_gateway",
    label: "Pulse local gateway",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description:
      "Low logic drift — session state_beats only; no dual-model CONVERGE or global DNA writes.",
  },
  {
    id: "pulse_converge_bypass",
    label: "Pulse CONVERGE bypass",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description:
      "Escalation criteria met but tenant has no BYOK / allowance — cold baseline beat without Big Brain spend.",
  },
  {
    id: "pulse_converge_degraded",
    label: "Pulse CONVERGE degraded",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description: "Soft cap or timeout — graceful local response instead of blocking on global CONVERGE.",
  },
  {
    id: "pulse_global_converge",
    label: "Pulse global CONVERGE",
    tier: MSGF_BRAIN_BIG,
    audience: "admin",
    requires_admin_for_global: true,
    description:
      "Dual-model Gemini + Claude when logic drift exceeds threshold; Vault persist may queue for admin if globalize.",
  },
  {
    id: "converge_result_cache",
    label: "CONVERGE result cache",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description:
      "Tenant Redis replay of a prior Big Brain verdict — avoids re-invoking dual-model orchestration.",
  },
  {
    id: "dev_event_heal_cheap",
    label: "IDE dev-event (Heal Cheap)",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description:
      "Build failures: tenant Vault lexical match or single Flash heal — never biometric Pulse or global CONVERGE.",
  },
  {
    id: "dev_session",
    label: "IDE dev-session",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description: "Relaxed drift and save-primary flush — local typing rhythm stays on Small Brain path longer.",
  },
  {
    id: "pulse_idempotency",
    label: "Pulse idempotency",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description: "Duplicate Idempotency-Key returns cached Pulse JSON within TTL.",
  },
  {
    id: "ingest_hash_skip",
    label: "Ingest hash skip",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description: "Unchanged file SHA skips SWEEP — tenant-local Redis hash only.",
  },
  {
    id: "credit_reservation",
    label: "Credit reservation",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description: "Pre-reserve credits before optional Big Brain work; 402 when insufficient.",
  },
  {
    id: "usage_monitor",
    label: "usage_monitor",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description: "Per-actor cumulative token estimate — does not promote logic globally.",
  },
  {
    id: "converge_context_budget",
    label: "CONVERGE context budget",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description: "Caps shardable context before Big Brain CONVERGE to reduce unnecessary escalation cost.",
  },
  {
    id: "agent_context_pack",
    label: "0-Token context pack",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description:
      "Prompt optimizer + guided agent-context downloads — sharded attachments instead of whole-repo dumps.",
  },
  {
    id: "verify_result_loop",
    label: "IDE verify-result loop",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description:
      "Safe Build + Run Scripts outcomes — pass logs to Vault (pack-linked), repeated fails dedupe to Hall.",
  },
  {
    id: "run_script_rerun",
    label: "Run Scripts (zero re-prompt)",
    tier: MSGF_BRAIN_SMALL,
    audience: "user",
    requires_admin_for_global: false,
    description:
      "Re-run optimizer verify commands from .msgf/run-scripts.json without regenerating the 0-token prompt.",
  },
  {
    id: "human_arbitration_global",
    label: "Human arbitration (global)",
    tier: MSGF_BRAIN_BIG,
    audience: "admin",
    requires_admin_for_global: true,
    description: "Operator strategies with scope global + apply_to_future_sessions — admin/HITL path.",
  },
  {
    id: "rule_submission_promotion",
    label: "Rule submission promotion",
    tier: MSGF_BRAIN_BIG,
    audience: "admin",
    requires_admin_for_global: true,
    description: "Tenant submissions to msgf_rules / vault_core require GLOBAL_ADMIN approval.",
  },
] as const;

export function classifyPulseRoutingBrain(routing: PulseRoutingKind | string | null | undefined): {
  tier: MsgfBrainTier;
  feature_id: BrainFeatureId;
} {
  const r = String(routing ?? "local_gateway");
  switch (r) {
    case "global_converge":
    case "dual_model_local":
      return { tier: MSGF_BRAIN_BIG, feature_id: "pulse_global_converge" };
    case "converge_bypass":
      return { tier: MSGF_BRAIN_SMALL, feature_id: "pulse_converge_bypass" };
    case "converge_soft_cap_degraded":
    case "converge_timeout_degraded":
      return { tier: MSGF_BRAIN_SMALL, feature_id: "pulse_converge_degraded" };
    case "local_gateway":
    default:
      return { tier: MSGF_BRAIN_SMALL, feature_id: "pulse_local_gateway" };
  }
}

export function savingsCatalogFeatureIdToBrainId(
  savingsId: string
): BrainFeatureId | null {
  const map: Record<string, BrainFeatureId> = {
    pulse_routing: "pulse_local_gateway",
    converge_cache: "converge_result_cache",
    dev_event: "dev_event_heal_cheap",
    dev_session: "dev_session",
    pulse_idempotency: "pulse_idempotency",
    ingest_hash: "ingest_hash_skip",
    usage_monitor: "usage_monitor",
    credit_reservation: "credit_reservation",
    converge_context_budget: "converge_context_budget",
    agent_context_pack: "agent_context_pack",
    verify_result: "verify_result_loop",
    run_scripts: "run_script_rerun",
  };
  return map[savingsId] ?? null;
}

export function getBrainFeatureDescriptor(id: BrainFeatureId): BrainFeatureDescriptor {
  const row = BRAIN_FEATURE_CATALOG.find((f) => f.id === id);
  if (!row) {
    throw new Error(`Unknown brain feature: ${id}`);
  }
  return row;
}

/** Dev-event and similar IDE paths must never escalate to Big Brain without a Pulse. */
export function assertSmallBrainOnlyPath(featureId: BrainFeatureId): void {
  const d = getBrainFeatureDescriptor(featureId);
  if (d.tier !== MSGF_BRAIN_SMALL) {
    throw new Error(`${featureId} must remain Small Brain — got ${d.tier}`);
  }
}

export function isGlobalPromotionPending(status: GlobalPromotionStatus): boolean {
  return status === GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING;
}

export const DEV_EVENT_LOGIC_DELTA_SOURCE: LogicDeltaSource = "dev_event";
