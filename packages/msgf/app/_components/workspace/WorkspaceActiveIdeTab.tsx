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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045125Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T044603Z-internal
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceProjectIdePanel } from "@/app/_components/workspace/WorkspaceProjectIdePanel";
import { WorkspaceProjectDebugHub } from "@/app/_components/workspace/WorkspaceProjectDebugHub";
import { CollapsiblePanel } from "@/app/_components/workspace/workspace-ui";
import type { SessionPermissions } from "@/lib/platform-rbac";
import type { UserProjectRow } from "@/lib/services/user-projects";

type Props = {
  projects: UserProjectRow[];
  apiUrl: string;
  initialProjectOrigin?: string | null;
  permissions?: SessionPermissions;
};

function formatTokenExpiry(project: UserProjectRow, tokenMap: Record<string, string | null>) {
  const raw = tokenMap[project.project_origin];
  if (!raw) return "No active token";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "Token pending";
  return `Expires ${d.toLocaleDateString(undefined, { dateStyle: "long" })}`;
}

export function WorkspaceActiveIdeTab({
  projects,
  apiUrl,
  initialProjectOrigin,
  permissions,
}: Props) {
  const [expandedOrigin, setExpandedOrigin] = useState<string | null>(null);

  useEffect(() => {
    if (expandedOrigin) return;
    const preferred = initialProjectOrigin ?? projects[0]?.project_origin ?? null;
    if (preferred) setExpandedOrigin(preferred);
  }, [expandedOrigin, initialProjectOrigin, projects]);
  const [tokenExpiryByOrigin, setTokenExpiryByOrigin] = useState<Record<string, string | null>>({});
  const [complianceLocked, setComplianceLocked] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/msgf/workspace/compliance-status", { credentials: "include" })
      .then(async (res) => res.json())
      .then((json: { is_locked?: boolean; signing_url?: string | null }) => {
        setComplianceLocked(Boolean(json.is_locked));
        setSigningUrl(json.signing_url ?? null);
      })
      .catch(() => {
        setComplianceLocked(Boolean(permissions?.isDocuSignLocked));
      });
  }, [permissions?.isDocuSignLocked]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map: Record<string, string | null> = {};
      await Promise.all(
        projects.map(async (p) => {
          try {
            const res = await fetch(
              `/api/workspace/ide-tokens?project_origin=${encodeURIComponent(p.project_origin)}`,
              { credentials: "include" }
            );
            const data = (await res.json()) as {
              has_active_token?: boolean;
              tokens?: Array<{ expires_at: string }>;
            };
            map[p.project_origin] =
              data.has_active_token && data.tokens?.[0]?.expires_at
                ? data.tokens[0].expires_at
                : null;
          } catch {
            map[p.project_origin] = null;
          }
        })
      );
      if (!cancelled) setTokenExpiryByOrigin(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  if (projects.length === 0) {
    return (
      <section className="glass-panel rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/5 px-6 py-14 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
          No mapped projects
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
          Map a local folder or GitHub repo in Architecture & Projects first, then return here to
          mint IDE tokens and connect Pulse Guard.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3" aria-label="Active IDE workspace projects">
      {complianceLocked ? (
        <section className="glass-panel rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
          <p className="text-sm font-medium text-amber-100">DocuSign compliance required</p>
          <p className="mt-2 text-sm text-slate-300">
            Complete your DocuSign compliance packet to unlock IDE tokens and project workspaces.
          </p>
          {signingUrl ? (
            <a
              href={signingUrl}
              className="mt-3 inline-block rounded-full border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/25"
            >
              Continue to DocuSign
            </a>
          ) : null}
        </section>
      ) : null}

      {projects.map((project) => {
        const isOpen = !complianceLocked && expandedOrigin === project.project_origin;
        const hasToken = Boolean(tokenExpiryByOrigin[project.project_origin]);
        return (
          <article
            key={project.id}
            className={`glass-panel overflow-hidden rounded-2xl border transition-colors duration-300 ${
              complianceLocked
                ? "border-slate-800/60 opacity-75"
                : isOpen
                  ? "border-emerald-500/35"
                  : "border-slate-700/60"
            }`}
          >
            <button
              type="button"
              disabled={complianceLocked}
              onClick={() => {
                if (complianceLocked) return;
                setExpandedOrigin((prev) =>
                  prev === project.project_origin ? null : project.project_origin
                );
              }}
              aria-expanded={isOpen}
              className="flex w-full flex-col gap-2 p-4 text-left transition hover:bg-white/[0.02] disabled:cursor-not-allowed sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-50">{project.display_name}</h3>
                {complianceLocked ? (
                  <span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-400">
                    Locked
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      hasToken
                        ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-100"
                        : "border-amber-500/35 bg-amber-500/15 text-amber-100"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${hasToken ? "bg-emerald-400" : "bg-amber-400"}`}
                      aria-hidden
                    />
                    {hasToken ? "Active" : "Setup required"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 sm:text-right">
                {formatTokenExpiry(project, tokenExpiryByOrigin)}
              </p>
            </button>

            <CollapsiblePanel open={isOpen} id={`ide-project-${project.id}`}>
              <div className="grid gap-6 border-t border-slate-800/80 px-4 pb-5 pt-4 lg:grid-cols-2 sm:px-5">
                <WorkspaceProjectIdePanel project={project} apiUrl={apiUrl} />
                <WorkspaceProjectDebugHub projectOrigin={project.project_origin} />
              </div>
            </CollapsiblePanel>
          </article>
        );
      })}

      <p className="text-center text-xs text-slate-600">
        Need another repo?{" "}
        <Link href="/workspace?tab=architecture" className="text-cyan-300 hover:underline">
          Add a project mapping
        </Link>
      </p>
    </div>
  );
}
