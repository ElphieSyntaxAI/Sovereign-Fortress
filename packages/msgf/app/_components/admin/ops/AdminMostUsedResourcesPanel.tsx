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

type RankRow = {
  resource_key: string;
  uses: number;
  last_used: string;
  kind_sample: string | null;
  product_sample: string | null;
};

export function AdminMostUsedResourcesPanel(props: { tenantId?: string }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      params.set("mode", "rank");
      params.set("since_days", "30");
      params.set("limit", "30");
      if (q.trim()) params.set("q", q.trim());
      if (kind.trim()) params.set("kind", kind.trim());
      if (props.tenantId?.trim()) params.set("tenant_id", props.tenantId.trim());
      const res = await fetch(`/api/msgf/dashboard/source-audit?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        rankings?: RankRow[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRows(json.rankings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rank search failed.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, kind, props.tenantId]);

  return (
    <div id="most-used">
      <AdminGovernanceSearchShell
        eyebrow="Pillar 7"
        title="Most used resources"
        description="Ranked resource_key usage. Search queries are hashed — raw query text is never shown."
        scope="tenant"
        query={q}
        onQueryChange={setQ}
        onSearch={() => void runSearch()}
        loading={loading}
        error={error}
        empty={rows.length === 0}
        searched={searched}
        placeholder="Filter by resource_key…"
        filters={
          <input
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            placeholder="kind (vault, hall, file, tool, search…)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Resource</th>
                <th className="py-2 pr-3">Uses</th>
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2">Last used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.resource_key} className="border-t border-slate-800">
                  <td className="max-w-[280px] truncate py-2 pr-3 font-mono text-xs text-slate-200">
                    {r.resource_key}
                  </td>
                  <td className="py-2 pr-3">{r.uses}</td>
                  <td className="py-2 pr-3">{r.kind_sample ?? "—"}</td>
                  <td className="py-2 pr-3">{r.product_sample ?? "—"}</td>
                  <td className="py-2 text-xs text-slate-500">
                    {new Date(r.last_used).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminGovernanceSearchShell>
    </div>
  );
}
