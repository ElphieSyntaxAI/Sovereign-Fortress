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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
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
 * Distribution Build ID: MSGF-f106bce0-20260923T193404Z-internal
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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
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
 * Distribution Build ID: MSGF-08289e1a-20260923T145027Z-internal
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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
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
 * Distribution Build ID: MSGF-1826a636-20260922T233446Z-internal
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

import { AdminGovernanceSearchShell } from "@/app/_components/admin/ops/AdminGovernanceSearchShell";
import { useSharedOpsQuery, useSharedProjectOrigin } from "@/app/_components/admin/ops/useSharedProjectOrigin";

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
  const projectOrigin = useSharedProjectOrigin();
  const tenantId = useSharedOpsQuery();
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
      if (projectOrigin) params.set("project_origin", projectOrigin);
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
  }, [tenantId, projectOrigin]);

  useEffect(() => {
    if (!projectOrigin && !tenantId.trim()) return;
    void run();
  }, [projectOrigin, tenantId, run]);

  return (
    <div id="model-fitness">
      <AdminGovernanceSearchShell
        eyebrow="Routing"
        title="Model fitness"
        description="Under/over-provision signals and cheapest-fit suggestion for Small Brain preference."
        scope={scope}
        query={tenantId}
        onQueryChange={() => {}}
        hideQuery
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
