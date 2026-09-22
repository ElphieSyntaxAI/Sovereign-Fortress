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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */

import { useCallback, useEffect, useState } from "react";

import { useSharedProjectOrigin } from "@/app/_components/admin/ops/useSharedProjectOrigin";

import { AdminGovernanceSearchShell } from "@/app/_components/admin/ops/AdminGovernanceSearchShell";

type DiffReport = {
  id: string;
  score: "green" | "yellow" | "red";
  summary: string;
  touched_paths: string[];
  hall_risk: Array<{ resource_key: string; file_path: string | null }>;
  auto_green_blockers: string[];
  created_at: string;
};

export function AdminDiffImpactPanel() {
  const sharedOrigin = useSharedProjectOrigin();
  const [pathsText, setPathsText] = useState("");
  const [projectOrigin, setProjectOrigin] = useState(sharedOrigin);
  const [report, setReport] = useState<DiffReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (sharedOrigin) setProjectOrigin(sharedOrigin);
  }, [sharedOrigin]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const files = pathsText
        .split(/[\n,]+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((path) => ({ path }));
      if (files.length === 0) throw new Error("Add at least one file path.");
      const res = await fetch("/api/msgf/diff-impact", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files,
          project_origin: projectOrigin.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report?: DiffReport;
      };
      if (!res.ok || !json.ok || !json.report) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setReport(json.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diff impact failed.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [pathsText, projectOrigin]);

  return (
    <div id="diff-impact">
      <AdminGovernanceSearchShell
        eyebrow="Blast radius"
        title="Diff Impact"
        description="Map changed paths against Vault/Hall/P7 memory. When MSGF_REQUIRE_DIFF_IMPACT=1, red blocks deploy-gate."
        scope="company"
        query={projectOrigin}
        onQueryChange={setProjectOrigin}
        onSearch={() => void run()}
        loading={loading}
        error={error}
        empty={!report}
        searched={searched}
        placeholder="Optional project_origin…"
        filters={
          <label className="block text-sm text-slate-300">
            Paths (one per line)
            <textarea
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 p-2 font-mono text-xs text-slate-200"
              rows={4}
              value={pathsText}
              onChange={(e) => setPathsText(e.target.value)}
              placeholder={"src/lib/foo.ts\npackages/msgf/lib/bar.ts"}
            />
          </label>
        }
      >
        {report ? (
          <div className="space-y-3 text-sm text-slate-200">
            <p>
              <span
                className={
                  report.score === "red"
                    ? "text-rose-300"
                    : report.score === "yellow"
                      ? "text-amber-300"
                      : "text-emerald-300"
                }
              >
                {report.score.toUpperCase()}
              </span>{" "}
              · {report.summary}
            </p>
            <p className="font-mono text-[11px] text-slate-500">{report.id}</p>
            {report.auto_green_blockers.length > 0 ? (
              <ul className="list-disc pl-5 text-rose-200/90">
                {report.auto_green_blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {report.hall_risk.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Hall risk</p>
                <ul className="mt-1 space-y-1 font-mono text-[11px] text-slate-400">
                  {report.hall_risk.slice(0, 12).map((h) => (
                    <li key={`${h.resource_key}:${h.file_path ?? ""}`}>
                      {h.resource_key}
                      {h.file_path ? ` · ${h.file_path}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminGovernanceSearchShell>
    </div>
  );
}
