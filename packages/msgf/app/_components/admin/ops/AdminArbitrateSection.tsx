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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T160051Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T155844Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T154800Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T073711Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T072718Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T071103Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T065535Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import { useCallback, useEffect, useState } from "react";

import {
  fetchIncidentsByStatus,
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

type StatusTab = "pending" | "resolved";

export function AdminArbitrateSection({
  onSession,
  hideDeveloperKeystrokes,
  seedSession,
}: Props) {
  const [statusTab, setStatusTab] = useState<StatusTab>("pending");
  const [incidents, setIncidents] = useState<MsgfIncident[]>([]);
  const [session, setSession] = useState<AdminDashboardSession>(seedSession ?? {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { incidents: rows, session: nextSession } =
        await fetchIncidentsByStatus(statusTab);
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
  }, [onSession, seedSession, statusTab]);

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
            <code className="text-violet-300/90">
              GET /api/msgf/admin/incidents?status={statusTab}
            </code>
            {" · "}
            {incidents.length} {statusTab}
            {session.operator_role ? (
              <>
                {" · "}
                <span className="text-zinc-400">role {session.operator_role}</span>
              </>
            ) : null}
          </p>
          <div className="mt-2 flex gap-1">
            {(["pending", "resolved"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setStatusTab(tab);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                  statusTab === tab
                    ? "bg-violet-500/25 text-violet-100"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
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
        <p className="mt-4 text-sm text-zinc-500">Loading {statusTab} incidents…</p>
      ) : incidents.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No {statusTab} ARBITRATE incidents.</p>
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

          {selected && statusTab === "pending" ? (
            <AdminResolutionPanel
              incident={selected}
              detail={incidentDetail(selected)}
              onApproved={onApproved}
              canPromoteToGlobal={session.can_promote_to_global === true}
              hideDeveloperKeystrokes={hideDeveloperKeystrokes}
            />
          ) : selected ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-slate-300">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
                Resolved
              </p>
              <p className="mt-2 font-medium text-slate-100">{incidentSummary(selected)}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs text-slate-400">
                {selected.resolution_note?.trim() || "No resolution note."}
              </p>
              <p className="mt-3 font-mono text-[10px] text-zinc-500">
                {incidentDetail(selected)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Select an incident.</p>
          )}
        </div>
      )}
    </section>
  );
}
