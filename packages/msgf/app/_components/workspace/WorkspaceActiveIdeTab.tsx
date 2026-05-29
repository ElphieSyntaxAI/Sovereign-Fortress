"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceProjectIdePanel } from "@/app/_components/workspace/WorkspaceProjectIdePanel";
import { CollapsiblePanel } from "@/app/_components/workspace/workspace-ui";
import type { UserProjectRow } from "@/lib/services/user-projects";

type Props = {
  projects: UserProjectRow[];
  apiUrl: string;
  initialProjectOrigin?: string | null;
};

function formatTokenExpiry(project: UserProjectRow, tokenMap: Record<string, string | null>) {
  const raw = tokenMap[project.project_origin];
  if (!raw) return "No active token";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "Token pending";
  return `Expires ${d.toLocaleDateString(undefined, { dateStyle: "long" })}`;
}

export function WorkspaceActiveIdeTab({ projects, apiUrl, initialProjectOrigin }: Props) {
  const [expandedOrigin, setExpandedOrigin] = useState<string | null>(
    initialProjectOrigin ?? projects[0]?.project_origin ?? null
  );
  const [tokenExpiryByOrigin, setTokenExpiryByOrigin] = useState<Record<string, string | null>>({});

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
          Map a local folder or GitHub repo in Setup & Projects first, then return here to mint IDE
          tokens and connect Pulse Guard.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3" aria-label="Active IDE workspace projects">
      {projects.map((project) => {
        const isOpen = expandedOrigin === project.project_origin;
        const hasToken = Boolean(tokenExpiryByOrigin[project.project_origin]);
        return (
          <article
            key={project.id}
            className={`glass-panel overflow-hidden rounded-2xl border transition-colors duration-300 ${
              isOpen ? "border-emerald-500/35" : "border-slate-700/60"
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setExpandedOrigin((prev) =>
                  prev === project.project_origin ? null : project.project_origin
                )
              }
              aria-expanded={isOpen}
              className="flex w-full flex-col gap-2 p-4 text-left transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-50">{project.display_name}</h3>
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
              </div>
              <p className="text-xs text-slate-400 sm:text-right">
                {formatTokenExpiry(project, tokenExpiryByOrigin)}
              </p>
            </button>

            <CollapsiblePanel open={isOpen} id={`ide-project-${project.id}`}>
              <div className="border-t border-slate-800/80 px-4 pb-5 pt-4 sm:px-5">
                <WorkspaceProjectIdePanel project={project} apiUrl={apiUrl} />
              </div>
            </CollapsiblePanel>
          </article>
        );
      })}

      <p className="text-center text-xs text-slate-600">
        Need another repo?{" "}
        <Link href="/workspace?tab=setup" className="text-cyan-300 hover:underline">
          Add a project mapping
        </Link>
      </p>
    </div>
  );
}
