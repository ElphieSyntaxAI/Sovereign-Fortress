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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
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
 * Distribution Build ID: MSGF-08289e1a-20260923T145027Z-internal
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

import { useCallback, useState } from "react";

import { AdminGovernanceSearchShell } from "@/app/_components/admin/ops/AdminGovernanceSearchShell";

type TemplateRow = {
  id: string;
  name: string;
  version: number;
  prompt_hash: string;
  template_body: string;
  created_at: string;
};

export function AdminPromptTemplatesPanel() {
  const [q, setQ] = useState("");
  const [name, setName] = useState("default");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [diffPreview, setDiffPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("name", q.trim());
      const res = await fetch(`/api/msgf/admin/prompt-templates?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        templates?: TemplateRow[];
        diff?: { preview?: string } | null;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setTemplates(json.templates ?? []);
      setDiffPreview(json.diff?.preview ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
      setTemplates([]);
      setDiffPreview(null);
    } finally {
      setLoading(false);
    }
  }, [q]);

  const saveVersion = async () => {
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/msgf/admin/prompt-templates", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, template_body: body }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; template?: TemplateRow };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setStatus(`Saved ${json.template?.name} v${json.template?.version}`);
      setQ(name);
      await runSearch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  };

  return (
    <div id="prompt-templates">
      <AdminGovernanceSearchShell
        eyebrow="Fitness lineage"
        title="Prompt templates"
        description="Versioned prompt bodies. prompt_hash links Session Replay and model-fitness spikes."
        scope="tenant"
        query={q}
        onQueryChange={setQ}
        onSearch={() => void runSearch()}
        loading={loading}
        error={error}
        empty={templates.length === 0}
        searched={searched}
        placeholder="Filter by template name…"
      >
        <div className="mb-4 space-y-2 rounded-lg border border-slate-800 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="template name"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="template body"
            rows={5}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100"
          />
          <button
            type="button"
            onClick={() => void saveVersion()}
            className="rounded-lg border border-cyan-600/50 px-3 py-1.5 text-sm text-cyan-100"
          >
            Save new version
          </button>
          {status ? <p className="text-xs text-emerald-300">{status}</p> : null}
        </div>

        <ul className="space-y-2 text-sm text-slate-300">
          {templates.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
            >
              <p className="font-medium text-slate-100">
                {t.name} · v{t.version}
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-500">{t.prompt_hash}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(t.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>

        {diffPreview ? (
          <div className="mt-4">
            <h3 className="text-xs uppercase tracking-wide text-cyan-300/80">
              Latest version diff
            </h3>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-slate-300">
              {diffPreview}
            </pre>
          </div>
        ) : null}
      </AdminGovernanceSearchShell>
    </div>
  );
}
