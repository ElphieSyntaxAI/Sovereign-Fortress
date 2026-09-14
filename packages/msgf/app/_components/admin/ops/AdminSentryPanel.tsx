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
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import { useCallback, useEffect, useState } from "react";

type SentryIssue = {
  id: string;
  shortId: string;
  title: string;
  culprit: string | null;
  status: string;
  level: string | null;
  count: string | null;
  lastSeen: string | null;
  permalink: string | null;
  projectSlug: string | null;
};

type StatusPayload = {
  ok?: boolean;
  configured?: boolean;
  mode?: string;
  org_slug?: string | null;
  project_slug?: string | null;
  base_url?: string;
  error?: string;
  code?: string;
  issues?: SentryIssue[];
  count?: number;
};

export function AdminSentryPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [query, setQuery] = useState("is:unresolved");
  const [loading, setLoading] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/admin/sentry", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as StatusPayload;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setStatus(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Sentry status.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIssues = useCallback(async () => {
    setLoadingIssues(true);
    setError(null);
    try {
      const params = new URLSearchParams({ issues: "1", limit: "25" });
      if (query.trim()) params.set("query", query.trim());
      const res = await fetch(`/api/msgf/admin/sentry?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as StatusPayload;
      if (!res.ok || !json.ok) {
        if (json.code === "SENTRY_UNCONFIGURED") {
          setStatus(json);
          setIssues([]);
          return;
        }
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setStatus(json);
      setIssues(json.issues ?? []);
      setMessage(`Loaded ${json.count ?? 0} issue(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list Sentry issues.");
      setIssues([]);
    } finally {
      setLoadingIssues(false);
    }
  }, [query]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function resolveIssue(issueId: string) {
    setResolvingId(issueId);
    setError(null);
    try {
      const res = await fetch("/api/msgf/admin/sentry", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue_id: issueId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setMessage(`Resolved issue ${issueId}.`);
      await loadIssues();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolve failed.");
    } finally {
      setResolvingId(null);
    }
  }

  const configured = Boolean(status?.configured);

  return (
    <section className="glass-panel rounded-2xl border border-rose-500/20 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300/90">
            Runtime monitoring
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Sentry</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Native org issue list for operators — pairs with MSGF heal / verify (dev governance) so
            runtime errors stay visible next to the ARBITRATE queue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadStatus()}
            className="rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-400 disabled:opacity-50"
          >
            Refresh status
          </button>
          <button
            type="button"
            disabled={!configured || loadingIssues}
            onClick={() => void loadIssues()}
            className="rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
          >
            {loadingIssues ? "Loading…" : "Load issues"}
          </button>
        </div>
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-500">Checking Sentry config…</p> : null}

      {!loading && status ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Mode</dt>
            <dd className="font-medium text-slate-100">{status.mode ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Org</dt>
            <dd className="font-mono text-xs text-rose-100/90">{status.org_slug ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Project filter</dt>
            <dd className="font-mono text-xs text-slate-300">{status.project_slug ?? "(all)"}</dd>
          </div>
        </dl>
      ) : null}

      {!loading && !configured ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Sentry is <strong>unconfigured</strong>. Set{" "}
          <code className="text-amber-50">SENTRY_AUTH_TOKEN</code> and{" "}
          <code className="text-amber-50">SENTRY_ORG_SLUG</code> on the MSGF host — see{" "}
          <code className="text-amber-50">docs/integrations/technical-specs/MSGF_SENTRY.md</code>.
        </p>
      ) : null}

      {configured ? (
        <label className="mt-4 block text-sm text-slate-300">
          Issue query
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-[12rem] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
              placeholder="is:unresolved"
            />
          </div>
        </label>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-emerald-300" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}

      {issues.length > 0 ? (
        <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-100">
                    <span className="mr-2 font-mono text-xs text-rose-300/90">{issue.shortId}</span>
                    {issue.title}
                  </p>
                  {issue.culprit ? (
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{issue.culprit}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {issue.level ? `${issue.level} · ` : ""}
                    {issue.status}
                    {issue.count ? ` · ×${issue.count}` : ""}
                    {issue.projectSlug ? ` · ${issue.projectSlug}` : ""}
                    {issue.lastSeen ? ` · last ${issue.lastSeen}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {issue.permalink ? (
                    <a
                      href={issue.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-600 px-3 py-1 text-xs text-sky-200 hover:border-sky-400"
                    >
                      Open
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={resolvingId === issue.id || issue.status === "resolved"}
                    onClick={() => void resolveIssue(issue.id)}
                    className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {resolvingId === issue.id ? "…" : "Resolve"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : configured && !loadingIssues ? (
        <p className="mt-4 text-sm text-slate-500">
          No issues loaded yet — click <strong>Load issues</strong>.
        </p>
      ) : null}
    </section>
  );
}
