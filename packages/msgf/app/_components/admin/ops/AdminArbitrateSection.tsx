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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T050211Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045550Z-internal
 */
import { useCallback, useEffect, useState } from "react";

import {
  fetchPendingIncidents,
  incidentDetail,
  incidentSummary,
  type AdminDashboardSession,
  type MsgfIncident,
} from "@/lib/admin-browser-api";
import { AdminResolutionPanel } from "./AdminResolutionPanel";

type Props = {
  onSession?: (session: AdminDashboardSession) => void;
  /** @see ResolutionPanel */
  hideDeveloperKeystrokes?: boolean;
  /** Dev gate: seed GLOBAL_ADMIN before the first API round-trip. */
  seedSession?: AdminDashboardSession;
};

export function AdminArbitrateSection({ onSession, hideDeveloperKeystrokes, seedSession }: Props) {
  const [incidents, setIncidents] = useState<MsgfIncident[]>([]);
  const [session, setSession] = useState<AdminDashboardSession>(seedSession ?? {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { incidents: rows, session: nextSession } = await fetchPendingIncidents();
      const merged = seedSession ? { ...nextSession, ...seedSession } : nextSession;
      setSession(merged);
      onSession?.(merged);
      setIncidents(rows);
      setSelectedId((prev) =>
        prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load incidents.");
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [onSession, seedSession]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = incidents.find((i) => i.id === selectedId) ?? incidents[0];

  const onApproved = (incident: MsgfIncident) => {
    setIncidents((prev) => prev.filter((i) => i.id !== incident.id));
    setSelectedId(null);
  };

  return (
    <section className="glass-panel rounded-2xl border border-violet-500/20 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">ARBITRATE queue (live)</h2>
          <p className="text-xs text-slate-500">
            <code className="text-violet-300/90">GET /api/msgf/admin/incidents?status=pending</code>
            {" · "}
            {incidents.length} pending
            {session.operator_role ? (
              <>
                {" · "}
                <span className="text-zinc-400">role {session.operator_role}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading pending incidents…</p>
      ) : incidents.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No pending ARBITRATE incidents.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="max-h-[28rem] space-y-1 overflow-y-auto rounded-lg border border-zinc-800/80 p-1">
            {incidents.map((incident) => (
              <li key={incident.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(incident.id)}
                  className={`w-full rounded-md px-2 py-2 text-left text-xs transition ${
                    selectedId === incident.id
                      ? "bg-zinc-800 text-zinc-50"
                      : "text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  <div className="font-medium text-zinc-200">
                    {incidentSummary(incident)}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                    {incident.user_id.slice(0, 8)}… · {incident.bug_index.level_1_1_branch}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <AdminResolutionPanel
              incident={selected}
              detail={incidentDetail(selected)}
              onApproved={onApproved}
              canPromoteToGlobal={session.can_promote_to_global === true}
              hideDeveloperKeystrokes={hideDeveloperKeystrokes}
            />
          ) : (
            <p className="text-sm text-zinc-500">Select an incident.</p>
          )}
        </div>
      )}
    </section>
  );
}
