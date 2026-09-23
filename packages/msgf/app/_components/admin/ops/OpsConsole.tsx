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
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AdminArbitrateAuditPanel } from "@/app/_components/admin/ops/AdminArbitrateAuditPanel";
import { AdminArbitrateSection } from "@/app/_components/admin/ops/AdminArbitrateSection";
import { AdminAuditHubPanel } from "@/app/_components/admin/ops/AdminAuditHubPanel";
import { AdminBetaWaitlistPanel } from "@/app/_components/admin/ops/AdminBetaWaitlistPanel";
import { AdminBugInboxPanel } from "@/app/_components/admin/ops/AdminBugInboxPanel";
import { AdminDiffImpactPanel } from "@/app/_components/admin/ops/AdminDiffImpactPanel";
import { AdminModelFitnessPanel } from "@/app/_components/admin/ops/AdminModelFitnessPanel";
import { AdminMostUsedResourcesPanel } from "@/app/_components/admin/ops/AdminMostUsedResourcesPanel";
import { AdminPromptTemplatesPanel } from "@/app/_components/admin/ops/AdminPromptTemplatesPanel";
import { AdminProvenanceSearchPanel } from "@/app/_components/admin/ops/AdminProvenanceSearchPanel";
import { AdminSentryPanel } from "@/app/_components/admin/ops/AdminSentryPanel";
import { AdminSessionReplayPanel } from "@/app/_components/admin/ops/AdminSessionReplayPanel";
import { AdminSiemIntegrationsPanel } from "@/app/_components/admin/ops/AdminSiemIntegrationsPanel";
import { AdminSkipAuditPanel } from "@/app/_components/admin/ops/AdminSkipAuditPanel";
import { AdminTenantBudgetPanel } from "@/app/_components/admin/ops/AdminTenantBudgetPanel";
import { AdminVaultQuarantinePanel } from "@/app/_components/admin/ops/AdminVaultQuarantinePanel";

const TABS = [
  { id: "governance", label: "Live Governance" },
  { id: "forensics", label: "Forensics" },
  { id: "routing", label: "Routing" },
  { id: "incidents", label: "Incidents" },
] as const;

type OpsTab = (typeof TABS)[number]["id"];

const HASH_TAB: Record<string, OpsTab> = {
  "bug-inbox": "incidents",
  arbitrate: "governance",
  "audit-hub": "forensics",
  provenance: "forensics",
  "session-replay": "forensics",
};

const OTHER = "__other__";

type ProjectRow = { project_origin: string; display_name?: string };

function isOpsTab(value: string | null): value is OpsTab {
  return TABS.some((tab) => tab.id === value);
}

export function OpsConsole() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const origin = searchParams?.get("project_origin")?.trim() || "";
  const qParam = searchParams?.get("q") ?? "";
  const tabParam = searchParams?.get("tab") ?? "";
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [qDraft, setQDraft] = useState(qParam);
  const [otherText, setOtherText] = useState(origin);
  const [otherOpen, setOtherOpen] = useState(false);

  const tab: OpsTab = isOpsTab(tabParam) ? tabParam : "governance";

  useEffect(() => {
    if (document.activeElement === searchRef.current) return;
    setQDraft(qParam);
  }, [qParam]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = qDraft.trim();
      const current = (searchParams?.get("q") ?? "").trim();
      if (current === trimmed) return;
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      const qs = next.toString();
      const hash = window.location.hash;
      router.replace(`${pathname}${qs ? `?${qs}` : ""}${hash}`);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [pathname, qDraft, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/msgf/projects", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((json: { projects?: ProjectRow[] }) => {
        if (!cancelled) setProjects(json.projects ?? []);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isOpsTab(tabParam)) return;
    const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    const fromHash = HASH_TAB[hash];
    if (!fromHash) return;
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("tab", fromHash);
    router.replace(`${pathname}?${next.toString()}${hash ? `#${hash}` : ""}`);
  }, [pathname, router, searchParams, tabParam]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function writeParams(mutate: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    mutate(next);
    const qs = next.toString();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    router.replace(`${pathname}${qs ? `?${qs}` : ""}${hash}`);
  }

  const knownOrigins = useMemo(
    () => projects.map((project) => project.project_origin).filter(Boolean),
    [projects]
  );
  const originListed = !origin || knownOrigins.includes(origin);
  const selectValue = otherOpen || (origin && !originListed) ? OTHER : origin;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8 sm:py-10">
      <header className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            MSGF Operator Ops
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-50">Ops console</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1 text-xs text-slate-400">
            Project
            <select
              value={selectValue}
              onChange={(e) => {
                const value = e.target.value;
                if (value === OTHER) {
                  setOtherOpen(true);
                  setOtherText(origin);
                  return;
                }
                setOtherOpen(false);
                writeParams((params) => {
                  if (value) params.set("project_origin", value);
                  else params.delete("project_origin");
                });
              }}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">All projects</option>
              {origin && !originListed ? <option value={origin}>{origin}</option> : null}
              {projects.map((project) => (
                <option key={project.project_origin} value={project.project_origin}>
                  {project.display_name || project.project_origin}
                </option>
              ))}
              <option value={OTHER}>Other…</option>
            </select>
          </label>
          {otherOpen || (origin && !originListed) ? (
            <label className="min-w-[14rem] flex-1 text-xs text-slate-400">
              Other origin
              <input
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  writeParams((params) => {
                    const trimmed = otherText.trim();
                    if (trimmed) params.set("project_origin", trimmed);
                    else params.delete("project_origin");
                  });
                }}
                onBlur={() => {
                  writeParams((params) => {
                    const trimmed = otherText.trim();
                    if (trimmed) params.set("project_origin", trimmed);
                    else params.delete("project_origin");
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          ) : null}
          <label className="min-w-[18rem] flex-[2] text-xs text-slate-400">
            Search
            <input
              ref={searchRef}
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Search hash, prompt text, resource key, path, or trace ID…"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ops sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() =>
                writeParams((params) => {
                  params.set("tab", item.id);
                })
              }
              className={`rounded-full px-3 py-1.5 text-sm ${
                tab === item.id
                  ? "bg-violet-500/20 font-medium text-violet-100"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {tab === "governance" ? (
        <div className="space-y-8">
          <div id="arbitrate">
            <AdminArbitrateSection hideDeveloperKeystrokes />
          </div>
          <AdminArbitrateAuditPanel />
          <AdminVaultQuarantinePanel />
          <AdminSkipAuditPanel />
        </div>
      ) : null}
      {tab === "forensics" ? (
        <div className="space-y-8">
          <AdminAuditHubPanel />
          <AdminSessionReplayPanel />
          <AdminProvenanceSearchPanel />
          <AdminDiffImpactPanel />
        </div>
      ) : null}
      {tab === "routing" ? (
        <div className="space-y-8">
          <AdminModelFitnessPanel />
          <AdminPromptTemplatesPanel />
          <AdminMostUsedResourcesPanel />
          <AdminTenantBudgetPanel />
        </div>
      ) : null}
      {tab === "incidents" ? (
        <div className="space-y-8">
          <AdminBugInboxPanel />
          <AdminSentryPanel />
          <AdminSiemIntegrationsPanel />
          <AdminBetaWaitlistPanel />
        </div>
      ) : null}
    </main>
  );
}
