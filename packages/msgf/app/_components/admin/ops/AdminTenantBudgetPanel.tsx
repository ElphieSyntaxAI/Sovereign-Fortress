"use client";

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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
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
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-b4dfaf97-20260922T170731Z-internal
 */
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
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */

import { useCallback, useEffect, useState } from "react";

type Budget = {
  tenant_id: string;
  monthly_dollar_cap: number;
  current_month_spend: number;
  max_session_tokens: number;
  rapid_retry_threshold: number;
  budget_exceeded_action: "block" | "fallback_small_brain";
};

export function AdminTenantBudgetPanel(props: { tenantId?: string }) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (props.tenantId) params.set("tenant_id", props.tenantId);
      const res = await fetch(`/api/msgf/tenant-budgets?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; budget?: Budget };
      if (!res.ok || !json.ok || !json.budget) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setBudget(json.budget);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load budget.");
    }
  }, [props.tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!budget) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/msgf/tenant-budgets", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(budget),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setStatus("Budget saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="tenant-budgets"
      className="glass-panel rounded-2xl border border-amber-500/25 p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">
        Quotas
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-100">Token &amp; dollar budgets</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-400">
        Circuit-breaker before Gateway / Big Brain dispatch.{" "}
        <code className="text-slate-300">fallback_small_brain</code> never bypasses RED/harm HITL.
      </p>
      {budget ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            Monthly $ cap
            <input
              type="number"
              value={budget.monthly_dollar_cap}
              onChange={(e) =>
                setBudget({ ...budget, monthly_dollar_cap: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="text-xs text-slate-400">
            Current month spend (read-only)
            <input
              readOnly
              value={budget.current_month_spend}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-400"
            />
          </label>
          <label className="text-xs text-slate-400">
            Max session tokens
            <input
              type="number"
              value={budget.max_session_tokens}
              onChange={(e) =>
                setBudget({ ...budget, max_session_tokens: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="text-xs text-slate-400">
            Rapid retry threshold / 60s
            <input
              type="number"
              value={budget.rapid_retry_threshold}
              onChange={(e) =>
                setBudget({ ...budget, rapid_retry_threshold: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="text-xs text-slate-400 sm:col-span-2">
            When budget exceeded
            <select
              value={budget.budget_exceeded_action}
              onChange={(e) =>
                setBudget({
                  ...budget,
                  budget_exceeded_action: e.target.value as Budget["budget_exceeded_action"],
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            >
              <option value="block">block</option>
              <option value="fallback_small_brain">fallback_small_brain</option>
            </select>
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save budget"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Loading budget…</p>
      )}
      {status ? <p className="mt-2 text-sm text-emerald-300">{status}</p> : null}
      {error ? (
        <p className="mt-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
