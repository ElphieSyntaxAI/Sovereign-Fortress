"use client";

/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */

import { useCallback, useState } from "react";

import { AdminGovernanceSearchShell } from "@/app/_components/admin/ops/AdminGovernanceSearchShell";

type Rollup = {
  model_id: string;
  prompt_class: string;
  under_count: number;
  over_count: number;
  fit_count: number;
  sample_count: number;
  avg_cost_usd: number;
  fit_rate: number;
  under_rate: number;
  over_rate: number;
};

export function AdminModelFitnessPanel() {
  const [tenantId, setTenantId] = useState("");
  const [rollups, setRollups] = useState<Rollup[]>([]);
  const [preferred, setPreferred] = useState<{
    model_id: string;
    avg_cost_usd: number;
    fit_rate: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [scope, setScope] = useState<"global" | "company">("company");

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (tenantId.trim()) params.set("tenant_id", tenantId.trim());
      params.set("limit", "40");
      const res = await fetch(`/api/msgf/admin/model-fitness?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        scope?: "global" | "company";
        rollups?: Rollup[];
        preferred_cheapest_fit?: {
          model_id: string;
          avg_cost_usd: number;
          fit_rate: number;
        } | null;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRollups(json.rollups ?? []);
      setPreferred(json.preferred_cheapest_fit ?? null);
      if (json.scope) setScope(json.scope);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fitness load failed.");
      setRollups([]);
      setPreferred(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  return (
    <div id="model-fitness">
      <AdminGovernanceSearchShell
        eyebrow="Routing"
        title="Model fitness"
        description="Under/over-provision signals and cheapest-fit suggestion for Small Brain preference."
        scope={scope}
        query={tenantId}
        onQueryChange={setTenantId}
        onSearch={() => void run()}
        loading={loading}
        error={error}
        empty={rollups.length === 0}
        searched={searched}
        placeholder="tenant_id (optional for company scope)…"
      >
        {preferred ? (
          <p className="mb-3 text-sm text-emerald-200/90">
            Suggested cheapest fit:{" "}
            <span className="font-mono">{preferred.model_id}</span> · fit{" "}
            {(preferred.fit_rate * 100).toFixed(0)}% · ~$
            {preferred.avg_cost_usd.toFixed(4)}
          </p>
        ) : null}
        <ul className="space-y-2">
          {rollups.map((r) => (
            <li
              key={`${r.prompt_class}:${r.model_id}`}
              className="rounded border border-slate-700/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
            >
              <p className="font-mono text-xs text-cyan-200/90">
                {r.model_id} · {r.prompt_class}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                n={r.sample_count} · fit {(r.fit_rate * 100).toFixed(0)}% · under{" "}
                {(r.under_rate * 100).toFixed(0)}% · over {(r.over_rate * 100).toFixed(0)}% · avg $
                {r.avg_cost_usd.toFixed(4)}
              </p>
            </li>
          ))}
        </ul>
      </AdminGovernanceSearchShell>
    </div>
  );
}
