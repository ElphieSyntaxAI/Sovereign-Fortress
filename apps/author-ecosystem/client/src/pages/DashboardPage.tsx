import { useMemo } from "react";
import { Link } from "react-router-dom";

import { CoolDownLock, type CoolDownManuscriptState } from "../components/CoolDownLock";
import { PlanningCommandCenter } from "../components/PlanningCommandCenter";
import { AuthorSentinelBugButton } from "../components/AuthorSentinelBugButton";
import HALTracker from "../components/HALTracker.jsx";
import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import { useNarrative } from "../context/NarrativeContext";

function DashboardInner() {
  const { meta } = useAuthorWorkspaceLens();
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

  return (
    <div className="space-y-8">
        <header>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/90">
              {meta.label} lens
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Planning workspace</h1>
            <p className="text-sm text-zinc-400">
              Wiki architect, librarian, ingest, plot sandbox, and HAL.{" "}
              <Link to="/manuscripts" className="text-violet-300 underline underline-offset-2 hover:text-violet-100">
                Change manuscript
              </Link>
            </p>
        </header>

        {!selection ? (
          <p className="text-sm text-amber-300/90">
            Select a manuscript on{" "}
            <Link to="/manuscripts" className="underline">
              Manuscripts
            </Link>{" "}
            first.
          </p>
        ) : null}

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
              <PlanningCommandCenter
                key={selection.manuscriptId}
                manuscriptId={selection.manuscriptId}
                tenantId={selection.tenantId}
              />
              <HALTracker />
            </main>
          </CoolDownLock>
        ) : null}

      <AuthorSentinelBugButton />
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardInner />;
}
