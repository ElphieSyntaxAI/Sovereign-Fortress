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
import { PROMPT_SESSION_RETENTION_NOTICE } from "@/lib/msgf-legal";

type SessionRow = {
  id: string;
  tenant_id: string;
  trace_id: string;
  product: string;
  prompt_text: string;
  completion_text: string;
  model_id: string | null;
  observed_at: string;
  harm_categories: string[];
  tokens_in: number;
  tokens_out: number;
};

export function AdminSessionReplayPanel() {
  const projectOrigin = useSharedProjectOrigin();
  const q = useSharedOpsQuery();
  const [harmOnly, setHarmOnly] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [scope, setScope] = useState<"global" | "company">("company");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState<SessionRow | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (harmOnly) params.set("harm_only", "1");
      if (projectOrigin) params.set("project_origin", projectOrigin);
      params.set("limit", "25");
      const res = await fetch(`/api/msgf/admin/prompt-sessions/search?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        scope?: "global" | "company";
        sessions?: SessionRow[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSessions(json.sessions ?? []);
      if (json.scope) setScope(json.scope);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Session search failed.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [q, harmOnly, projectOrigin]);

  useEffect(() => {
    if (!projectOrigin && !q.trim()) return;
    void runSearch();
  }, [projectOrigin, q, runSearch]);

  return (
    <div id="session-replay">
      <AdminGovernanceSearchShell
        eyebrow="Forensics"
        title="Session Replay"
        description="Full-text search of governed prompts and completions. Harm-flagged rows open HITL."
        scope={scope}
        query={q}
        onQueryChange={() => {}}
        hideQuery
        onSearch={() => void runSearch()}
        loading={loading}
        error={error}
        empty={sessions.length === 0}
        searched={searched}
        placeholder="Search prompt, completion, or trace id…"
        filters={
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={harmOnly}
                onChange={(e) => setHarmOnly(e.target.checked)}
              />
              Harm-flagged only
            </label>
            <p className="text-[11px] text-amber-200/80">{PROMPT_SESSION_RETENTION_NOTICE}</p>
          </div>
        }
      >
        <ul className="space-y-2">
          {sessions.map((s) => {
            const harmed = Array.isArray(s.harm_categories) && s.harm_categories.length > 0;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActive(s)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    harmed
                      ? "border-rose-500/40 bg-rose-950/30 text-rose-100"
                      : "border-slate-800 bg-slate-950/40 text-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">
                      {s.model_id ?? "model"} · {s.product}
                      {harmed ? ` · HARM (${s.harm_categories.join(", ")})` : ""}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(s.observed_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-slate-400">
                    {s.prompt_text.slice(0, 180) || "(empty prompt)"}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>

        {active ? (
          <div className="mt-4 rounded-xl border border-cyan-500/30 bg-slate-950/80 p-4 text-sm text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-50">Replay</h3>
              <button
                type="button"
                className="text-xs text-slate-400 underline"
                onClick={() => setActive(null)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              trace={active.trace_id} · tokens {active.tokens_in}/{active.tokens_out}
            </p>
            <h4 className="mt-3 text-xs uppercase tracking-wide text-cyan-300/80">Prompt</h4>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-2 text-xs">
              {active.prompt_text}
            </pre>
            <h4 className="mt-3 text-xs uppercase tracking-wide text-cyan-300/80">Completion</h4>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-2 text-xs">
              {active.completion_text}
            </pre>
            {active.harm_categories?.length ? (
              <a
                href="/admin/ops#arbitrate"
                className="mt-3 inline-block text-sm text-rose-300 underline"
              >
                Open HITL / ARBITRATE
              </a>
            ) : null}
          </div>
        ) : null}
      </AdminGovernanceSearchShell>
    </div>
  );
}
