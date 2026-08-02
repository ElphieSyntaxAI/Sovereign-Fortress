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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221141Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T220451Z-internal
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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GithubRepoPickerPanel } from "@/app/_components/workspace/GithubRepoPickerPanel";
import { LocalSubfolderPickerPanel } from "@/app/_components/workspace/LocalSubfolderPickerPanel";
import { InfoTip } from "@/app/_components/workspace/workspace-ui";
import { TeamManagementModule } from "@/app/_components/workspace/TeamManagementModule";
import { WorkspaceOnboardingPack } from "@/app/_components/workspace/WorkspaceOnboardingPack";
import type { SessionPermissions } from "@/lib/platform-rbac";
import type { UserProjectRow } from "@/lib/services/user-projects";

type MonorepoPreset = {
  id: string;
  display_name: string;
  project_origin: string;
  suggested_local_path: string;
};

type Props = {
  accessRole: string;
  companySilo: string;
  tenantKey: string;
  permissions?: SessionPermissions;
  onProjectsUpdated?: (projects: UserProjectRow[]) => void;
};

export function WorkspaceSetupProjectsTab({
  accessRole,
  companySilo,
  tenantKey,
  permissions,
  onProjectsUpdated,
}: Props) {
  const [projects, setProjects] = useState<UserProjectRow[]>([]);
  const [sourceType, setSourceType] = useState<"local" | "github">("local");
  const [displayName, setDisplayName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [projectOrigin, setProjectOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monorepoPresets, setMonorepoPresets] = useState<MonorepoPreset[]>([]);
  const [addingPresetId, setAddingPresetId] = useState<string | null>(null);
  const [presetAudience, setPresetAudience] = useState<"platform" | "customer" | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/msgf/projects", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { ok: boolean; projects?: UserProjectRow[]; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const list = json.projects ?? [];
      setProjects(list);
      onProjectsUpdated?.(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [onProjectsUpdated]);

  useEffect(() => {
    void loadProjects();
    fetch("/api/workspace/monorepo-presets", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as {
          ok?: boolean;
          presets?: MonorepoPreset[];
          audience?: "platform" | "customer";
        };
        if (json.ok) {
          setMonorepoPresets(json.presets ?? []);
          setPresetAudience(json.audience ?? (json.presets?.length ? "platform" : "customer"));
        }
      })
      .catch(() => {
        setMonorepoPresets([]);
        setPresetAudience("customer");
      });
  }, [loadProjects]);

  async function addMonorepoPreset(presetId: string) {
    const preset = monorepoPresets.find((p) => p.id === presetId);
    if (!preset) return;
    setAddingPresetId(presetId);
    setError(null);
    try {
      const res = await fetch("/api/msgf/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: "local",
          display_name: preset.display_name,
          local_path: preset.suggested_local_path,
          project_origin: preset.project_origin,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMessage(`Mapped workspace: ${preset.display_name}`);
      await loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add preset workspace.");
    } finally {
      setAddingPresetId(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body =
        sourceType === "local"
          ? {
              source_type: "local" as const,
              display_name: displayName.trim(),
              local_path: localPath.trim(),
              ...(projectOrigin.trim() ? { project_origin: projectOrigin.trim() } : {}),
            }
          : {
              source_type: "github" as const,
              display_name: displayName.trim(),
              github_url: githubUrl.trim(),
              ...(projectOrigin.trim() ? { project_origin: projectOrigin.trim() } : {}),
            };

      const res = await fetch("/api/msgf/projects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setDisplayName("");
      setLocalPath("");
      setGithubUrl("");
      setProjectOrigin("");
      setMessage("Project mapped. Switch to Active IDE Workspace to mint tokens and connect your editor.");
      await loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save project.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/msgf/projects/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Failed to delete project.");
      return;
    }
    await loadProjects();
  }

  return (
    <div className="space-y-6">
      <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-slate-400">
        Map your distributed monorepos into isolated project origins to track precise logic health
        and map independent RAG data streams.
      </p>

      <WorkspaceOnboardingPack />

      <GithubRepoPickerPanel
        projects={projects}
        onMapped={loadProjects}
        setError={setError}
        setMessage={setMessage}
      />

      <LocalSubfolderPickerPanel
        projects={projects}
        onMapped={loadProjects}
        setError={setError}
        setMessage={setMessage}
      />

      {(message || error) && (
        <div className="space-y-1">
          {message ? (
            <p className="text-sm text-emerald-300" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-amber-200" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="glass-panel min-w-0 space-y-4 rounded-2xl border border-emerald-500/20 p-5 sm:p-6"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Project mapping</h2>
            <span className="mt-2 inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
              SWEEP Architectural Ingest Enabled — Supports automated 1.1.1 genealogical module
              indexing
            </span>
            <p className="mt-1 text-sm text-slate-400">
              Register each repo or monorepo app you guard with MSGF.
              <InfoTip label="Monorepo mapping rules">
                <strong className="text-cyan-200">Monorepo rule:</strong> add one workspace per app
                (e.g. <code className="text-cyan-100">apps/author-ecosystem</code>,{" "}
                <code className="text-cyan-100">packages/msgf</code>), not only the git root. Each row
                is an independent <code className="text-cyan-100">project_origin</code> for Small Brain
                scoping and dashboard pillar health.
              </InfoTip>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["local", "github"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSourceType(type)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition duration-200 ${
                  sourceType === type
                    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-100"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {type === "local" ? "Local Folder" : "GitHub Repo"}
              </button>
            ))}
          </div>

          <label className="block text-sm text-slate-300">
            Display name
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              placeholder="deck_host"
            />
          </label>

          {sourceType === "local" ? (
            <label className="block text-sm text-slate-300">
              Local path
              <InfoTip label="Local path derivation">
                MSGF derives a stable <code className="text-cyan-100">project_origin</code> from this
                folder path when you leave the override blank. Use the app folder you open in Cursor —
                not always the monorepo root.
              </InfoTip>
              <input
                required
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
                placeholder="C:/dev/my-app"
              />
            </label>
          ) : (
            <label className="block text-sm text-slate-300">
              Repo URL
              <input
                required
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
                placeholder="https://github.com/owner/repository"
              />
            </label>
          )}

          <label className="block text-sm text-slate-300">
            Optional project origin override
            <input
              value={projectOrigin}
              onChange={(e) => setProjectOrigin(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
              placeholder="owner/repo or custom/tag"
            />
          </label>

          {message ? (
            <p className="text-sm text-emerald-300" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-amber-200" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full border border-emerald-500/40 bg-gradient-to-r from-emerald-600/80 to-violet-600/80 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/20 transition hover:from-emerald-500 hover:to-violet-500 disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Saving…" : "Save Project Mapping"}
          </button>
        </form>

        <aside className="glass-panel w-full shrink-0 rounded-2xl border border-cyan-500/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
            Account scope
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-100">Infrastructure context</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Access role</dt>
              <dd className="font-medium text-cyan-100">{accessRole}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sandbox status</dt>
              <dd className="font-medium text-slate-200">{companySilo}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Platform roles</dt>
              <dd className="font-medium text-cyan-100">
                {permissions?.roles.join(", ") ?? accessRole}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">IDE tenant key</dt>
              <dd className="break-all font-mono text-xs text-cyan-200/90">{tenantKey}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            BYOK (free indie) uses your Redis + Supabase and model keys under{" "}
            <code className="text-violet-200">.msgf/keys/</code>.
            <InfoTip label="Local Redis and Supabase">
              Point the extension at your MSGF instance with{" "}
              <code className="text-violet-200">REDIS_URL</code>,{" "}
              <code className="text-violet-200">NEXT_PUBLIC_SUPABASE_URL</code>, and{" "}
              <code className="text-violet-200">SUPABASE_SERVICE_ROLE_KEY</code> on the host you
              control — or use a managed Pro license from{" "}
              <Link href="/pricing" className="text-violet-300 hover:underline">
                pricing
              </Link>
              .
            </InfoTip>
          </p>
        </aside>
      </div>

      {monorepoPresets.length > 0 ? (
        <section className="glass-panel rounded-2xl border border-violet-500/20 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-slate-100">Monorepo shortcuts</h3>
          <p className="mt-1 text-sm text-slate-400">One-click workspace rows for internal apps.</p>
          <ul className="mt-4 space-y-2">
            {monorepoPresets.map((preset) => {
              const mapped = projects.some((p) => p.project_origin === preset.project_origin);
              return (
                <li
                  key={preset.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{preset.display_name}</p>
                    <p className="font-mono text-xs text-slate-500">{preset.project_origin}</p>
                  </div>
                  {mapped ? (
                    <span className="text-xs text-emerald-400">Mapped</span>
                  ) : (
                    <button
                      type="button"
                      disabled={addingPresetId === preset.id}
                      onClick={() => void addMonorepoPreset(preset.id)}
                      className="rounded-full border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
                    >
                      {addingPresetId === preset.id ? "Adding…" : "Add workspace"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : presetAudience === "customer" ? (
        <p className="text-sm text-slate-500">
          External accounts map custom projects only — internal monorepo shortcuts are hidden.
        </p>
      ) : null}

      <section className="glass-panel rounded-2xl border border-violet-500/15 p-5 sm:p-6">
        <h3 className="text-base font-semibold text-slate-100">Mapped projects ({projects.length})</h3>
        {loading ? <p className="mt-3 text-sm text-slate-500">Loading…</p> : null}
        {!loading && projects.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No projects yet — save a mapping above, then open the Active IDE Workspace tab.
          </p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-100">{project.display_name}</p>
                <p className="font-mono text-xs text-slate-500">{project.project_origin}</p>
                <p className="mt-0.5 truncate text-xs text-slate-600">
                  {project.source_type === "local" ? project.local_path : project.github_url}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(project.id)}
                className="shrink-0 text-xs text-rose-300 underline-offset-4 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {permissions?.canManageTeam ? <TeamManagementModule projects={projects} /> : null}
    </div>
  );
}
