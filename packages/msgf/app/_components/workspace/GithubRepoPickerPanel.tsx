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
import { useCallback, useEffect, useMemo, useState } from "react";

import type { UserProjectRow } from "@/lib/services/user-projects";
import { createClient } from "@/utils/supabase/client";

const GITHUB_OAUTH_SCOPES = "read:user repo";

type GithubRepo = {
  full_name: string;
  html_url: string;
  private: boolean;
  updated_at: string | null;
};

type Props = {
  projects: UserProjectRow[];
  onMapped: () => Promise<void>;
  setError: (msg: string | null) => void;
  setMessage: (msg: string | null) => void;
};

export function GithubRepoPickerPanel({ projects, onMapped, setError, setMessage }: Props) {
  const [connected, setConnected] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const mappedOrigins = useMemo(
    () => new Set(projects.map((p) => p.project_origin)),
    [projects]
  );

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/msgf/github/connection", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        connected?: boolean;
        github_login?: string | null;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setConnected(false);
        setGithubLogin(null);
        return;
      }
      setConnected(Boolean(json.connected));
      setGithubLogin(json.github_login ?? null);
    } catch {
      setConnected(false);
      setGithubLogin(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setLoadingRepos(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/github/repos", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        repos?: GithubRepo[];
        error?: string;
        code?: string;
      };
      if (!res.ok || !json.ok) {
        if (json.code === "GITHUB_NOT_CONNECTED") {
          setConnected(false);
        }
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setRepos(json.repos ?? []);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list GitHub repos.");
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  }, [setError]);

  useEffect(() => {
    void loadStatus().then(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("github") === "connected") {
        void loadRepos();
      }
    });
  }, [loadStatus, loadRepos]);

  useEffect(() => {
    if (connected && repos.length === 0 && !loadingRepos && !loadingStatus) {
      void loadRepos();
    }
  }, [connected, repos.length, loadingRepos, loadingStatus, loadRepos]);

  async function connectGithub() {
    setConnecting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const existingToken = sessionData.session?.provider_token?.trim();
      const hasGithub = sessionData.session?.user?.identities?.some((id) => id.provider === "github");
      if (existingToken && hasGithub) {
        const res = await fetch("/api/msgf/github/connection", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: existingToken, scopes: GITHUB_OAUTH_SCOPES }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string; github_login?: string | null };
        if (res.ok && json.ok) {
          setConnected(true);
          setGithubLogin(json.github_login ?? null);
          setMessage("GitHub connected from current session.");
          await loadRepos();
          setConnecting(false);
          return;
        }
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        "/setup/projects?github=connected"
      )}`;
      const { error } = await supabase.auth.linkIdentity({
        provider: "github",
        options: {
          scopes: GITHUB_OAUTH_SCOPES,
          redirectTo,
        },
      });
      if (error) {
        // Fallback: some projects use signInWithOAuth when linkIdentity is unavailable
        const { error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: "github",
          options: {
            scopes: GITHUB_OAUTH_SCOPES,
            redirectTo,
            skipBrowserRedirect: false,
          },
        });
        if (oauthErr) throw oauthErr;
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "GitHub OAuth failed. Enable the GitHub provider in Supabase Auth (see docs/integrations/technical-specs/MSGF_GITHUB_PROJECTS.md)."
      );
      setConnecting(false);
    }
  }

  async function disconnectGithub() {
    setError(null);
    const res = await fetch("/api/msgf/github/connection", {
      method: "DELETE",
      credentials: "include",
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Failed to disconnect GitHub.");
      return;
    }
    setConnected(false);
    setGithubLogin(null);
    setRepos([]);
    setSelected(new Set());
    setMessage("GitHub disconnected.");
  }

  function toggleRepo(fullName: string) {
    if (mappedOrigins.has(fullName)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const projectsPayload = [...selected].map((fullName) => {
        const repo = repos.find((r) => r.full_name === fullName);
        return {
          source_type: "github" as const,
          display_name: fullName,
          github_url: repo?.html_url ?? `https://github.com/${fullName}`,
          project_origin: fullName,
        };
      });

      const res = await fetch("/api/msgf/projects/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: projectsPayload }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        created_count?: number;
        skipped_count?: number;
        error_count?: number;
        error?: string;
        errors?: Array<{ display_name: string; error: string }>;
      };
      if (!res.ok && !(json.created_count && json.created_count > 0)) {
        throw new Error(
          json.error ??
            json.errors?.[0]?.error ??
            `HTTP ${res.status}`
        );
      }
      setSelected(new Set());
      setMessage(
        `Added ${json.created_count ?? 0} GitHub repo(s)` +
          (json.skipped_count ? ` (${json.skipped_count} already mapped)` : "") +
          "."
      );
      await onMapped();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add selected repos.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.full_name.toLowerCase().includes(q));
  }, [repos, query]);

  return (
    <section className="glass-panel rounded-2xl border border-sky-500/20 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">GitHub repos</h3>
          <p className="mt-1 text-sm text-slate-400">
            Connect GitHub once, multi-select repos to map. Requires Supabase GitHub OAuth (
            <code className="text-sky-200">read:user repo</code>).
          </p>
          {githubLogin ? (
            <p className="mt-1 text-xs text-sky-300/90">Connected as @{githubLogin}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <button
              type="button"
              disabled={connecting || loadingStatus}
              onClick={() => void connectGithub()}
              className="rounded-full border border-sky-500/40 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:opacity-50"
            >
              {connecting ? "Redirecting…" : "Connect GitHub"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={loadingRepos}
                onClick={() => void loadRepos()}
                className="rounded-full border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:border-slate-400 disabled:opacity-50"
              >
                {loadingRepos ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={() => void disconnectGithub()}
                className="rounded-full border border-rose-500/30 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/10"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {loadingStatus ? (
        <p className="mt-4 text-sm text-slate-500">Checking GitHub connection…</p>
      ) : null}

      {!loadingStatus && !connected ? (
        <p className="mt-4 text-sm text-slate-500">
          Not connected yet. If Connect fails, enable the GitHub provider in Supabase Auth — see{" "}
          <code className="text-sky-200">docs/integrations/technical-specs/MSGF_GITHUB_PROJECTS.md</code>.
        </p>
      ) : null}

      {connected ? (
        <>
          <label className="mt-4 block text-sm text-slate-300">
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="owner/repo"
            />
          </label>

          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-800 p-2">
            {loadingRepos && repos.length === 0 ? (
              <li className="px-2 py-3 text-sm text-slate-500">Loading repos…</li>
            ) : null}
            {!loadingRepos && filtered.length === 0 ? (
              <li className="px-2 py-3 text-sm text-slate-500">No repos found.</li>
            ) : null}
            {filtered.map((repo) => {
              const mapped = mappedOrigins.has(repo.full_name);
              const checked = mapped || selected.has(repo.full_name);
              return (
                <li key={repo.full_name}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm ${
                      mapped ? "opacity-60" : "hover:bg-slate-900/80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={mapped}
                      onChange={() => toggleRepo(repo.full_name)}
                      className="rounded border-slate-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-slate-100">{repo.full_name}</span>
                      {repo.private ? (
                        <span className="ml-2 text-[10px] uppercase text-amber-300/80">private</span>
                      ) : null}
                      {mapped ? (
                        <span className="ml-2 text-[10px] uppercase text-emerald-400">mapped</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            disabled={saving || selected.size === 0}
            onClick={() => void addSelected()}
            className="mt-4 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {saving ? "Adding…" : `Add selected (${selected.size})`}
          </button>
        </>
      ) : null}
    </section>
  );
}
