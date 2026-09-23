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
 * Tenant budget + rapid-retry circuit breaker (pre-dispatch).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { msgfRedisKey, redisIncrWithWindow } from "@/lib/redis";
import { emitPlatformAudit } from "@/lib/services/emit-platform-audit";

export type BudgetExceededAction = "block" | "fallback_small_brain";

export type BudgetCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason: "budget_exceeded" | "circuit_open" | "session_tokens";
      action: BudgetExceededAction;
    };

function spendMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function checkTenantBudgetBeforeDispatch(
  admin: SupabaseClient,
  opts: {
    tenant_id: string;
    estimated_cost_usd?: number;
    trace_id?: string | null;
    parent_agent_id?: string | null;
    session_tokens_so_far?: number;
    /** When true, refuse fallback_small_brain (RED/harm path). */
    safety_critical?: boolean;
  }
): Promise<BudgetCheckResult> {
  const tid = opts.tenant_id.trim();
  if (!tid) return { ok: true };

  const { data: budget } = await admin
    .from("msgf_tenant_budgets")
    .select(
      "monthly_dollar_cap, current_month_spend, spend_month, max_session_tokens, rapid_retry_threshold, budget_exceeded_action"
    )
    .eq("tenant_id", tid)
    .maybeSingle();

  if (!budget) return { ok: true };

  const month = spendMonth();
  let spend = Number(budget.current_month_spend ?? 0);
  if (budget.spend_month !== month) {
    spend = 0;
    await admin
      .from("msgf_tenant_budgets")
      .update({ current_month_spend: 0, spend_month: month, updated_at: new Date().toISOString() })
      .eq("tenant_id", tid);
  }

  const cap = Number(budget.monthly_dollar_cap ?? 0);
  const action = (budget.budget_exceeded_action as BudgetExceededAction) || "block";
  const maxTokens = Number(budget.max_session_tokens ?? 200000);
  const rapid = Number(budget.rapid_retry_threshold ?? 10);

  if (opts.trace_id?.trim()) {
    const count = await redisIncrWithWindow(
      msgfRedisKey("budget-circuit", tid, opts.trace_id.trim()),
      60
    );
    if (typeof count === "number" && count > rapid) {
      emitPlatformAudit(admin, {
        product: "msgf",
        tenant_id: tid,
        kind: "circuit_open",
        severity: "error",
        trace_id: opts.trace_id,
        summary: `Circuit open: ${count} calls in 60s (threshold ${rapid})`,
      });
      return { ok: false, reason: "circuit_open", action: "block" };
    }
  }

  const parentAgent = opts.parent_agent_id?.trim();
  if (parentAgent) {
    const parentCount = await redisIncrWithWindow(
      msgfRedisKey("budget-circuit", "parent", tid, parentAgent),
      60
    );
    if (typeof parentCount === "number" && parentCount > rapid) {
      emitPlatformAudit(admin, {
        product: "msgf",
        tenant_id: tid,
        kind: "circuit_open",
        severity: "error",
        trace_id: opts.trace_id ?? null,
        summary: `Circuit open: ${parentCount} calls in 60s for parent ${parentAgent} (threshold ${rapid})`,
      });
      return { ok: false, reason: "circuit_open", action: "block" };
    }
  }

  if (
    opts.session_tokens_so_far != null &&
    maxTokens > 0 &&
    opts.session_tokens_so_far > maxTokens
  ) {
    emitPlatformAudit(admin, {
      product: "msgf",
      tenant_id: tid,
      kind: "circuit_open",
      severity: "error",
      trace_id: opts.trace_id ?? null,
      summary: `Session token cap exceeded (${opts.session_tokens_so_far} > ${maxTokens})`,
    });
    return { ok: false, reason: "session_tokens", action: "block" };
  }

  if (cap > 0 && spend + Number(opts.estimated_cost_usd ?? 0) > cap) {
    const effectiveAction =
      opts.safety_critical && action === "fallback_small_brain" ? "block" : action;
    emitPlatformAudit(admin, {
      product: "msgf",
      tenant_id: tid,
      kind: "budget_block",
      severity: "warn",
      trace_id: opts.trace_id ?? null,
      summary: `Budget exceeded: spend ${spend} cap ${cap} → ${effectiveAction}`,
    });
    return { ok: false, reason: "budget_exceeded", action: effectiveAction };
  }

  return { ok: true };
}

export async function recordTenantSpend(
  admin: SupabaseClient,
  tenantId: string,
  costUsd: number
): Promise<void> {
  const tid = tenantId.trim();
  if (!tid || !(costUsd > 0)) return;
  const month = spendMonth();
  const { data } = await admin
    .from("msgf_tenant_budgets")
    .select("current_month_spend, spend_month")
    .eq("tenant_id", tid)
    .maybeSingle();
  if (!data) return;
  const spend =
    data.spend_month === month ? Number(data.current_month_spend ?? 0) + costUsd : costUsd;
  await admin
    .from("msgf_tenant_budgets")
    .update({
      current_month_spend: spend,
      spend_month: month,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tid);
}
