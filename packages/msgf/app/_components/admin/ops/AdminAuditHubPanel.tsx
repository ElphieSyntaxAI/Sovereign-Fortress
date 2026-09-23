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

type AuditEvent = {
  id: string;
  product: string;
  tenant_id: string;
  company_id: string | null;
  kind: string;
  severity: string;
  trace_id: string | null;
  summary: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export function AdminAuditHubPanel() {
  const projectOrigin = useSharedProjectOrigin();
  const q = useSharedOpsQuery();
  const [kind, setKind] = useState("");
  const [severity, setSeverity] = useState("");
  const [p7Filter, setP7Filter] = useState("");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [scope, setScope] = useState<"global" | "company">("company");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (kind.trim()) params.set("kind", kind.trim());
      if (severity.trim()) params.set("severity", severity.trim());
      if (p7Filter.trim()) params.set("p7", p7Filter.trim());
      if (projectOrigin) params.set("project_origin", projectOrigin);
      params.set("limit", "40");
      const res = await fetch(`/api/msgf/admin/audit-hub?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        scope?: "global" | "company";
        events?: AuditEvent[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setEvents(json.events ?? []);
      if (json.scope) setScope(json.scope);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit hub search failed.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [q, kind, severity, p7Filter, projectOrigin]);

  useEffect(() => {
    if (!projectOrigin && !q.trim()) return;
    void runSearch();
  }, [projectOrigin, q, runSearch]);

  return (
    <div id="audit-hub">
      <AdminGovernanceSearchShell
        eyebrow="Governance"
        title="Unified audit hub"
        description="Searchable timeline across Pulse, gateway, IDE, HITL, harm flags, and budgets."
        scope={scope}
        query={q}
        onQueryChange={() => {}}
        hideQuery
        onSearch={() => void runSearch()}
        loading={loading}
        error={error}
        empty={events.length === 0}
        searched={searched}
        placeholder="Search summary, kind, trace, cause_codes, promoted_keys, blocked_keys, resource_key…"
        filters={
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              placeholder="kind (bot_swarm_detected, harm_flag…)"
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              list="audit-hub-kinds"
            />
            <datalist id="audit-hub-kinds">
              <option value="bot_swarm_detected" />
              <option value="bot_swarm_observed" />
              <option value="harm_flag" />
              <option value="p7_source_audit" />
              <option value="circuit_open" />
              <option value="budget_block" />
            </datalist>
            <input
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              placeholder="severity (info, warn, error…)"
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
            <select
              value={p7Filter}
              onChange={(e) => setP7Filter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">P7 keys (any)</option>
              <option value="promoted">Has promoted_keys</option>
              <option value="blocked">Has blocked_keys</option>
            </select>
          </div>
        }
      >
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
            >
              <button
                type="button"
                className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left"
                onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
              >
                <span className="font-medium text-slate-100">
                  [{ev.severity}] {ev.kind}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(ev.created_at).toLocaleString()}
                </span>
              </button>
              <p className="mt-1 text-slate-400">{ev.summary}</p>
              {expanded === ev.id ? (
                <div className="mt-2 space-y-2">
                  <P7KeyLists metadata={ev.metadata} />
                  <pre className="overflow-x-auto rounded bg-slate-900/80 p-2 text-[11px] text-slate-400">
                    {JSON.stringify(
                      {
                        tenant_id: ev.tenant_id,
                        company_id: ev.company_id,
                        trace_id: ev.trace_id,
                        product: ev.product,
                        metadata: ev.metadata,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </AdminGovernanceSearchShell>
    </div>
  );
}

function asKeyList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
}

function P7KeyLists({ metadata }: { metadata?: Record<string, unknown> }) {
  const promoted = asKeyList(metadata?.promoted_keys);
  const blocked = asKeyList(metadata?.blocked_keys);
  if (!promoted.length && !blocked.length) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">
          Promoted ({Number(metadata?.promoted_count ?? promoted.length)})
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {promoted.map((key) => (
            <a
              key={`p-${key}`}
              href={`/dashboard#source-audit?resource_key=${encodeURIComponent(key)}`}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-100 hover:underline"
            >
              {key}
            </a>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/80">
          Blocked ({Number(metadata?.blocked_count ?? blocked.length)})
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {blocked.map((key) => (
            <a
              key={`b-${key}`}
              href={`/dashboard#source-audit?resource_key=${encodeURIComponent(key)}`}
              className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-100 hover:underline"
            >
              {key}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
