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
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [severity, setSeverity] = useState("");
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
  }, [q, kind, severity]);

  return (
    <div id="audit-hub">
      <AdminGovernanceSearchShell
        eyebrow="Governance"
        title="Unified audit hub"
        description="Searchable timeline across Pulse, gateway, IDE, HITL, harm flags, and budgets."
        scope={scope}
        query={q}
        onQueryChange={setQ}
        onSearch={() => void runSearch()}
        loading={loading}
        error={error}
        empty={events.length === 0}
        searched={searched}
        placeholder="Search summary, kind, or trace id…"
        filters={
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              placeholder="kind (harm_flag, p7_source_audit…)"
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              placeholder="severity (info, warn, error…)"
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            />
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
                <pre className="mt-2 overflow-x-auto rounded bg-slate-900/80 p-2 text-[11px] text-slate-400">
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
              ) : null}
            </li>
          ))}
        </ul>
      </AdminGovernanceSearchShell>
    </div>
  );
}
