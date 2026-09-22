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
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type SkipRow = {
  id: string;
  project_origin: string;
  actor: string | null;
  git_sha: string | null;
  reason: string | null;
  created_at: string;
};

type ListPayload = {
  ok?: boolean;
  error?: string;
  count?: number;
  rows?: SkipRow[];
};

export function AdminSkipAuditPanel() {
  const searchParams = useSearchParams();
  const urlOrigin = searchParams?.get("project_origin")?.trim() || "";
  const [rows, setRows] = useState<SkipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState(urlOrigin);

  useEffect(() => {
    setOriginFilter(urlOrigin);
  }, [urlOrigin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = originFilter.trim()
        ? `?project_origin=${encodeURIComponent(originFilter.trim())}`
        : "";
      const res = await fetch(`/api/msgf/ops/skip-audit${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as ListPayload;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setRows(json.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load skip audit.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [originFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="glass-panel rounded-2xl border border-rose-500/25 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300/90">
            Pulse Guard A5
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Skip-MSGF audit</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Emergency bypasses (<code className="text-slate-300">msgf.skipMsgf</code> /{" "}
            <code className="text-slate-300">MSGF_SKIP=1</code>) always leave an HMAC-signed row
            here — never silent.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          placeholder="Filter project_origin"
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-rose-600/80 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          Apply
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No skip audits yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800/80 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-slate-200">{row.project_origin}</span>
                <time className="text-xs text-slate-500">{row.created_at}</time>
              </div>
              <p className="mt-1 text-slate-400">
                {row.actor ? <span>actor: {row.actor}</span> : <span>actor: —</span>}
                {row.git_sha ? (
                  <span className="ml-3 font-mono text-xs">sha: {row.git_sha.slice(0, 12)}</span>
                ) : null}
              </p>
              {row.reason ? (
                <p className="mt-1 text-slate-500">{row.reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
