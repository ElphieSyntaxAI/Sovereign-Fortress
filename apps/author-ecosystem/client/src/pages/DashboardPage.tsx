import { useMemo } from "react";
import { Link } from "react-router-dom";

import { CoolDownLock, type CoolDownManuscriptState } from "../components/CoolDownLock";
import { ManuscriptSelector } from "../components/ManuscriptSelector";
import { PlanningCommandCenter } from "../components/PlanningCommandCenter";
import HALTracker from "../components/HALTracker.jsx";
import { NarrativeProvider, useNarrative } from "../context/NarrativeContext";
import { bffCredentials } from "../lib/bffFetch";

function DashboardInner() {
  const { selection, setSelection } = useNarrative();

  const manuscript: CoolDownManuscriptState | null = useMemo(() => {
    if (!selection) return null;
    const vaultLocked =
      selection.cooldown_revision_status === "LOCKED" || selection.revision_status === "LOCKED";
    return {
      status: vaultLocked ? "LOCKED" : selection.revision_status,
      revision_status: selection.revision_status,
      cooldown_revision_status: selection.cooldown_revision_status,
      locked_until: selection.locked_until ?? null,
      lock_expires_at: selection.lock_expires_at ?? null,
      revision_cooldown_until: selection.revision_cooldown_until ?? null,
    };
  }, [selection]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", ...bffCredentials });
    window.location.assign("/");
  };

  return (
    <div className="dark min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-zinc-400">
              Pick a manuscript, then open planning tools.{" "}
              <Link to="/" className="text-zinc-300 underline underline-offset-2 hover:text-white">
                Home
              </Link>
              {" · "}
              <Link to="/terms" className="text-zinc-300 underline underline-offset-2 hover:text-white">
                Terms
              </Link>
              {" · "}
              <Link to="/nda" className="text-zinc-300 underline underline-offset-2 hover:text-white">
                NDAs
              </Link>
              {" · "}
              <Link to="/vault-pact" className="text-zinc-300 underline underline-offset-2 hover:text-white">
                Vault Pact
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Sign out
          </button>
        </header>

        <ManuscriptSelector />

        {selection ? (
          <CoolDownLock
            manuscript={manuscript}
            manuscriptId={selection.manuscriptId}
            onVaultSealed={(m) => {
              setSelection({
                ...selection,
                revision_status:
                  typeof m.revision_status === "string" ? m.revision_status : selection.revision_status,
                cooldown_revision_status:
                  typeof m.cooldown_revision_status === "string"
                    ? m.cooldown_revision_status
                    : selection.cooldown_revision_status,
                locked_until: m.locked_until != null ? String(m.locked_until) : null,
                revision_cooldown_until:
                  m.revision_cooldown_until != null ? String(m.revision_cooldown_until) : selection.revision_cooldown_until,
                lock_expires_at:
                  m.lock_expires_at != null ? String(m.lock_expires_at) : selection.lock_expires_at,
              });
            }}
          >
            <main className="space-y-10">
              <PlanningCommandCenter manuscriptId={selection.manuscriptId} tenantId={selection.tenantId} />
              <HALTracker />
            </main>
          </CoolDownLock>
        ) : (
          <p className="text-sm text-zinc-500">Select a manuscript above to load the Planning Command Center.</p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <NarrativeProvider>
      <DashboardInner />
    </NarrativeProvider>
  );
}
