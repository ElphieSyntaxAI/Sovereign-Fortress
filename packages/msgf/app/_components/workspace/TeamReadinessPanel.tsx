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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import { useCallback, useEffect, useState } from "react";

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
};

type Readiness = {
  company_id: string;
  company_name: string | null;
  domains_count: number;
  domains: string[];
  signing_provider: "docusign" | "dropbox_sign";
  dropbox_archive_path: string | null;
  pending_signatures: number;
  approved_invites: number;
  mapped_projects: number;
  archive_backlog: number;
  checklist: ChecklistItem[];
};

export function TeamReadinessPanel() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archivePath, setArchivePath] = useState("");
  const [provider, setProvider] = useState<"docusign" | "dropbox_sign">("docusign");
  const [domainInput, setDomainInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/workspace/team/readiness", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; readiness?: Readiness };
      if (!res.ok || !json.ok || !json.readiness) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setReadiness(json.readiness);
      setProvider(json.readiness.signing_provider);
      setArchivePath(json.readiness.dropbox_archive_path ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load readiness.");
      setReadiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/workspace/team/readiness", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signing_provider: provider,
          dropbox_archive_path: archivePath.trim() || null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; readiness?: Readiness };
      if (!res.ok || !json.ok || !json.readiness) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setReadiness(json.readiness);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function addDomain() {
    const domain = domainInput.trim();
    if (!domain) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/workspace/company-domains", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDomainInput("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add domain failed.");
    } finally {
      setSaving(false);
    }
  }

  const doneCount = readiness?.checklist.filter((c) => c.done).length ?? 0;
  const total = readiness?.checklist.length ?? 0;

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
            Team readiness
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {readiness?.company_name ?? "Your company"} · {doneCount}/{total} ready
            {readiness ? ` · ${readiness.pending_signatures} pending signatures` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-slate-400 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="mt-3 text-xs text-slate-500">Loading checklist…</p> : null}
      {error ? <p className="mt-3 text-xs text-amber-200">{error}</p> : null}

      {readiness ? (
        <ul className="mt-3 space-y-1.5">
          {readiness.checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              <span className={item.done ? "text-emerald-400" : "text-slate-500"}>
                {item.done ? "✓" : "○"}
              </span>
              <span className="text-slate-200">
                {item.label}
                {item.hint ? (
                  <span className="mt-0.5 block text-xs text-slate-500">{item.hint}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-400">
          Signing provider
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as typeof provider)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="docusign">DocuSign</option>
            <option value="dropbox_sign">Dropbox Sign</option>
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Dropbox archive path
          <input
            value={archivePath}
            onChange={(e) => setArchivePath(e.target.value)}
            placeholder="/MSGF-Audit"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="block text-xs text-slate-400 sm:col-span-2">
          Add Workspace domain
          <div className="mt-1 flex gap-2">
            <input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="acme.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void addDomain()}
              className="shrink-0 rounded-full border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </label>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void saveSettings()}
        className="mt-3 rounded-full border border-violet-500/40 bg-violet-500/15 px-4 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save signing / archive settings"}
      </button>
    </div>
  );
}
