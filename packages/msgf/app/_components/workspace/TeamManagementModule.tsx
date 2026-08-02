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
import { useCallback, useEffect, useState } from "react";

import {
  TeamInviteOnboardingSection,
  type OnboardingFormState,
} from "@/app/_components/workspace/TeamInviteOnboardingSection";
import { TeamRosterTable } from "@/app/_components/workspace/TeamRosterTable";
import { TeamReadinessPanel } from "@/app/_components/workspace/TeamReadinessPanel";
import { InfoTip } from "@/app/_components/workspace/workspace-ui";
import type { TeamRosterRow } from "@/lib/services/company-team";
import type { UserProjectRow } from "@/lib/services/user-projects";

const DEFAULT_ONBOARDING: OnboardingFormState = {
  includePillarGuide: false,
  includeArchitectureTemplate: false,
  enforceDocusign: false,
  customDocumentIds: [],
  attachedFiles: [],
};

type Props = {
  projects: UserProjectRow[];
};

export function TeamManagementModule({ projects }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "security" | "auditor" | "dev">("dev");
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingFormState>(DEFAULT_ONBOARDING);
  const [roster, setRoster] = useState<TeamRosterRow[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const res = await fetch("/api/msgf/workspace/team/roster", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as { ok?: boolean; roster?: TeamRosterRow[] };
      setRoster(json.roster ?? []);
    } catch {
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  function toggleOrigin(origin: string) {
    setSelectedOrigins((prev) =>
      prev.includes(origin) ? prev.filter((o) => o !== origin) : [...prev, origin]
    );
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      if (!selectedOrigins.length) {
        throw new Error("Select at least one project origin.");
      }
      const res = await fetch("/api/msgf/workspace/team/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          team_platform_role: role,
          project_origins: selectedOrigins,
          onboarding: {
            include_pillar_guide: onboarding.includePillarGuide,
            include_architecture_template: onboarding.includeArchitectureTemplate,
            enforce_docusign: onboarding.enforceDocusign,
            custom_document_ids: onboarding.customDocumentIds,
          },
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Invite failed.");
      setMessage(`Invitation sent to ${email.trim()}.`);
      setEmail("");
      setSelectedOrigins([]);
      setOnboarding(DEFAULT_ONBOARDING);
      await loadRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setSending(false);
    }
  }

  const originOptions = projects ?? [];

  return (
    <section className="glass-panel space-y-6 rounded-2xl border border-violet-500/20 p-5 sm:p-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Manage Team Access</h3>
        <p className="mt-1 text-sm text-slate-400">
          Invite engineers with scoped project origins and secure onboarding documents.
        </p>
      </div>

      <TeamReadinessPanel />

      <TeamRosterTable rows={roster} loading={loadingRoster} />

      <form onSubmit={(e) => void handleInvite(e)} className="grid gap-6 lg:grid-cols-2">
        <label className="block text-sm text-slate-300">
          Email Address
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="engineer@company.com"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Platform Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            <option value="admin">admin</option>
            <option value="security">security</option>
            <option value="auditor">auditor</option>
            <option value="dev">dev</option>
          </select>
        </label>

        <div className="lg:col-span-2">
          <p className="text-sm text-slate-300">
            Project Origin Assignment
            <InfoTip label="Project origin scope">
              Tying users to specific project origins isolates their telemetry streams, matches their
              local IDE pulse configurations automatically, and provides crisp code-provenance tracking
              for security audits.
            </InfoTip>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {originOptions.length === 0 ? (
              <p className="text-xs text-slate-500">Map a project first to assign origins.</p>
            ) : (
              originOptions.map((p) => {
                const selected = selectedOrigins.includes(p.project_origin);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleOrigin(p.project_origin)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-100"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {p.display_name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <TeamInviteOnboardingSection value={onboarding} onChange={setOnboarding} />
        </div>

        {message ? (
          <p className="lg:col-span-2 text-sm text-emerald-300" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="lg:col-span-2 text-sm text-amber-200" role="alert">
            {error}
          </p>
        ) : null}

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={sending || !originOptions.length}
            className="rounded-full border border-violet-500/40 bg-gradient-to-r from-violet-600/80 to-emerald-600/80 px-6 py-2.5 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-emerald-500 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send Platform Invitation"}
          </button>
        </div>
      </form>
    </section>
  );
}
