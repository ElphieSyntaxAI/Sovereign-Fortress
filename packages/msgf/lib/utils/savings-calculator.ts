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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * Defensible dashboard ROI math (transparent formulas, no external LLM billing).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";
import {
  readContextSavingsTokens24h,
  readGuidedSessions24h,
} from "@/lib/services/pack-registry";
import { getSavingsFeaturesSummary24h } from "@/lib/services/savings-features-stats";
import {
  MSGF_LOCAL_GATEWAY_BASE_TOKENS,
  MSGF_NAIVE_DUAL_CONVERGE_TOKENS,
} from "@/lib/services/token-usage-estimate";

export type DefensibleSavingsBreakdown = {
  tenant_id: string;
  window_hours: 24;
  msgf_cloud_tokens: number;
  msgf_cloud_formula: string;
  context_savings_tokens: number;
  context_savings_formula: string;
  guided_sessions_verified: number;
  verify_result_vault_tokens_saved: number;
  run_script_rerun_tokens_saved: number;
  pulse_routing_tokens_saved_estimate: number;
  combined_msgf_impact_tokens: number;
  footnote: string;
};

async function sumUsageMonitorForTenantIdeUsers(
  admin: SupabaseClient,
  tenantKey: string
): Promise<number> {
  const tid = sanitizeTenantScope(tenantKey);
  const { data: tokens, error: tokErr } = await admin
    .from("msgf_ide_tokens")
    .select("user_id")
    .eq("tenant_id", tid)
    .is("revoked_at", null);

  if (tokErr || !tokens?.length) return 0;

  const userIds = [...new Set(tokens.map((r) => r.user_id).filter(Boolean))];
  if (!userIds.length) return 0;

  const { data: usage, error: useErr } = await admin
    .from("usage_monitor")
    .select("tokens_cumulative")
    .in("user_id", userIds);

  if (useErr) return 0;

  return (usage ?? []).reduce((sum, row) => {
    const n = Number(row.tokens_cumulative ?? 0);
    return sum + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  }, 0);
}

/**
 * Row 1 — MSGF cloud tokens (metered telemetry + conservative pulse estimate).
 * Row 2 — Context savings from verified pack confirmations only.
 */
export async function computeDefensibleSavingsBreakdown(
  admin: SupabaseClient,
  tenantId: string
): Promise<DefensibleSavingsBreakdown> {
  const tid = sanitizeTenantScope(tenantId);
  const [usageMonitorTotal, savingsSummary, guidedSessions, contextSavingsRedis] =
    await Promise.all([
      sumUsageMonitorForTenantIdeUsers(admin, tid),
      getSavingsFeaturesSummary24h(tid, "user"),
      readGuidedSessions24h(tid),
      readContextSavingsTokens24h(tid),
    ]);

  const pulseMix = savingsSummary.pulse_routing;
  const counters = savingsSummary.counters;

  const pulseCloudEstimate =
    pulseMix.global_converge * MSGF_NAIVE_DUAL_CONVERGE_TOKENS +
    (pulseMix.local_gateway + pulseMix.converge_bypass) * MSGF_LOCAL_GATEWAY_BASE_TOKENS +
    pulseMix.converge_degraded * Math.floor(MSGF_LOCAL_GATEWAY_BASE_TOKENS * 1.5);

  const devEventCloud = counters.dev_events > 0 ? counters.dev_event_tokens_saved : 0;
  const msgf_cloud_tokens = usageMonitorTotal + pulseCloudEstimate + devEventCloud;

  const context_savings_tokens =
    contextSavingsRedis +
    counters.verify_result_vault_tokens_saved +
    counters.run_script_rerun_tokens_saved;

  const combined_msgf_impact_tokens =
    msgf_cloud_tokens + context_savings_tokens + pulseMix.estimated_tokens_saved_vs_naive;

  return {
    tenant_id: tid,
    window_hours: 24,
    msgf_cloud_tokens,
    msgf_cloud_formula:
      "usage_monitor (IDE users on tenant) + pulse global/local routing estimate + dev-event cloud heal",
    context_savings_tokens,
    context_savings_formula:
      "confirm-pack verified savings + verify→Vault pack delta + Run Scripts re-prompt avoidance (24h Redis)",
    guided_sessions_verified: guidedSessions,
    verify_result_vault_tokens_saved: counters.verify_result_vault_tokens_saved,
    run_script_rerun_tokens_saved: counters.run_script_rerun_tokens_saved,
    pulse_routing_tokens_saved_estimate: pulseMix.estimated_tokens_saved_vs_naive,
    combined_msgf_impact_tokens,
    footnote:
      "External IDE LLM prompt consumption is handled out-of-band by your native Cursor/Anthropic subscription. MSGF metrics reflect governance routing and verified context-pack savings only.",
  };
}
